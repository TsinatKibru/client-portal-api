import { Controller, Get, Patch, Param, Request, UseGuards, Post } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
    constructor(private notificationService: NotificationService) { }

    @Get()
    async findAll(@Request() req) {
        return this.notificationService.findAll(req.user.businessId, req.user.userId);
    }

    @Patch(':id/read')
    async markAsRead(@Param('id') id: string, @Request() req) {
        return this.notificationService.markAsRead(id, req.user.businessId);
    }

    @Post('read-all')
    async markAllAsRead(@Request() req) {
        return this.notificationService.markAllAsRead(req.user.businessId, req.user.userId);
    }
}
