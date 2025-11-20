// src/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { StockHelperService } from './webhook/stockHelper.service';
import { WebhookService } from './webhook/webhook.service';
@Injectable()
export class TasksService {
    constructor(
        private readonly stockHelperService: StockHelperService,
        private readonly webhooksService: WebhookService,
      ) {}
  private readonly logger = new Logger(TasksService.name);

  // Example: run every 1 minute
  @Cron(CronExpression.EVERY_5_MINUTES)
  handleEveryMinute() {
    this.logger.log('⏰ Running cron task every minute');
    this.webhooksService.sendTemporaryWebhook('query.stockTicker', 'YOHE ')
  }

  // Example: run every 15 minutes during trading hours (9:30 AM - 4:00 PM ET)
  @Cron('*/15 14-21 * * 1-5') // Adjust to UTC time
  handleMarketCron() {
    this.logger.log('📈 Running 15-min trading check (market hours)');
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCronCrypto() {
    this.wakeupcall()
    this.logger.log('Running scheduled task for all tickers...');
    const date = new Date()
    const timeframe = '5m'
    this.sendDiscord('CHECKBOT Crypto 5min RUN AT:'+date, 'RSIENDBOT 5MIN', 'Nono','CRON_CHECK');
    const tickers = ['BTC', 'BCH', 'LTC', 'ETH','ETC', 'DASH', 'ZEC', 'XMR'];
    // const tickers = ['BTC'];
    await new Promise((resolve) => setTimeout(resolve, 2 * 60 * 1000)); // 2-minute delay
    for (const ticker of tickers) {
      try {
        // 1️⃣ Get historical data for the ticker
        const data = await this.webhooksService.getCoinHistory(ticker, timeframe);

        const lastData = data[0];
        const secondLastData = data[1];

        // 4️⃣ Compare and send alert if condition is met
        await this.compareAndSend(lastData, secondLastData, ticker+'USD', timeframe+'in', 'SMCI');

        this.logger.log(`${ticker} processed successfully.`);
      } catch (error) {
        this.sendDiscord(`ERROR ON API AT: ${timeframe} On ${date}`, `RSIENDBOT ${ticker}USD at ${timeframe}`, 'Nono','ERORR_CALL');
        this.logger.error(`Error processing ${ticker}: ${error.message}`);
      }
    }
  }





  async compareAndSend(lastdata, Secondlastdata, ticker, timeframe, channel='BUYSELL') {
    if (
      lastdata?.MACDLine > lastdata?.SignalLine &&
      Secondlastdata?.MACDLine < Secondlastdata?.SignalLine
    ) {
      await this.sendDiscord(`BUY ON MACDCROSS-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}` , `${ticker} -ON- ${timeframe}`, lastdata,channel+'all');
    }

    else{
      // this.sendDiscord('BUY ERALLY', ticker, {}, 'ERORR_CALL');
      // await this.sendDiscord(`BUY now:check me-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}` , `${ticker} -ON- ${timeframe}`, lastdata,channel+'all');
      // console.log(lastdata)
      // console.log(Secondlastdata)
      // this.sendDiscord(`BUY ERALLY ON-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}` , `${ticker} -ON- ${timeframe}`, lastdata,channel);
    }
  }

  async sendDiscord(message:string, ticker:string, lastdata:any, channel:string) {
    try {
      return await this.webhooksService.sendTemporaryWebhook(
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
