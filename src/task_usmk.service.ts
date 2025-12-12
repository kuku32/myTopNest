// src/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { WebhookService } from './webhook/webhook.service';
import { StockHelperService } from './webhook/stockHelper.service';
import { ConfigService } from '@nestjs/config';
import * as Timer from './webhook/compareTime';
import { StockData } from './webhook/dto/chartData';

@Injectable()
export class TasksUSMKService {
  allkeys = 'all'; // test
  constructor(
    private readonly configService: ConfigService,
    private readonly stockHelperService: StockHelperService,
    private readonly LocalPLWR: WebhookService,
  ) {}
  private readonly logger = new Logger(TasksUSMKService.name);

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
          `RWBOT ${ticker} at ${timeframe}`,
          'Nono',
          'ERORR_CALL',
        );
        this.logger.error(`Error processing ${ticker}: ${error.message}`);
      }
    }
  }
  uplist = [];
  downlist = [];
  async compareAndSend(lastdata, Secondlastdata, ticker, timeframe, channel) {
    const isWithinRange = Timer.checkIfWithin5MinutesEST(lastdata?.date, 20);
    if (isWithinRange) {
      console.log(ticker, '✅ Within ±20 minutes of EST time');
    } else {
      console.log(ticker, '❌ Outside ±20 minutes of EST time', lastdata?.date);
      // return;
    }
    const buyALL =
      await this.stockHelperService.priceAbAll1or5or15MinBUY(lastdata);
    if (buyALL && this.uplist.includes(ticker)) {
      // add to uplist and delete out downlist
      this.uplist.push(ticker);
      if (this.downlist.includes(ticker)) {
        this.downlist = this.downlist.filter((sym) => sym !== ticker);
      }
      await this.sendDiscord(
        `BUY priceAbAll-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker} -ON- ${timeframe}`,
        lastdata,
        'US_EARLY_5MIN',
      );
    }
    const sellALl =
      await this.stockHelperService.priceBlAll1or5or15MinSELL(lastdata);
    if (sellALl && this.downlist.includes(ticker)) {
      // add to downlist and remove from uplist
      this.downlist.push(ticker);
      if (this.uplist.includes(ticker)) {
        this.uplist = this.uplist.filter((sym) => sym !== ticker);
      }
      await this.sendDiscord(
        `SELLLLLLLL priceBlAll-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker} -ON- ${timeframe}`,
        lastdata,
        'US_ALL',
      );
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
        'RAILWAY WAKEUPCALL:' + date,
        'RWBOT 5MIN',
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
        `RWBOT BOTBOT`,
        'Nono',
        'ERORR_CALL',
      );
    }
  }
  @Cron('*/5 14-21 * * 1-5', { timeZone: 'UTC' })
  async runAllWatchLists() {
    const symbols = (await this.LocalPLWR.getDolist()) || [];
    await Promise.all([
      this.USTIMERUN(symbols, this.allkeys, 'US_EARLY_5MIN', 1, '1min'),
    ]);
  }

  // @Cron('*/15 14-21 * * 1-5', { timeZone: 'UTC' })
  // async runAllWatL15min() {
  //   await this.sendDiscord(
  //     'WAKEUPCALL:15min',
  //     'RWBOT 15min',
  //     'US',
  //     'CRON_CHECK',
  //   );
  //   const symbols = (await this.LocalPLWR.getDolist()) || [];
  //   await Promise.all([
  //     this.USTIMERUN(symbols, this.allkeys, 'US_EARLY_15MIN', 3, '15min'),
  //   ]);
  // }
  // @Cron('*/1 14-21 * * 1-5', { timeZone: 'UTC' })
  // async minuteQQQ() {
  //   // const symbols = (await this.LocalPLWR.getDolist()) || [];
  //   const symbols = [`SNAP`, 'QQQ'];
  //   await Promise.all([
  //     this.USTIMERUN(symbols, this.allkeys, 'USSTOCK_WATCH', 0, '1min'),
  //   ]);
  // }
}
