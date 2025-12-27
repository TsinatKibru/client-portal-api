import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private transporter: nodemailer.Transporter;

    constructor() {
        const emailUser = process.env.EMAIL_USER;
        const emailPass = process.env.EMAIL_PASS;

        console.log('MailService: Initializing with Nodemailer');
        console.log('MailService: EMAIL_USER:', emailUser ? 'FOUND' : 'MISSING');
        console.log('MailService: EMAIL_PASS:', emailPass ? 'FOUND' : 'MISSING');

        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: emailPass,
            },
        });
    }

    async sendEmail(to: string, subject: string, html: string) {
        const from = process.env.EMAIL_USER || 'noreply@gmail.com';
        console.log(`MailService: Attempting to send email via Nodemailer`);
        console.log(`MailService: From: ${from}, To: ${to}, Subject: ${subject}`);

        try {
            const info = await this.transporter.sendMail({
                from,
                to,
                subject,
                html,
            });
            console.log('MailService: Email sent successfully. MessageId:', info.messageId);
            return { success: true, data: info };
        } catch (error) {
            console.error('MailService: ERROR sending email:', error);
            return { success: false, error };
        }
    }
}
