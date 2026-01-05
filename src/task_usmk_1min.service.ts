// src/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { WebhookService } from './webhook/webhook.service';
import { StockHelperService } from './webhook/stockHelper.service';
import { ConfigService } from '@nestjs/config';
import * as Timer from './webhook/compareTime';
import { StockData } from './webhook/dto/chartData';
import pLimit from 'p-limit';
@Injectable()
export class TasksUSMK_1MIN_Service {
  allkeys = 'all'; // test
  mysymbols = [
    'INTC',
    'SMCI',
    'BULL',
    'RDW',
    'CRWV',
    'TSLA',
    'BILL',
    'QQQ',
    'SPY',
    'SNAP',
    'BULL',
    'UNH',
    'TTD',
    'CNC',
  ]; // test symbols
  constructor(
    private readonly configService: ConfigService,
    private readonly stockHelperService: StockHelperService,
    private readonly LocalPLWR: WebhookService,
  ) {}
  private readonly logger = new Logger(TasksUSMK_1MIN_Service.name);

  async USTIMERUN(
    intickers: string[],
    api: any,
    channel,
    delay,
    timeframe = '1min',
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
    const limit = pLimit(5); // Limit the concurrency to 8 at a time

    const date = new Date();

    const washselllists =
      (await this.LocalPLWR.loadWashSellList()) ||
      this.LocalPLWR.getWashSellList();
    // Delay 2 minutes before processing
    await new Promise((resolve) => setTimeout(resolve, delay * 60 * 1000));

    // Prepare ticker promises with concurrency limit
    const tickerPromises = tickers.map((ticker) =>
      limit(async () => {
        if (washselllists.includes(ticker)) {
          console.log(`⏭️ Skipping ${ticker} — in wash sell list`);
          return; // Skip this ticker and move on
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

          // Process the data
          await this.compareAndSend(
            data,
            lastData,
            secondLastData,
            ticker,
            timeframe,
            ticker,
          );
          this.logger.log(`${ticker} processed successfully.`);
        } catch (error) {
          // Send error notification and log the error
          await this.sendDiscord(
            `ERROR ON API AT: ${timeframe} On ${date}`,
            `RLWAYBOT ${ticker} at ${timeframe}`,
            'Nono',
            'ERORR_CALL',
          );
          this.logger.error(`Error processing ${ticker}: ${error.message}`);
        }
      }),
    );

    // Wait for all ticker promises to complete concurrently (with concurrency limit)
    await Promise.all(tickerPromises);
  }
  async compareAndSend(
    data,
    lastdata,
    Secondlastdata,
    ticker,
    timeframe,
    channel,
  ) {
    const macdCrossAB_BL0 = await this.stockHelperService.macdCrossAB_BL0(
      lastdata,
      Secondlastdata,
    );
    if (macdCrossAB_BL0) {
      await this.sendDiscord(
        `BUY macdCrossAB_BL0-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        channel,
        data,
      );
      return;
    }
    const priceAbMA200BUY = await this.stockHelperService.priceAbMA200BUY(
      lastdata,
      Secondlastdata,
    );
    if (priceAbMA200BUY) {
      await this.sendDiscord(
        `BUY priceAbMA200BUY-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        channel,
        data,
      );
      return;
    }
    const priceBlMA200SELL = await this.stockHelperService.priceBlMA200SELL(
      lastdata,
      Secondlastdata,
    );
    if (priceBlMA200SELL) {
      await this.sendDiscord(
        `SELLUSLLLL priceBlMA200SELL-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        channel,
        data,
      );
      return;
    }
  }
  async sendDiscord(
    message: string,
    ticker: string,
    lastdata: any,
    channel: string,
    data?: any,
  ) {
    try {
      const fileBuffer = await this.LocalPLWR.captureChart(
        data,
        ticker,
        channel,
        message,
      );
      return await this.LocalPLWR.sendDiscordNotification(
        message,
        `${channel} ${ticker}`,
        JSON.stringify(lastdata),
        fileBuffer,
      );
    } catch (err) {
      console.error('❌ Error in controller:', err);
      throw err;
    }
  }
  @Cron('10 14-21 * * 1-5', { timeZone: 'UTC' })
  // @Cron('10 * * * * *', { timeZone: 'UTC' }) // every minute at the 10th second in UTC for testing
  async runAllWatchLists() {
    await Promise.all([
      this.USTIMERUN(this.mysymbols, this.allkeys, 'US_EARLY_5MIN', 0, '1min'),
    ]);
  }
}
