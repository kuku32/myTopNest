// src/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { WebhookService } from './webhook/webhook.service';
import { StockHelperService } from './webhook/stockHelper.service';
@Injectable()
export class TasksService {
    constructor(
        private readonly stockHelperService: StockHelperService,
        private readonly webhooksService: WebhookService,
      ) {}
  private readonly logger = new Logger(TasksService.name);


  // Example: run every 15 minutes during trading hours (9:30 AM - 4:00 PM ET)
  @Cron('*/15 14-21 * * 1-5') // Adjust to UTC time
  handleMarketCron() {
    this.logger.log('📈 Running 15-min trading check (market hours)');
  }

  // @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCronCrypto() {
    this.logger.log('Running scheduled task for EVERY_5_MINUTES');
    const date = new Date()
    const timeframe = '5m'
    // this.webhooksService.sendTemporaryWebhook('railway CHECKBOT Crypto 5min RUN AT:'+date, 'RSIENDBOT 5MIN', 'Nono','CRON_CHECK');
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
        await this.compareAndSend(lastData, secondLastData, ticker+'USD', timeframe+'in', 'CRYPTO_WATCH');

        this.logger.log(`${ticker} processed successfully.`);
      } catch (error) {
        this.webhooksService.sendTemporaryWebhook(`ERROR ON API AT: ${timeframe} On ${date}`, `RSIENDBOT ${ticker}USD at ${timeframe}`, 'Nono','ERORR_CALL');
        this.logger.error(`Error processing ${ticker}: ${error.message}`);
      }
    }
  }

 @Cron('*/15 * * * *') // every 15 minutes
  async handle15Min() {
    const tickers = ['BTCUSD', 'BCHUSD', 'LTCUSD', 'ETHUSD', 'ETCUSD', 'DASHUSD', 'ZECUSD', 'XMRUSD'];
    // const tickers = ['BTCUSD'];
    // const apikey = '2bbd0d305edb404aac2e2de5cc1311af'; // test
    const apikey = 'd3058ae5683b4fc19a787ceb21a87f67';
    this.logger.log('Running scheduled every 15 minutes for all tickers...');
    await this.processTickers(tickers, '15min', apikey, 'CRYPTO_WATCH');
  }
  private async processTickers(
    tickers: string[],
    timeframe: string,
    apikey: string,
    category: 'CRYPTO_WATCH' | 'USSTOCK_WATCH'
  ) {
    const date = new Date();
    // this.sendDiscord(`CHECKBOT ${category} ${timeframe} RUN AT: ${date}`, `RSIENDBOT ${category} ${timeframe}`, 'Nono', 'CRON_CHECK');

    // Delay 2 minutes before processing
    // const washselllists = this.LocalPLWR.getWashSellList() || []
    // await new Promise((resolve) => setTimeout(resolve, 2 * 60 * 1000));

    for (const ticker of tickers) {
      // if (washselllists.includes(ticker)) {
      //   console.log(`⏭️ Skipping ${ticker} — in wash sell list`);
      //   continue; // ✅ Skip this ticker and move on
      // }
      try {
        let data
        // if(apikey === 'all'){
        //   data = await this.LocalPLWR.TwReveseNOAPI(ticker, timeframe);
        // }else{
          data = await this.webhooksService.get12for(ticker, timeframe, apikey);
        // }
        
        const lastData = data[data.length - 1];
        const secondLastData = data[data.length - 2];

        await this.compareAndSend(lastData, secondLastData, ticker, timeframe, category);
        this.logger.log(`${ticker} processed successfully.`);
      } catch (error) {
        this.webhooksService.sendTemporaryWebhook(
          `railway ERROR ON API AT: ${timeframe} On ${date}`,
          `RSIENDBOT ${ticker} at ${timeframe}`,
          'Nono',
          'ERORR_CALL'
        );
        this.logger.error(`Error processing ${ticker}: ${error.message}`);
      }
    }
  }


  async compareAndSend(lastdata, Secondlastdata, ticker, timefame, channel='BUYSELL') {
    if (
      lastdata?.MACDLine > lastdata?.SignalLine &&
      Secondlastdata?.MACDLine < Secondlastdata?.SignalLine
    ) {
      this.webhooksService.sendTemporaryWebhook(`railway BUY ON MACDCROSS-${timefame}(MACD:${lastdata?.MACDDivergence}): ${lastdata?.date}` , `${ticker} RSI 5MIN -ON- ${timefame}`, lastdata,channel);
    }    
    // else{
    //   this.webhooksService.sendTemporaryWebhook(`railway BUY ON MACDCROSS-${timefame}(MACD:${lastdata?.MACDDivergence}): ${lastdata?.date}` , `${ticker} RSI 5MIN -ON- ${timefame}`, lastdata,channel);
    // }
  }
}
