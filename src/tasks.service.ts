// src/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { WebhookService } from './webhook/webhook.service';
import { StockHelperService } from './webhook/stockHelper.service';
import { ConfigService } from '@nestjs/config';
import * as Timer from './webhook/compareTime';
import e from 'express';
@Injectable()
export class TasksService {
  allkeys = 'all'; // test
  constructor(
    private readonly configService: ConfigService,
    private readonly stockHelperService: StockHelperService,
    private readonly LocalPLWR: WebhookService,
  ) {}
  private readonly logger = new Logger(TasksService.name);

  // CRYPTO
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronCrypto() {
    this.wakeupcall();
    this.logger.log('Running scheduled task for EVERY_5_MINUTES');
    const date = new Date();
    const timeframe = '5m';
    // this.LocalPLWR.sendTemporaryWebhook('railway CHECKBOT Crypto 5min RUN AT:'+date, 'RSIENDBOT 5MIN', 'Nono','CRON_CHECK');
    const tickers = ['BTC', 'BCH', 'LTC', 'ETH','ETC', 'DASH', 'ZEC', 'XMR'];
    // const tickers = ['BTC'];
    await new Promise((resolve) => setTimeout(resolve, 2 * 60 * 1000)); // 2-minute delay
    for (const ticker of tickers) {
      try {
        // 1️⃣ Get historical data for the ticker
        const data = await this.LocalPLWR.getCoinHistory(ticker, timeframe);

        const lastData = data[0];
        const secondLastData = data[1];

        // 4️⃣ Compare and send alert if condition is met
        await this.compareAndSend(
          lastData,
          secondLastData,
          ticker + 'USD',
          timeframe + 'in',
          'CRYPTO_EARLY_5MIN',
        );

        this.logger.log(`${ticker} processed successfully.`);
      } catch (error) {
        this.LocalPLWR.sendTemporaryWebhook(
          `ERROR ON API AT: ${timeframe} On ${date}`,
          `RSIENDBOT ${ticker}USD at ${timeframe}`,
          'Nono',
          'ERORR_CALL',
        );
        this.logger.error(`Error processing ${ticker}: ${error.message}`);
      }
    }
  }
  @Cron('*/15 * * * *') // every 15 minutes
  async handle15Min() {
    await this.sendDiscord(
      'WAKEUPCALL:15min',
      'RSIENDBOT 15min',
      'CRYTO',
      'CRON_CHECK',
    );
    const tickers = ['BTCUSD', 'BCHUSD', 'LTCUSD', 'ETHUSD', 'ETCUSD', 'DASHUSD', 'ZECUSD', 'XMRUSD'];
    // const tickers = ['BTCUSD'];
    const apikey = 'd3058ae5683b4fc19a787ceb21a87f67';
    this.logger.log('Running scheduled every 15 minutes for CRYPTOs...');
    await this.processTickers(
      tickers,
      '15min',
      apikey,
      'CRYPTO_EARLY_15MIN',
      2,
    );
  }
  // US STOCK
  @Cron('*/5 14-21 * * 1-5')
  async runAllWatchLists() {
    const symbols = (await this.LocalPLWR.getDolist()) || [];
    await Promise.all([
      this.USTIMERUN(symbols, this.allkeys, 'US_EARLY_5MIN', 2, '5min'),
    ]);
  }

  @Cron('*/15 14-21 * * 1-5')
  async runAllWatL15min() {
    await this.sendDiscord('WAKEUPCALL:15min', 'RSIENDBOT 15min', 'US','CRON_CHECK');
    const symbols =  await this.LocalPLWR.getDolist() ||[]
    await Promise.all([
      this.USTIMERUN(symbols, this.allkeys,'US_EARLY_15MIN', 3, '15min'),
    ]);
  }



  async USTIMERUN(
    intickers: string[],
    api: any,
    channel,
    delay,
    timeframe = '5min',
  ) {
    const now = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
    });
    if (intickers.length < 1) {
      this.logger.log(`Don't have symbol ${timeframe} check (${now} ET)`);
      return;
    }
    if (!this.stockHelperService.isMarketOpen()) {
      this.logger.log(
        `🕒 Market closed — skipping ${timeframe} check (${now} ET)`,
      );
      return;
    }
    this.logger.log(
      `✅ Market open — running ${timeframe} trading logic (${now} ET)`,
    );

    const tickers = intickers;
    await this.processTickers(tickers, timeframe, api, channel, delay);
  }

  private async processTickers(
    tickers: string[],
    timeframe: string,
    apikey: string,
    channel: string,
    delay = 2,
  ) {
    const date = new Date();

    const washselllists =
      (await this.LocalPLWR.loadWashSellList()) ||
      this.LocalPLWR.getWashSellList();
    // Delay 2 minutes before processing
    await new Promise((resolve) => setTimeout(resolve, delay * 60 * 1000));

    for (const ticker of tickers) {
      if (washselllists.includes(ticker)) {
        console.log(`⏭️ Skipping ${ticker} — in wash sell list`);
        continue; // ✅ Skip this ticker and move on
      }
      try {
        let data;
        if (apikey === 'all') {
          data = await this.LocalPLWR.TwReveseNOAPI(ticker, timeframe);
        } else {
          data = await this.LocalPLWR.get12for(ticker, timeframe, apikey);
        }

        const lastData = data[data.length - 1];
        const secondLastData = data[data.length - 2];

        await this.compareAndSend(
          lastData,
          secondLastData,
          ticker,
          timeframe,
          channel,
        );
        this.logger.log(`${ticker} processed successfully.`);
      } catch (error) {
        this.sendDiscord(
          `ERROR ON API AT: ${timeframe} On ${date}`,
          `RSIENDBOT ${ticker} at ${timeframe}`,
          'Nono',
          'ERORR_CALL',
        );
        this.logger.error(`Error processing ${ticker}: ${error.message}`);
      }
    }
  }

  async run15Min5signal(ticker, lastdata5min, channel) {
    this.logger.log(`${ticker} run15Min5signal.`);

    const data = await this.LocalPLWR.TwReveseNOAPI(ticker, '15min');
    const lastData = data[data.length - 1];
    if (lastData?.MACDLine > lastData?.SignalLine) {
      // 5min cross, 15 allway buy buy
      await this.sendDiscord(
        `BUY ON MACDCROSS-5min (MACD:${lastdata5min?.MACDLine}): ${lastdata5min?.date}`,
        `${ticker} -ON- 5min`,
        lastdata5min,
        channel,
      );
    } else{
      await this.sendDiscord(
        `BUY ON MACDCROSS-5min (MACD:${lastdata5min?.MACDLine}): ${lastdata5min?.date}`,
        `${ticker} -ON- 5min`,
        lastdata5min,
        channel.includes('US')?'US_ALL':"CRYPTO_ALL",
      );
    }
  }

  async compareAndSend(lastdata, Secondlastdata, ticker, timeframe, channel) {
    const isWithinRange = Timer.checkIfWithin5MinutesEST(lastdata?.date);
    if (isWithinRange) {
      console.log(ticker, '✅ Within ±5 minutes of EST time');
    } else {
      console.log(ticker, '❌ Outside ±5 minutes of EST time', lastdata?.date);
      return;
    }
    if (
      lastdata?.MACDLine > lastdata?.SignalLine &&
      Secondlastdata?.MACDLine < Secondlastdata?.SignalLine
    ) {
      if (timeframe === '5min') {
        // check on 15min to see bullish or bearish macd
        await this.run15Min5signal(ticker, lastdata, channel);
      } else {
        await this.sendDiscord(
          `BUY ON MACDCROSS-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
          `${ticker} -ON- ${timeframe}`,
          lastdata,
          channel,
        );
      }
    }
  }

  async sendDiscord(
    message: string,
    ticker: string,
    lastdata: any,
    channel: string,
  ) {
    try {
      return await this.LocalPLWR.sendDiscordNotification(
        'RAILWAY ' + message,
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
      const date = new Date();
      await this.sendDiscord(
        'WAKEUPCALL:' + date,
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
