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
  mysymbols = ['INTC', 'SMCI', 'BULL','RDW','CRWV',"TSLA","BILL",'QQQ', 'SPY', 'SNAP','BULL','UNH',"TTD","CNC"]; // test symbols
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

        await this.compareAndSend(data,
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
  uplist: string[] = [];
  downlist: string[] = [];
  async compareAndSend(data, lastdata, Secondlastdata, ticker, timeframe, channel) {
    const buyALL =
      await this.stockHelperService.priceAbAll1or5or15MinBUY(lastdata);
    if (buyALL && !this.uplist.includes(ticker)) {
      // add to uplist and delete out downlist
      await this.sendDiscord(
        `BUY priceAbAll-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker} -ON- ${timeframe}`,
        lastdata,
        'US_EARLY_5MIN',
        data
      );
      this.uplist.push(ticker);
    }

    // const downtime = await this.stockHelperService.macdCrossBL(
    //   lastdata,
    //   Secondlastdata,
    // );
    // if (downtime) {
    //   if (this.uplist.includes(ticker)) {
    //     this.uplist = this.uplist.filter((sym) => sym !== ticker);
    //   }
    //   await this.sendDiscord(
    //     `SELLLLLLLL macdCrossBL-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
    //     `${ticker} -ON- ${timeframe}`,
    //     lastdata,
    //     'US_ALL',
    //   );
    // }
    const sellALl =
      await this.stockHelperService.priceBlAll1or5or15MinSELL(lastdata);
    if (sellALl && !this.downlist.includes(ticker)) {
      await this.sendDiscord(
        `SELLLLLLLL priceBlAll-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker} -ON- ${timeframe}`,
        lastdata,
        'US_ALL',data
      );
      // add to downlist and remove from uplist
      this.downlist.push(ticker);
    }
    // const uptime = await this.stockHelperService.macdCrossAB(
    //   lastdata,
    //   Secondlastdata,
    // );
    // if (uptime) {
    //   if (this.downlist.includes(ticker)) {
    //     this.downlist = this.downlist.filter((sym) => sym !== ticker);
    //   }
    //   await this.sendDiscord(
    //     `BUY macdCrossAB-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
    //     `${ticker} -ON- ${timeframe}`,
    //     lastdata,
    //     'US_EARLY_15MIN',
    //   );
    // }
  }
  async sendDiscord(
    message: string,
    ticker: string,
    lastdata: any,
    channel: string,
    data?: any,
  ) {
    try {
      const fileBuffer = await this.LocalPLWR.captureChart(data);
      return await this.LocalPLWR.sendDiscordNotification(
        message,
        `${channel} ${ticker}`,
        JSON.stringify(lastdata),
        fileBuffer
      );
    } catch (err) {
      console.error('❌ Error in controller:', err);
      throw err;
    }
  }
  @Cron('*/5 14-21 * * 1-5', { timeZone: 'UTC' })
  async runAllWatchLists() {
    const symbols = (await this.LocalPLWR.getDolist()) || [];
    const combined = [...this.mysymbols, ...symbols];
    await Promise.all([
      this.USTIMERUN(combined, this.allkeys, 'US_EARLY_5MIN', 2, '5min'),
    ]);
  }

  @Cron('*/15 14-21 * * 1-5', { timeZone: 'UTC' })
  async runAllWatL15min() {

    const symbols = (await this.LocalPLWR.getDolist()) || [];
    const combined = [...this.mysymbols, ...symbols];
    await Promise.all([
      this.USTIMERUN(combined, this.allkeys, 'US_EARLY_15MIN', 3, '15min'),
    ]);
  }
}