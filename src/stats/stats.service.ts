import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
    constructor(private prisma: PrismaService) { }

    async getRevenueAnalytics(businessId: string) {
        const last12Months: { month: string; year: number; startDate: Date; endDate: Date }[] = [];
        for (let i = 11; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            last12Months.push({
                month: date.toLocaleString('default', { month: 'short' }),
                year: date.getFullYear(),
                startDate: new Date(date.getFullYear(), date.getMonth(), 1),
                endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59),
            });
        }

        const stats = await Promise.all(
            last12Months.map(async (period) => {
                const result = await this.prisma.invoice.aggregate({
                    where: {
                        businessId,
                        status: 'PAID',
                        updatedAt: {
                            gte: period.startDate,
                            lte: period.endDate,
                        },
                    },
                    _sum: {
                        total: true,
                    },
                });

                return {
                    name: period.month,
                    revenue: result._sum.total || 0,
                };
            }),
        );

        return stats;
    }

    async getProjectProgress(businessId: string) {
        const statuses = ['PENDING', 'IN_PROGRESS', 'DELIVERED'];
        const stats = await Promise.all(
            statuses.map(async (status) => {
                const count = await this.prisma.project.count({
                    where: { businessId, status: status as any },
                });
                return { name: status.replace('_', ' '), value: count };
            }),
        );
        return stats;
    }

    async getPendingTasks(businessId: string) {
        const [overdueInvoices, activeProjects] = await Promise.all([
            this.prisma.invoice.findMany({
                where: {
                    businessId,
                    status: 'SENT',
                    // Assuming createdAt + 30 days is overdue for simplicity
                    createdAt: {
                        lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    },
                },
                include: { client: true },
                take: 5,
            }),
            this.prisma.project.findMany({
                where: { businessId, status: 'IN_PROGRESS' },
                include: { client: true },
                take: 5,
            }),
        ]);

        return {
            overdueInvoices,
            activeProjects,
        };
    }
}
