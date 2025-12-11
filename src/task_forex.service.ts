// src/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { WebhookService } from './webhook/webhook.service';
import { StockHelperService } from './webhook/stockHelper.service';

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

  private async processTickers1hour(
    tickers: string[],
    timeframe: string,
    apikey,
    buyChannel,
    sellChannel,
    delay = 5,
  ) {
    if (!this.stockHelperService.isForexMarketOpen()) {
      this.logger.log(`🕒 Forex market is CLOSED`);
      return;
    }
    const date = new Date();
    const equal = `===========================================`;
    await this.LocalPLWR.sendDiscordNotification(
      `${equal}START-${date}${equal}`,
      `${sellChannel} RWBOT`,
      JSON.stringify('lastdata'),
    );
    this.logger.log(`✅ Forex market is OPEN`);
    // Delay 2 minutes before processing
    await new Promise((resolve) => setTimeout(resolve, delay * 60 * 1000));
    for (const ticker of tickers) {
      try {
        let data = await this.LocalPLWR.tiingo(ticker, timeframe, apikey);
        const lastData = data[0];
        const secondLastData = data[1];
        // const lastData = data[data.length - 1];
        // const secondLastData = data[data.length - 2];

        await this.compareAndSend1hour(
          lastData,
          secondLastData,
          ticker,
          timeframe,
          buyChannel,
          sellChannel,
        );
        this.logger.log(`${ticker} processed successfully.`);
      } catch (error) {
        const date = new Date();
        this.sendDiscord(
          `ERROR ON TasksForexService: ${timeframe} On ${date}: ${JSON.stringify(
            error,
          )}`,
          `RWBOT ${ticker} at ${timeframe}`,
          'Nono',
          'ERORR_CALL',
        );
        this.logger.error(`Error processing ${ticker}: ${error.message}`);
      }
    }
  }
  async compareAndSend1hour(
    lastdata,
    Secondlastdata,
    ticker,
    timeframe,
    buyChannel,
    sellChannel,
  ) {
    const buyE = await this.stockHelperService.macdCrossAB(
      lastdata,
      Secondlastdata,
    );
    if (buyE) {
      await this.sendDiscord(
        `BUY macdCrossAB-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker} -ON- ${timeframe}`,
        lastdata,
        buyChannel,
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
        buyChannel,
      );
    }
    const sellE = await this.stockHelperService.macdCrossBL(
      lastdata,
      Secondlastdata,
    );
    if (sellE) {
      await this.sendDiscord(
        `SELLLLLLLL macdCrossBL-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker} -ON- ${timeframe}`,
        lastdata,
        sellChannel,
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
        sellChannel,
      );
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
