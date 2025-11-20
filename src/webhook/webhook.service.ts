import { Injectable } from '@nestjs/common';
import { AttachmentBuilder,EmbedBuilder, WebhookClient } from 'discord.js';
@Injectable()
export class WebhookService {
  private webhookClient: WebhookClient;
  async sendDiscordNotification(
    message: string,
    botname: string = 'Bot Alert',
    lastData: string,
    file?:  import('multer').File,
    extra?: any
  ) {
   
    return { msg: 'post to discord success'};
  }
}
