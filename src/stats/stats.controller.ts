import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
    constructor(private statsService: StatsService) { }

    @Get('revenue')
    async getRevenue(@Request() req) {
        return this.statsService.getRevenueAnalytics(req.user.businessId);
    }

    @Get('projects')
    async getProjects(@Request() req) {
        return this.statsService.getProjectProgress(req.user.businessId);
    }

    @Get('pending')
    async getPending(@Request() req) {
        return this.statsService.getPendingTasks(req.user.businessId);
    }
}
