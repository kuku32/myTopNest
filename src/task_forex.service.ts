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

        await this.LocalPLWR.StochRSICross(
          data.reverse(),
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
        this.LocalPLWR.sendDiscord(
          `ERROR ON TasksForexService: ${timeframe} On ${date}: ${JSON.stringify(
            error,
          )}`,
          `RLWAYBOT ${ticker} at ${timeframe}`,
          'Nono',
          'ERORR_CALL',
        );
        this.logger.error(`Error processing ${ticker}: ${error.message}`);
      }
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
