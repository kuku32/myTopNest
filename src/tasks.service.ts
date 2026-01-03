// src/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { WebhookService } from './webhook/webhook.service';
import { StockHelperService } from './webhook/stockHelper.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly webhooksService: WebhookService,
    private readonly stockHelperService: StockHelperService,
  ) {}
  private readonly logger = new Logger(TasksService.name);
  async sendDiscord(
    message: string,
    ticker: string,
    lastdata: any,
    channel: string,
  ) {
    try {
      return await this.webhooksService.sendDiscordNotification(
        message,
        `${channel} ${ticker}`,
        JSON.stringify(lastdata),
      );
    } catch (err) {
      console.error('❌ Error in controller:', err);
      throw err;
    }
  }
  @Cron(CronExpression.EVERY_5_MINUTES)
  async wakeupcall() {
    try {
      const date = new Date();
      await this.sendDiscord(
        'RAILWAY WAKEUPCALL:' + date,
        'RSIENDBOT 5MIN',
        'Nono',
        'CRON_CHECK',
      );
      const { data } = await axios.get(
        'https://mytopnest-production.up.railway.app/webhooks',
      );
      this.logger.log('⏱️ Keep-alive ping success:', data.status);
    } catch (err) {
      this.logger.error(`❌ RAILWAY Keep-alive failed: ${err.message}`);
      this.sendDiscord(
        `❌ RAILWAY Keep-alive failed:`,
        `RSIENDBOT BOTBOT`,
        'Nono',
        'ERORR_CALL',
      );
    }
  }
}
