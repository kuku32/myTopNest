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
      ...Object.keys(this.stockHelperService.CR_DWS_US_DAILY_RUN_NAME_ID),
      ...Object.keys(this.stockHelperService.CR_DWS_ERR_CHECK_NAME_ID),
      ...Object.keys(this.stockHelperService.CR_DWS_FX_NAME_ID),
      ...Object.keys(this.stockHelperService.CR_DWS_CR_NAME_ID),
    ]; // example list

    for (const channel of Channels) {
      // CLOSE YESTERDAY
      await this.LocalPLWR.sendDiscordNotification(
        `${equal}==END-${yesterday}${equal}`,
        `${channel} RLWAYBOT`,
        JSON.stringify('lastdata'),
      );

      // START TODAY
      await this.LocalPLWR.sendDiscordNotification(
        `${equal}START-${today}${equal}`,
        `${channel} RLWAYBOT`,
        JSON.stringify('lastdata'),
      );

      // Log completion
      this.logger.error(`✅ Finished sending for`, channel);
    }
  }

  async onModuleInit() {
    // This runs ONCE when the app starts
    const start = -1;
    const end = 17;

    for (let day = start; day <= end; day++) {
      await this.delete(day);
      this.logger.error(`✅ Finished sending for`, day);
    }
    // const SLACK_WEBHOOKS_US50  = await this.LocalPLWR.getArrSymbolFFire('above-ma50/alldata/4hour') as string[];
    // console.log('SLACK_WEBHOOKS_US50', SLACK_WEBHOOKS_US50)
  }
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // close yesterday and open today
  async delete(dayago = 1) {
    const yesterday = this.stockHelperService.getDateNDaysAgo(dayago);
    const Channels = [
      'MA_AB_50_100',
      // ...Object.keys(this.stockHelperService.CR_DWS_US_DAILY_RUN_NAME_ID),
      // ...Object.keys(this.stockHelperService.CR_DWS_ERR_CHECK_NAME_ID),
      // ...Object.keys(this.stockHelperService.CR_DWS_CR_NAME_ID),
      // ...Object.keys(this.stockHelperService.CR_DWS_FX_NAME_ID),
      // ...Object.keys(this.stockHelperService.CR_DWS_RSI_NAME_ID),
      // 'TSLA',
      // 'OTHER',
      // 'SMCI',
      // 'US_5M_HT',
      // 'BUYSELL',
      // 'US_30M_HT',
      // 'US_15M_HT',
      // 'US_30M_BUY',
      // 'MA_BL_5_200',
      // 'MA_BL_5_20',
      // 'USSTOCK_WATCH',
      // 'US_ALL',
      // 'US_EARLY_5MIN',
      // 'US_EARLY_15MIN',
      // 'EARLY_AB200',

      // 'SELL_EARLY_DAY',
      // 'BUY_EARLY_DAY',
      // 'MA_BL_100_200',
      // 'MA_BL_50_100',
      // 'MA_BL_20_50',
      // 'MA_AB_100_200',
      // 'MA_AB_50_100',
      // 'MA_AB_20_50',
      // 'MA_AB_5_200',
      // 'MA_AB_5_20',
      // 'MACD_BL_POS',
      // 'MACD_AB_POS',
      // 'MACD_BL_NEG',
      // 'MACD_AB_NEG',
      // 'SRA_BL200',
      // 'SRA_AB200','BUY_SAR',
      // 'WATCHLIST',
      // '200BL_OV_NEG_01','200BL_OV_NEG_05','200AB_LESS_1','200AB_LESS_05','200AB_LESS_01','EARLY_AB200'
    ]; // example list

    await new Promise((resolve) => setTimeout(resolve, 0 * 60 * 1000));
    for (const channel of Channels) {
      // Log completion
      this.logger.log(`✅ Finished sending for`, channel);

      // DELETE two days ago messages
      await this.LocalPLWR.deleteMessages(channel, yesterday);
      this.logger.log(`🗑️ Deleted old messages for` + yesterday + channel);
    }
  }
}
