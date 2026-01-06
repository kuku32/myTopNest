// src/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { StockHelperService } from './webhook/stockHelper.service';
import pLimit from 'p-limit';
import { WebhookService } from './webhook/webhook.service';
@Injectable()
export class TaskCryptoService {
  constructor(
    private readonly stockHelperService: StockHelperService,
    private readonly LocalPLWR: WebhookService,
  ) {}
  private readonly logger = new Logger(TaskCryptoService.name);

  private async processTickers1hour(
    tickers: string[],
    timeframe: string,
    apikey: string,
    B_Channel,
    HT_Channel,
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
          await this.LocalPLWR.compareAndSend1hour(
            data,
            lastData,
            secondLastData,
            ticker,
            timeframe,
            B_Channel,
            HT_Channel,
          );
          this.logger.log(`${ticker} processed successfully.`);
        } catch (error) {
          await this.LocalPLWR.sendDiscord(
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
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handle5pCrypto() {
    const tickers = [
      'BTCUSD',
      'BCHUSD',
      'LTCUSD',
      'ETHUSD',
      'ETCUSD',
      'DASHUSD',
      'ZECUSD',
      'XMRUSD',
      'SOLUSD',
      'XRPUSD',
      'BNBUSD',
      'LINKUSD',
      'SUIUSD',
      'TONUSD',
      'UNIUSD',
      'AAVEUSD',
      'COMPUSD',
      'AVAXUSD',
    ];
    this.logger.log('Running scheduled every 30min for CRYPTOs...');
    await this.processTickers1hour(
      tickers,
      '5min',
      'all',
      'CRYPTO_EARLY_5MIN',
      'CR_5M_HT',
      1,
    );
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handle30pCrypto() {
    await this.LocalPLWR.sendDiscord(
      'WAKEUPCALL:30min',
      'RLWAYBOT 30min',
      'CRYTO',
      'CRON_CHECK',
    );
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
    this.logger.log('Running scheduled every 30min for CRYPTOs...');
    await this.processTickers1hour(
      tickers,
      '30min',
      apikey,
      'CR_30M_BUY',
      'CR_30MIN_HT',
      3,
    );
  }
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handle30minCrypto1() {
    const tickers = ['SOLUSD', 'ADAUSD', 'XRPUSD', 'BNBUSD', 'LINKUSD'];
    const apikey = 'd3058ae5683b4fc19a787ceb21a87f67';
    this.logger.log('Running scheduled every 30min for CRYPTOs...');
    await this.processTickers1hour(
      tickers,
      '30min',
      apikey,
      'CR_30M_BUY',
      'CR_30MIN_HT',
      3,
    );
  }
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handle30minCrypto2() {
    const tickers = [
      'SUIUSD',
      'TONUSD',
      'UNIUSD',
      'AAVEUSD',
      'COMPUSD',
      'AVAXUSD',
    ];
    const apikey = 'd3058ae5683b4fc19a787ceb21a87f67';
    this.logger.log('Running scheduled every 30min for CRYPTOs...');
    await this.processTickers1hour(
      tickers,
      '30min',
      apikey,
      'CR_30M_BUY',
      'CR_30MIN_HT',
      4,
    );
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
      'CR_1H_BUY',
      'CR_1H_HT',
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
      'CR_1H_BUY',
      'CR_1H_HT',
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
      'CR_1H_BUY',
      'CR_1H_HT',
      5,
    );
  }

  @Cron('8 */4 * * *') // Every 4 hours at minute 8
  async handle4hourCrypto2() {
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
      '4h',
      apikey,
      'CR_4H_BUY',
      'CR_4H_HT',
      0,
    );
  }
  @Cron('10 */4 * * *') // Every 4 hours at minute 10
  async handle4hourCrypto3() {
    const tickers = ['SOLUSD', 'ADAUSD', 'XRPUSD', 'BNBUSD', 'LINKUSD'];
    // const tickers = ['BTCUSD'];
    const apikey = '2711824a92bc40498c8bc30728813e2a'; //liamsterling1@outlook.com
    this.logger.log('Running scheduled every 1 hour for CRYPTOs...');
    await this.processTickers1hour(
      tickers,
      '4h',
      apikey,
      'CR_4H_BUY',
      'CR_4H_HT',
      0,
    );
  }
  @Cron('12 */4 * * *') // Every 4 hours at minute 12
  async handle4hourCrypto4() {
    const tickers = [
      'SUIUSD',
      'TONUSD',
      'UNIUSD',
      'AAVEUSD',
      'COMPUSD',
      'AVAXUSD',
    ];
    // const tickers = ['BTCUSD'];
    const apikey = '2711824a92bc40498c8bc30728813e2a'; //liamsterling1@outlook.com
    this.logger.log('Running scheduled every 1 hour for CRYPTOs...');
    await this.processTickers1hour(
      tickers,
      '4h',
      apikey,
      'CR_4H_BUY',
      'CR_4H_HT',
      0,
    );
  }

  @Cron('14 1 * * *') // Every day at 1:14 AM
  async handledailyCrypto() {
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
      '1day',
      apikey,
      'CRYPTO_WATCH',
      'CRYPTO_ALL',
      0,
    );
  }
  @Cron('16 1 * * *') // Every day at 1:16 AM
  async handledailyCrypto1() {
    const tickers = ['SOLUSD', 'ADAUSD', 'XRPUSD', 'BNBUSD', 'LINKUSD'];
    // const tickers = ['BTCUSD'];
    const apikey = '2711824a92bc40498c8bc30728813e2a'; //liamsterling1@outlook.com
    this.logger.log('Running scheduled every 1 hour for CRYPTOs...');
    await this.processTickers1hour(
      tickers,
      '1day',
      apikey,
      'CRYPTO_WATCH',
      'CRYPTO_ALL',
      0,
    );
  }
  @Cron('18 1 * * *') // Every day at 1:18 AM
  async handledailyCrypto2() {
    const tickers = [
      'SUIUSD',
      'TONUSD',
      'UNIUSD',
      'AAVEUSD',
      'COMPUSD',
      'AVAXUSD',
    ];
    // const tickers = ['BTCUSD'];
    const apikey = '2711824a92bc40498c8bc30728813e2a'; //liamsterling1@outlook.com
    this.logger.log('Running scheduled every 1 hour for CRYPTOs...');
    await this.processTickers1hour(
      tickers,
      '1day',
      apikey,
      'CRYPTO_WATCH',
      'CRYPTO_ALL',
      0,
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
