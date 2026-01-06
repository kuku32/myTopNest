// src/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { StockHelperService } from './webhook/stockHelper.service';
import pLimit from 'p-limit';
import { WebhookService } from './webhook/webhook.service';
@Injectable()
export class TaskCryptoService_1Hour {
  constructor(
    private readonly stockHelperService: StockHelperService,
    private readonly LocalPLWR: WebhookService,
  ) {}
  private readonly logger = new Logger(TaskCryptoService_1Hour.name);

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

  private async processTickers1hour(
    tickers: string[],
    timeframe: string,
    apikey: string,
    channel: string,
    delay = 5,
  ) {
    const limit = pLimit(1); // Limit the concurrency to 5 at a time

    const date = new Date();
    const washselllists =
      (await this.LocalPLWR.loadWashSellList()) ||
      this.LocalPLWR.getWashSellList();

    // Delay 2 minutes before processing (optional)
    await new Promise((resolve) => setTimeout(resolve, delay * 60 * 1000));

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
          await this.compareAndSend1hour(
            data,
            lastData,
            secondLastData,
            ticker,
            timeframe,
            channel,
          );
          this.logger.log(`${ticker} processed successfully.`);
        } catch (error) {
          await this.sendDiscord(
            `ERROR ON API AT: ${timeframe} On ${date}: ${JSON.stringify(
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
    channel,
  ) {
    if (timeframe === '4h' || timeframe === '1day') {
      await this.sendDiscord(
        `JUST WATCH_ME-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        channel,
        data,
      );
    }
    const macdCrossAB_BL0 = await this.stockHelperService.macdCrossAB_BL0(
      lastdata,
      Secondlastdata,
    );
    if (macdCrossAB_BL0) {
      await this.sendDiscord(
        `BUY macdCrossAB_BL0-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        'CRYPTO_EARLY_5MIN',
        data,
      );
      return;
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
        'CRYPTO_EARLY_5MIN',
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
        `SELLCRLLLL priceBlMA200SELL-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        'CRYPTO_EARLY_5MIN',
        data,
      );
      return;
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
        'CRYPTO_EARLY_15MIN',
        data,
      );
      return;
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
        'CRYPTO_EARLY_15MIN',
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
        `SELLCRLLLL macdCrossBL-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        'CRYPTO_ALL',
      );
      return;
    }
    const earlySellInRSI = await this.stockHelperService.earlySellInRSI(
      lastdata,
      Secondlastdata,
    );
    if (earlySellInRSI) {
      await this.sendDiscord(
        `SELLCRLLLL earlySellInRSI-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        'CRYPTO_ALL',
      );
      return;
    }
  }

  @Cron('0 * * * *') // every 1 hour
  async handle1hourCrypto() {
    const tickers = [
      'BTCUSD',
      'BCHUSD',
      'LTCUSD',
      'ETHUSD',
      'ETCUSD',
      'DASHUSD',
      'ZECUSD',
      'XMRUSD',
    ];
    // const tickers = ['BTCUSD'];
    const apikey = '2711824a92bc40498c8bc30728813e2a'; //liamsterling1@outlook.com
    this.logger.log('Running scheduled every 1 hour for CRYPTOs...');
    await this.processTickers1hour(
      tickers,
      '1h',
      apikey,
      'CRYPTO_EARLY_15MIN',
      5,
    );
  }
  @Cron('0 * * * *') // every 1 hour
  async handle1hourCrypto1() {
    const tickers = ['SOLUSD', 'ADAUSD', 'XRPUSD', 'BNBUSD', 'LINKUSD'];
    // const tickers = ['BTCUSD'];
    const apikey = 'd3058ae5683b4fc19a787ceb21a87f67';
    this.logger.log('Running scheduled every 1 hour for CRYPTOs...');
    await this.processTickers1hour(
      tickers,
      '1h',
      apikey,
      'CRYPTO_EARLY_15MIN',
      6,
    );
  }
  @Cron('0 * * * *') // every 1 hour
  async handle1hourCrypto2() {
    const tickers = [
      'SUIUSD',
      'TONUSD',
      'UNIUSD',
      'AAVEUSD',
      'COMPUSD',
      'AVAXUSD',
    ];
    const apikey = 'd3058ae5683b4fc19a787ceb21a87f67';
    this.logger.log('Running scheduled every 1 hour for CRYPTOs...');
    await this.processTickers1hour(
      tickers,
      '1h',
      apikey,
      'CRYPTO_EARLY_15MIN',
      5,
    );
  }
}

export interface StockData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  MA5: number;
  MA10: number;
  MA20: number;
  MA50: number;
  MA100: number;
  MA200: number;
  RSI: number;
  MACDLine: number;
  SignalLine: number;
  divergence: number;
  MACDDivergence: any;
}
