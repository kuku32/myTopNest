import { Controller, Post, Body, UseGuards, UploadedFile, UseInterceptors, Get } from '@nestjs/common';
import { WebhookService } from './webhook.service';

// @UseGuards(JwtGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhookService) {}
  @Get()
  getHello() {
    return this.webhooksService.getHello();
  }
  
}
