// src/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { WebhookService } from './webhook/webhook.service';
import { StockHelperService } from './webhook/stockHelper.service';
import pLimit from 'p-limit';
@Injectable()
export class TasksForexService {
  constructor(
    private readonly stockHelperService: StockHelperService,
    private readonly LocalPLWR: WebhookService,
  ) {}
  private readonly logger = new Logger(TasksForexService.name);
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
  private async processTickers1hour(
    tickers: string[],
    timeframe: string,
    apikey: string,
    buyChannel: string,
    sellChannel: string,
    delay = 5,
  ) {
    const limit = pLimit(2); // Limit the concurrency to 8 at a time

    // Check if the forex market is open
    if (!this.stockHelperService.isForexMarketOpen()) {
      this.logger.log(`🕒 Forex market is CLOSED`);
      return;
    }
    this.logger.log(`✅ Forex market is OPEN`);

    // Delay before processing
    await new Promise((resolve) => setTimeout(resolve, delay * 60 * 1000));

    // Prepare for the concurrency limit and processing tickers
    const date = new Date();
    const washselllists =
      (await this.LocalPLWR.loadWashSellList()) ||
      this.LocalPLWR.getWashSellList();

    // Map through tickers and limit concurrency
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
          await this.compareAndSend1hour(
            data.reverse(), // Reverse data if necessary
            lastData,
            secondLastData,
            ticker,
            timeframe,
            buyChannel,
            sellChannel,
          );
          this.logger.log(`${ticker} processed successfully.`);
        } catch (error) {
          // Send error notification and log the error
          await this.sendDiscord(
            `ERROR ON TasksForexService: ${timeframe} On ${date}: ${JSON.stringify(
              error,
            )}`,
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
  async compareAndSend1hour(
    data,
    lastdata,
    Secondlastdata,
    ticker,
    timeframe,
    buyChannel,
    sellChannel,
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
        buyChannel,
        data,
      );
      return
    }
    const macdCrossAB = await this.stockHelperService.macdCrossAB(
      lastdata,
      Secondlastdata,
    );
    if (macdCrossAB) {
      await this.sendDiscord(
        `BUY macdCrossAB-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        buyChannel,
        data,
      );
      return
    }
    const earlyBuyInRSI = await this.stockHelperService.earlyBuyInRSI(
      lastdata,
      Secondlastdata,
    );
    if (earlyBuyInRSI) {
      await this.sendDiscord(
        `BUY earlyBuyInRSI-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        buyChannel,
        data,
      );
      return;
    }
    const macdCrossBL = await this.stockHelperService.macdCrossBL(
      lastdata,
      Secondlastdata,
    );
    if (macdCrossBL) {
      await this.sendDiscord(
        `SELLLLLLLL macdCrossBL-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        sellChannel,
        data,
      );
      return
    }
    const earlySellInRSI = await this.stockHelperService.earlySellInRSI(
      lastdata,
      Secondlastdata,
    );
    if (earlySellInRSI) {
      await this.sendDiscord(
        `SELLLLLLLL sell_earlySellInRSI-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        sellChannel,
        data,
      );
      return
    }
    const priceAbMA200BUY = await this.stockHelperService.priceAbMA200BUY(
      lastdata,
      Secondlastdata,
    );
    if (priceAbMA200BUY) {
      // add to uplist and delete out downlist
      await this.sendDiscord(
        `BUY priceAbMA200BUY-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        buyChannel,
        data,
      );
      return
    }
    const priceBlMA200SELL = await this.stockHelperService.priceBlMA200SELL(
      lastdata,
      Secondlastdata,
    );
    if (priceBlMA200SELL) {
      await this.sendDiscord(
        `SELLLLLLLL priceBlMA200SELL-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        sellChannel,
        data,
      );
      return;
    }
  }

  @Cron('*/15 * * * *') // every 15 minutes
  async handle15minForex() {
    const tickers = [
      'CHFUSD',
      'EURUSD',
      'CADUSD',
      'AUDUSD',
      'GBPUSD',
      'JPYUSD',
      'NZDUSD',
    ];
    // const tickers = ['EURUSD'];
    await this.processTickers1hour(
      tickers,
      '15min',
      '54c43c0fc7b27681254eeac1d7138d6b5477cf10',
      '15MIN_BUY_FX',
      '15MIN_SELL_FX',
      3,
    );
  }
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handle30minForex() {
    const tickers = [
      'CHFUSD',
      'EURUSD',
      'CADUSD',
      'AUDUSD',
      'GBPUSD',
      'JPYUSD',
      'NZDUSD',
    ];
    // const tickers = ['EURUSD'];
    await this.processTickers1hour(
      tickers,
      '30min',
      '5f7e0b2da2b5c849dfd5a3dc7938b82c02a7c6f4',
      '30MIN_BUY_FX',
      '30MIN_SELL_FX',
      3,
    );
  }
  @Cron('0 * * * *') // every 1 hour
  async handle1hourForex() {
    const tickers = [
      'CHFUSD',
      'EURUSD',
      'CADUSD',
      'AUDUSD',
      'GBPUSD',
      'JPYUSD',
      'NZDUSD',
    ];
    // const tickers = ['EURUSD'];
    await this.processTickers1hour(
      tickers,
      '1hour',
      '5f7e0b2da2b5c849dfd5a3dc7938b82c02a7c6f4',
      '1HOUR_BUY_FX',
      '1HOUR_SELL_FX',
      3,
    );
  }
  @Cron(CronExpression.EVERY_4_HOURS)
  async handle4hourForex() {
    const tickers = [
      'CHFUSD',
      'EURUSD',
      'CADUSD',
      'AUDUSD',
      'GBPUSD',
      'JPYUSD',
      'NZDUSD',
    ];
    // const tickers = ['EURUSD'];
    await this.processTickers1hour(
      tickers,
      '4hour',
      '5f7e0b2da2b5c849dfd5a3dc7938b82c02a7c6f4',
      '4HOUR_BUY_FX',
      '4HOUR_SELL_FX',
      3,
    );
  }
}
