import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PusherService } from '../realtime/pusher.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class CommentService {
    constructor(
        private prisma: PrismaService,
        private pusher: PusherService,
        private notificationService: NotificationService,
    ) { }

    async create(userId: string, data: { projectId: string; content: string; fileId?: string }) {
        const comment = await this.prisma.comment.create({
            data: {
                content: data.content,
                userId: userId,
                projectId: data.projectId,
                fileId: data.fileId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                    },
                },
            },
        });

        const project = await this.prisma.project.findUnique({
            where: { id: data.projectId },
            include: { client: true, business: { include: { users: true } } },
        });

        // Trigger real-time event
        await this.pusher.trigger(
            `project-${data.projectId}`,
            'comment.added',
            comment,
        );

        // Also log activity
        await this.prisma.activity.create({
            data: {
                type: 'COMMENT_ADDED',
                description: `A new comment was added`,
                userId: userId,
                projectId: data.projectId,
                businessId: project?.businessId || '',
            },
        });

        // Notifications
        if (project) {
            const isClientComment = project.client?.userId === userId;

            if (isClientComment) {
                // Notify Admins/Owners
                const admins = project.business.users.filter(u => u.role !== 'CLIENT');
                for (const admin of admins) {
                    await this.notificationService.create({
                        type: 'COMMENT_ADDED',
                        message: `Client ${comment.user.email} commented on project "${project.title}"`,
                        userId: admin.id,
                        businessId: project.businessId,
                        projectId: project.id,
                    });
                }
            } else {
                // Admin commented, notify Client
                if (project.client?.userId) {
                    await this.notificationService.create({
                        type: 'COMMENT_ADDED',
                        message: `New update from expert on project "${project.title}"`,
                        userId: project.client.userId,
                        businessId: project.businessId,
                        projectId: project.id,
                    });
                }
            }
        }

        return comment;
    }

    async findAll(projectId: string) {
        return this.prisma.comment.findMany({
            where: { projectId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    }
}
