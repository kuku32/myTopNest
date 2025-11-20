// src/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { StockHelperService } from './stock/stockHelper.service';
import { WebhookService } from './webhook/webhook.service';
@Injectable()
export class TasksService {
    constructor(
        private readonly stockHelperService: StockHelperService,
        private readonly webhooksService: WebhookService,
      ) {}
  private readonly logger = new Logger(TasksService.name);

  // Example: run every 1 minute
  @Cron(CronExpression.EVERY_10_SECONDS)
  handleEveryMinute() {
    this.logger.log('⏰ Running cron task every minute');
  }

  // Example: run every 15 minutes during trading hours (9:30 AM - 4:00 PM ET)
  @Cron('*/15 14-21 * * 1-5') // Adjust to UTC time
  handleMarketCron() {
    this.logger.log('📈 Running 15-min trading check (market hours)');
  }


  async compareAndSend(lastdata, Secondlastdata, ticker, timefame, channel='BUYSELL') {
    if (
      lastdata?.MACDLine > lastdata?.SignalLine &&
      Secondlastdata?.MACDLine < Secondlastdata?.SignalLine
    ) {
      this.sendDiscord(`BUY ON MACDCROSS-${timefame}(MACD:${lastdata?.MACDDivergence}): ${lastdata?.date}` , `${ticker} -ON- ${timefame}`, lastdata,channel);
    }
    // else{
    //   // this.sendDiscord('BUY ERALLY', ticker, {}, 'ERORR_CALL');
    //   console.log(lastdata)
    //   console.log(Secondlastdata)
    //   // this.sendDiscord(`BUY ERALLY ON-${timefame}(MACD:${lastdata?.MACDDivergence}): ${lastdata?.date}` , `${ticker} -ON- ${timefame}`, lastdata,channel);
    // }
  }

  async sendDiscord(message:string, ticker:string, lastdata:any, channel:string) {
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

  async wakeupcall() {
    try {
      const { data } = await axios.get('https://nestjs-api.koyeb.app');
      this.logger.log('⏱️ Keep-alive ping success:', data.status);
    } catch (err) {
      this.logger.error(`❌ Keep-alive failed: ${err.message}`);
      this.sendDiscord(
        `❌ Keep-alive failed:`,
        `RSIENDBOT BOTBOT`,
        'Nono',
        'ERORR_CALL'
      );
    }
  }
}
