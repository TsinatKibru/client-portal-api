import { ProjectStatus } from '@prisma/client';
import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { PusherService } from '../realtime/pusher.service';
import { NotificationService } from '../notification/notification.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ProjectService {
    constructor(
        private prisma: PrismaService,
        private uploadService: UploadService,
        private pusher: PusherService,
        private notificationService: NotificationService,
        private mailService: MailService,
    ) { }

    async findAll(businessId: string) {
        return this.prisma.project.findMany({
            where: { businessId },
            include: { client: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async create(businessId: string, data: any) {
        const project = await this.prisma.project.create({
            data: {
                title: data.title,
                description: data.description,
                status: data.status || 'PENDING',
                businessId,
                clientId: data.clientId,
            },
            include: { client: true, business: true }
        });

        if (project.client && project.client.userId) {
            // 1. Create In-App Notification
            await this.notificationService.create({
                type: 'PROJECT_CREATED',
                message: `New project "${project.title}" has been created for you.`,
                userId: project.client.userId,
                businessId: project.businessId,
                projectId: project.id,
            });

            // 2. Send Welcome Email
            await this.mailService.sendEmail(
                project.client.email,
                `Project Created: ${project.title}`,
                `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: ${project.business.brandColor || '#4F46E5'}">New Project Assigned</h2>
                    <p>Hello ${project.client.name},</p>
                    <p>A new project <strong>"${project.title}"</strong> has been created and assigned to you.</p>
                    <p>You can track the progress and view shared files in your client portal.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #666;">This is an automated message from ${project.business.name}.</p>
                </div>
                `
            );
        }

        return project;
    }

    async findOne(id: string, businessId: string) {
        return this.prisma.project.findFirst({
            where: { id, businessId },
            include: { client: true, files: true },
        });
    }

    async updateStatus(id: string, businessId: string, status: ProjectStatus, userId: string) {
        const project = await this.prisma.project.update({
            where: { id },
            data: { status },
            include: { client: true }
        });

        // Log activity
        await this.prisma.activity.create({
            data: {
                type: 'STATUS_CHANGE',
                description: `Status changed to ${status}`,
                userId,
                projectId: id,
                businessId,
            },
        }).catch(err => console.error("Failed to log status change activity", err));

        // Trigger real-time update
        await this.pusher.trigger(`project-${id}`, 'status.updated', { status });

        // Send Notification to Client
        if (project.client && project.client.userId) {
            await this.notificationService.create({
                type: 'STATUS_CHANGE',
                message: `Project "${project.title}" status updated to ${status}.`,
                userId: project.client.userId,
                businessId: project.businessId,
                projectId: project.id,
            });
        }

        return project;
    }

    async delete(id: string, businessId: string) {
        console.log(`ProjectService: Starting deletion of project ${id} for business ${businessId}`);
        // Find files associated with the project to delete them from Cloudinary
        const files = await this.prisma.file.findMany({
            where: { projectId: id, businessId },
        });

        console.log(`ProjectService: Found ${files.length} files to delete`);

        for (const file of files) {
            if (file.publicId) {
                try {
                    await this.uploadService.deleteFile(file.id, businessId);
                } catch (err) {
                    console.error(`ProjectService: Failed to delete file ${file.id} from Cloudinary:`, err);
                }
            } else {
                console.log(`ProjectService: Deleting file ${file.id} (no publicId) from DB`);
                await this.prisma.file.delete({ where: { id: file.id } });
            }
        }

        console.log(`ProjectService: Finally deleting project ${id}`);
        return this.prisma.project.delete({
            where: { id, businessId },
        });
    }

    async findAllFiles(businessId: string) {
        return this.prisma.file.findMany({
            where: { businessId },
            include: { project: true },
            orderBy: { createdAt: 'desc' },
        });
    }
}
