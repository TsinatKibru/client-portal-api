import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PusherService } from '../realtime/pusher.service';

@Injectable()
export class NotificationService {
    constructor(
        private prisma: PrismaService,
        private pusher: PusherService
    ) { }

    async findAll(businessId: string, userId: string) {
        return this.prisma.notification.findMany({
            where: { businessId, userId },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
    }

    async create(data: {
        type: string;
        message: string;
        userId: string;
        businessId: string;
        projectId?: string;
    }) {
        const notification = await this.prisma.notification.create({
            data: {
                ...data,
                read: false,
            }
        });

        // Trigger real-time via Pusher
        // Channel: business-{businessId}, Event: new-notification
        await this.pusher.trigger(
            `business-${data.businessId}`,
            'new-notification',
            notification
        );

        return notification;
    }

    async markAsRead(id: string, businessId: string) {
        return this.prisma.notification.updateMany({
            where: { id, businessId },
            data: { read: true }
        });
    }

    async markAllAsRead(businessId: string, userId: string) {
        return this.prisma.notification.updateMany({
            where: { businessId, userId, read: false },
            data: { read: true }
        });
    }
}
