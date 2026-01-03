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
    const limit = pLimit(8); // Limit the concurrency to 5 at a time

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
    const buyE = await this.stockHelperService.macdCrossAB(lastdata, Secondlastdata);
    if (buyE) {
      await this.sendDiscord(
        `BUY macdCrossAB-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker} -ON- ${timeframe}`,
        lastdata,
        channel,
        data,
      );
    }
    const buy_earlyBuyInRSI = await this.stockHelperService.earlyBuyInRSI(
      lastdata,
      Secondlastdata,
    );
    if (buy_earlyBuyInRSI) {
      await this.sendDiscord(
        `BUY earlyBuyInRSI-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker} -ON- ${timeframe}`,
        lastdata,
        channel,
        data,
      );
    }
    const sellE = await this.stockHelperService.macdCrossBL(lastdata, Secondlastdata);
    if (sellE) {
      await this.sendDiscord(
        `SELLLLLLLL macdCrossBL-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker} -ON- ${timeframe}`,
        lastdata,
        'CRYPTO_ALL',
        data,
      );
    }
    const sell_earlySellInRSI = await this.stockHelperService.earlySellInRSI(
      lastdata,
      Secondlastdata,
    );
    if (sell_earlySellInRSI) {
      await this.sendDiscord(
        `SELLLLLLLL sell_earlySellInRSI-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker} -ON- ${timeframe}`,
        lastdata,
        'CRYPTO_ALL',
        data,
      );
    }
  }
  // @Cron(CronExpression.EVERY_10_SECONDS)
  // async handle30pCrypto() {
  //   await this.sendDiscord(
  //     'WAKEUPCALL:30min',
  //     'RLWAYBOT 30min',
  //     'CRYTO',
  //     'CRON_CHECK',
  //   );
  //   const tickers = [
  //     'BCHUSD',
  //   ];
  //   // const tickers = ['BTCUSD'];
  //   const apikey = '2711824a92bc40498c8bc30728813e2a'; //liamsterling1@outlook.com
  //   this.logger.log('Running scheduled every 30min for CRYPTOs...');
  //   await this.processTickers1hour(
  //     tickers,
  //     '30min',
  //     'all',
  //     'CRYPTO_EARLY_15MIN',
  //     0,
  //   );
  // }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handle30pCrypto() {
    await this.sendDiscord(
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
      'CRYPTO_EARLY_15MIN',
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
      'CRYPTO_EARLY_15MIN',
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
      'CRYPTO_EARLY_15MIN',
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
      'CRYPTO_EARLY_15MIN',
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
      'CRYPTO_EARLY_15MIN',
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
      'CRYPTO_EARLY_15MIN',
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
      'CRYPTO_EARLY_15MIN',
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
      'CRYPTO_EARLY_15MIN',
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
      'CRYPTO_EARLY_15MIN',
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
