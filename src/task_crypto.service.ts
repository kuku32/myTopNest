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

  async run15Min5signal(ticker, lastdata5min, channel) {
    this.logger.log(`${ticker} run15Min5signal.`);

    const data = await this.LocalPLWR.TwReveseNOAPI(ticker, '15min');
    if(!data){
      return
    }
    const lastData = data[data.length - 1];
    if (lastData?.MACDLine > lastData?.SignalLine) {
      // 5min cross, 15 allway buy buy
      await this.sendDiscord(
        `ALL ABOVE SAFE BUY 5min (MACD5:${lastdata5min?.MACDLine})|(MACD15:${lastData?.MACDLine}): ${lastdata5min?.date}`,
        `${ticker} -ON- 5min`,
        lastdata5min,
        channel,
      );
    } else {
      await this.sendDiscord(
        `5MIN CROSS, BUT 15 RED!!!! (MACD:${lastdata5min?.MACDLine})|(MACD15:${lastData?.MACDLine}): ${lastdata5min?.date}`,
        `${ticker} -ON- 5min`,
        lastdata5min,
        channel.includes('US') ? 'US_ALL' : 'CRYPTO_ALL',
      );
    }
  }

  async run5min1signal(ticker, lastdata1min, channel) {
    this.logger.log(`${ticker} run5min1signal.`);

    const data = await this.LocalPLWR.TwReveseNOAPI(ticker, '5min');
    if(!data){
      return
    }
    const lastData = data[data.length - 1];
    if (lastData?.close > lastData?.MA200) {
      // 5min cross, 15 allway buy buy
      await this.sendDiscord(
        `5min ABOVE MA200  (MACD5:${lastdata1min?.MACDLine})|(MACD5:${lastData?.MACDLine}): ${lastdata1min?.date}`,
        `${ticker} -ON- 1min`,
        lastdata1min,
        channel,
      );
    } else if (lastData?.MACDLine > lastData?.SignalLine) {
      // 5min cross, 15 allway buy buy
      await this.sendDiscord(
        `ALL ABOVE SAFE BUY 5min (MACD5:${lastdata1min?.MACDLine})|(MACD5:${lastData?.MACDLine}): ${lastdata1min?.date}`,
        `${ticker} -ON- 1min`,
        lastdata1min,
        channel,
      );
    } else {
      await this.sendDiscord(
        `1min CROSS, BUT 5 RED!!!! (MACD:${lastdata1min?.MACDLine})|(MACD5:${lastData?.MACDLine}): ${lastdata1min?.date}`,
        `${ticker} -ON- 1min`,
        lastdata1min,
        channel.includes('US') ? 'US_ALL' : 'CRYPTO_ALL',
      );
    }
  }

  async compareAndSend(lastdata, Secondlastdata, ticker, timeframe, channel) {
    if (lastdata.close > lastdata.MA200) {
      if (
        lastdata.close > lastdata.MA200 &&
        Secondlastdata.close < Secondlastdata.MA200
      ) {
        await this.sendDiscord(
          `BUY CLOSE> MA200-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
          `${ticker} -ON- ${timeframe}`,
          lastdata,
          channel,
        );
      }
      if (
        lastdata.close > lastdata.MA200 &&
        lastdata?.MACDLine > lastdata?.SignalLine &&
        Secondlastdata?.MACDLine < Secondlastdata?.SignalLine
      ) {
        if (timeframe === '5min') {
          // check on 15min to see bullish or bearish macd
          await this.run15Min5signal(ticker, lastdata, channel);
        } else if (timeframe === '1min') {
          // check on 15min to see bullish or bearish macd
          await this.run5min1signal(ticker, lastdata, channel);
        } else {
          await this.sendDiscord(
            `BUY ON MACDCROSS-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
            `${ticker} -ON- ${timeframe}`,
            lastdata,
            channel,
          );
        }
      } else if (
        lastdata.close < lastdata.MA200 &&
        lastdata?.MACDLine < lastdata?.SignalLine &&
        Secondlastdata?.MACDLine > Secondlastdata?.SignalLine
      ) {
        await this.sendDiscord(
          `SELLLLLLLL ON-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
          `${ticker} -ON- ${timeframe}`,
          lastdata,
          'CRYPTO_ALL',
        );
      }
      // new
      const buyE = await this.earlyBuyInRSI(lastdata, Secondlastdata);
      if (buyE) {
        await this.sendDiscord(
          `BUY earlyBuyInRSI-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
          `${ticker} -ON- ${timeframe}`,
          lastdata,
          channel,
        );
      }
    }
    const sellE = await this.earlySellInRSI(lastdata, Secondlastdata);
    if (sellE) {
      await this.sendDiscord(
        `SELLLLLLLL earlySellInRSI-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker} -ON- ${timeframe}`,
        lastdata,
        'CRYPTO_ALL',
      );
    }
  }
  sendlist: string[] = [];
  async sendOneAB200(
    last: StockData,
    sym: string,
    timeframe,
  ): Promise<boolean> {
    if (last.close > last.MA200 && !this.sendlist.includes(sym)) {
      this.sendlist.push(sym);
      await this.sendDiscord(
        `AB200 BUYYYYY (MACD:${last?.MACDLine}): ${last?.date}`,
        `${sym} -ON- ${timeframe}`,
        last,
        'USSTOCK_WATCH',
      );
    }
    return last.close > last.MA200;
  }

  async earlyBuyInRSI(last: StockData, prev: StockData): Promise<boolean> {
    if (!last || !prev) return false; // safety

    const isDivergenceNegative = last.divergence != null && last.divergence < 0;
    const isRSISetup =
      last.RSI != null &&
      prev.RSI != null &&
      last.RSI < 40 &&
      last.RSI > prev.RSI;
    const isMACDRising =
      last.MACDLine != null &&
      prev.MACDLine != null &&
      last.MACDLine > prev.MACDLine;

    return (
      isDivergenceNegative &&
      isRSISetup &&
      isMACDRising &&
      last.close > last.MA200
    );
  }

  async earlySellInRSI(last: StockData, prev: StockData): Promise<boolean> {
    if (!last || !prev) return false; // safety

    const isDivergenceNegative = last.divergence != null && last.divergence > 0;
    const isRSISetup =
      last.RSI != null &&
      prev.RSI != null &&
      last.RSI > 60 &&
      last.RSI < prev.RSI;
    const isMACDRising =
      last.MACDLine != null &&
      prev.MACDLine != null &&
      last.MACDLine < prev.MACDLine;

    return isDivergenceNegative && isRSISetup && isMACDRising;
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
        fileBuffer,
      );
    } catch (err) {
      console.error('❌ Error in controller:', err);
      throw err;
    }
  }

  async wakeupcall() {
    // try {
    //   const date = new Date();
    //   await this.sendDiscord(
    //     'RAILWAY WAKEUPCALL:' + date,
    //     'RSIENDBOT 5MIN',
    //     'Nono',
    //     'CRON_CHECK',
    //   );
    //   const { data } = await axios.get(
    //     'https://mytopnest-production.up.railway.app/webhooks',
    //   );
    //   this.logger.log('⏱️ Keep-alive ping success:', data.status);
    // } catch (err) {
    //   this.logger.error(`❌ RAILWAY Keep-alive failed: ${err.message}`);
    //   this.sendDiscord(
    //     `❌ RAILWAY Keep-alive failed:`,
    //     `RSIENDBOT BOTBOT`,
    //     'Nono',
    //     'ERORR_CALL',
    //   );
    // }
  }

  async macdCrossAB(last: StockData, prev: StockData): Promise<boolean> {
    if (!last || !prev) return false; // safety
    return (
      (last.MACDLine > last.SignalLine && prev.MACDLine < prev.SignalLine) ||
      (last.divergence > 0 && prev.divergence < 0)
    );
  }
  async macdCrossBL(last: StockData, prev: StockData): Promise<boolean> {
    if (!last || !prev) return false; // safety
    return (
      (last.MACDLine < last.SignalLine && prev.MACDLine > prev.SignalLine) ||
      (last.divergence < 0 && prev.divergence > 0)
    );
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
            `RSIENDBOT ${ticker} at ${timeframe}`,
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
    const buyE = await this.macdCrossAB(lastdata, Secondlastdata);
    if (buyE) {
      await this.sendDiscord(
        `BUY macdCrossAB-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker} -ON- ${timeframe}`,
        lastdata,
        channel,
        data,
      );
    }
    const buy_earlyBuyInRSI = await this.earlyBuyInRSI(
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
    const sellE = await this.macdCrossBL(lastdata, Secondlastdata);
    if (sellE) {
      await this.sendDiscord(
        `SELLLLLLLL macdCrossBL-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker} -ON- ${timeframe}`,
        lastdata,
        'CRYPTO_ALL',
        data,
      );
    }
    const sell_earlySellInRSI = await this.earlySellInRSI(
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
  // @Cron(CronExpression.EVERY_5_MINUTES)
  // async handle30pCrypto() {
  //   await this.sendDiscord(
  //     'WAKEUPCALL:30min',
  //     'RSIENDBOT 30min',
  //     'CRYTO',
  //     'CRON_CHECK',
  //   );
  //   const tickers = [
  //     'BTCUSD',
  //     'BCHUSD',
  //     'LTCUSD',
  //     'ETHUSD',
  //     'ETCUSD',
  //     'DASHUSD',
  //     'ZECUSD',
  //     'XMRUSD',
  //     'SOLUSD',
  //     'ADAUSD',
  //     'XRPUSD',
  //     'BNBUSD',
  //     'LINKUSD',
  //     'SUIUSD',
  //     'TONUSD',
  //     'UNIUSD',
  //     'AAVEUSD',
  //     'COMPUSD',
  //     'AVAXUSD',
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
      'RSIENDBOT 30min',
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
