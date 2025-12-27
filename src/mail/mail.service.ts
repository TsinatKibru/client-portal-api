import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
    private resend: Resend;

    constructor() {
        this.resend = new Resend(process.env.RESEND_API_KEY || 're_Lo69GpwV_DyhC3jYzv5Uu6bDAg7N91DpX');
    }

    async sendEmail(to: string, subject: string, html: string) {
        try {
            await this.resend.emails.send({
                from: 'onboarding@resend.dev', // Use verified domain in production
                to,
                subject,
                html,
            });
            return { success: true };
        } catch (error) {
            console.error('Failed to send email', error);
            return { success: false, error };
        }
    }
}
