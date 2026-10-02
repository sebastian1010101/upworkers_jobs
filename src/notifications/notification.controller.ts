import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('jobs')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Post(':id/notifications/whatsapp')
  sendWhatsApp(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.notifications.sendWhatsApp(id);
  }

  @Get(':id/notifications/whatsapp')
  getWhatsApp(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.notifications.getWhatsApp(id);
  }
}
