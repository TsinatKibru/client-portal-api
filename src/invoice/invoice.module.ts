import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { NotificationModule } from '../notification/notification.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [NotificationModule, MailModule],
  controllers: [InvoiceController],
  providers: [InvoiceService]
})
export class InvoiceModule { }
