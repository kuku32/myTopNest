// src/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { WebhookService } from './webhook/webhook.service';
import { StockHelperService } from './webhook/stockHelper.service';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class TasksService {
  allkeys = 'all'; // test
    constructor(
        private readonly configService: ConfigService,
        private readonly stockHelperService: StockHelperService,
        private readonly webhooksService: WebhookService,
      ) {}
  private readonly logger = new Logger(TasksService.name);
  @Cron(CronExpression.EVERY_5_MINUTES)
  async runAllWatchLists() {
    const symbols =  await this.webhooksService.getDolist() ||[]
    await Promise.all([
      this.USTIMERUN(symbols,this.allkeys,'US_EARLY_5MIN', 2,'5min'),
      this.USTIMERUN(symbols, this.allkeys,'US_EARLY_15MIN', 3, '15min'),
    ]);
  }


  @Cron('*/15 * * * *') // every 15 minutes
  async handle15Min() {
    const tickers = ['BTCUSD', 'BCHUSD', 'LTCUSD', 'ETHUSD', 'ETCUSD', 'DASHUSD', 'ZECUSD', 'XMRUSD'];
    // const tickers = ['BTCUSD'];
    // const apikey = '2bbd0d305edb404aac2e2de5cc1311af'; // test
    const apikey = 'd3058ae5683b4fc19a787ceb21a87f67';
    this.logger.log('Running scheduled every 15 minutes for all tickers...');
    await this.processTickers(tickers, '15min', apikey, 'CRYPTO_EARLY_15MIN');
  }

  async USTIMERUN(intickers:string[], api:any,channel, delay, timeframe = '5min') {
    const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    if(intickers.length < 1 ){
      this.logger.log(`Don't have symbol ${timeframe} check (${now} ET)`);
      return
    }
    if (!this.stockHelperService.isMarketOpen()) {
      this.logger.log(`🕒 Market closed — skipping ${timeframe} check (${now} ET)`);
      return;
    }
    this.logger.log(`✅ Market open — running ${timeframe} trading logic (${now} ET)`);

    const tickers = intickers;
    await this.processTickers(tickers, timeframe, api, channel, delay);
  }
  private async processTickers(
    tickers: string[],
    timeframe: string,
    apikey: string,
    channel: string,
    delay = 2
  ) {
    const date = new Date();

    const washselllists = await this.webhooksService.loadWashSellList() || this.webhooksService.getWashSellList()
    // Delay 2 minutes before processing
    await new Promise((resolve) => setTimeout(resolve, delay * 60 * 1000));

    for (const ticker of tickers) {
      if (washselllists.includes(ticker)) {
        console.log(`⏭️ Skipping ${ticker} — in wash sell list`);
        continue; // ✅ Skip this ticker and move on
      }
      try {
        let data
        if(apikey === 'all'){
          data = await this.webhooksService.TwReveseNOAPI(ticker, timeframe);
        }else{
          data = await this.webhooksService.get12for(ticker, timeframe, apikey);
        }
        
        const lastData = data[data.length - 1];
        const secondLastData = data[data.length - 2];

        await this.compareAndSend(lastData, secondLastData, ticker, timeframe, channel);
        this.logger.log(`${ticker} processed successfully.`);
      } catch (error) {
        this.sendDiscord(
          `ERROR ON API AT: ${timeframe} On ${date}`,
          `RSIENDBOT ${ticker} at ${timeframe}`,
          'Nono',
          'ERORR_CALL'
        );
        this.logger.error(`Error processing ${ticker}: ${error.message}`);
      }
    }
  }

  async sendDiscord(message:string, ticker:string, lastdata:any, channel:string) {

    try {
      return await this.webhooksService.sendDiscordNotification(
        'RAILWAY '+message,
        `${channel} ${ticker}`,
        JSON.stringify(lastdata),
      );
    } catch (err) {
      console.error('❌ Error in controller:', err);
      throw err;
    }
  }




  async compareAndSend(lastdata, Secondlastdata, ticker, timeframe, channel) {
    if (
      lastdata?.MACDLine > lastdata?.SignalLine &&
      Secondlastdata?.MACDLine < Secondlastdata?.SignalLine
    ) {
      await this.sendDiscord(`BUY ON MACDCROSS-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}` , `${ticker} -ON- ${timeframe}`, lastdata,channel);
    }    
    // else{
    //   await this.sendDiscord(`BUY ON MACDCROSS-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}` , `${ticker} -ON- ${timeframe}`, lastdata,channel);
    //   // this.webhooksService.sendTemporaryWebhook(`railway BUY ON MACDCROSS-${timeframe}(MACD:${lastdata?.MACDDivergence}): ${lastdata?.date}` , `${ticker} RSI 5MIN -ON- ${timeframe}`, lastdata,channel);
    // }
  }
  // // @Cron(CronExpression.EVERY_MINUTE)
  async wakeupcall() {
    try {
      const date = new Date()
      await this.sendDiscord('WAKEUPCALL:'+date, 'RSIENDBOT 5MIN', 'Nono','CRON_CHECK');
      const { data } = await axios.get('https://mytopnest-production.up.railway.app/webhooks');
      this.logger.log('⏱️ Keep-alive ping success:', data.status);
    } catch (err) {
      this.logger.error(`❌ RAILWAY Keep-alive failed: ${err.message}`);
      this.sendDiscord(
        `❌ RAILWAY Keep-alive failed:`,
        `RSIENDBOT BOTBOT`,
        'Nono',
        'ERORR_CALL'
      );
    }
  }

  // @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCronCrypto() {
    this.wakeupcall()
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
        await this.compareAndSend(lastData, secondLastData, ticker+'USD', timeframe+'in', 'CRYPTO_EARLY_5MIN');

        this.logger.log(`${ticker} processed successfully.`);
      } catch (error) {
        this.webhooksService.sendTemporaryWebhook(`ERROR ON API AT: ${timeframe} On ${date}`, `RSIENDBOT ${ticker}USD at ${timeframe}`, 'Nono','ERORR_CALL');
        this.logger.error(`Error processing ${ticker}: ${error.message}`);
      }
    }
  }
}
