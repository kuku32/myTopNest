// src/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { WebhookService } from './webhook/webhook.service';
import { StockHelperService } from './webhook/stockHelper.service';

@Injectable()
export class SendEverydayService {
  constructor(
    private readonly stockHelperService: StockHelperService,
    private readonly LocalPLWR: WebhookService,
  ) {}
  private readonly logger = new Logger(SendEverydayService.name);

    // @Cron(CronExpression.EVERY_10_SECONDS)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // close yesterday and open today
  async SendEverydayService() {
    const today = this.stockHelperService.getDateNDaysAgo(0);
    const yesterday = this.stockHelperService.getDateNDaysAgo(1);
    const twoDayAgo = this.stockHelperService.getDateNDaysAgo(2);
    const equal = `===========================================`;
    const Channels = [
      '15MIN_BUY_FX',
      '15MIN_SELL_FX',
      '30MIN_BUY_FX',
      '30MIN_SELL_FX',
      '1HOUR_BUY_FX',
      '1HOUR_SELL_FX',
      '4HOUR_BUY_FX',
      '4HOUR_SELL_FX',
    ]; // example list

    for (const channel of Channels) {
      // CLOSE YESTERDAY
      await this.LocalPLWR.sendDiscordNotification(
        `${equal}==END-${yesterday}${equal}`,
        `${channel} RWBOT`,
        JSON.stringify('lastdata'),
      );

      // START TODAY
      await this.LocalPLWR.sendDiscordNotification(
        `${equal}START-${today}${equal}`,
        `${channel} RWBOT`,
        JSON.stringify('lastdata'),
      );

      // Log completion
      this.logger.error(`✅ Finished sending for`, channel);

      // DELETE two days ago messages
      await this.LocalPLWR.deleteMessages(channel, twoDayAgo);
      this.logger.error(`🗑️ Deleted old messages for`, channel);
    }
  }
}
