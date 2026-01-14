// src/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { StockHelperService } from './webhook/stockHelper.service';
import pLimit from 'p-limit';
import { WebhookService } from './webhook/webhook.service';
@Injectable()
export class TaskCryptoService_5Min {
  constructor(
    private readonly stockHelperService: StockHelperService,
    private readonly LocalPLWR: WebhookService,
  ) {}
  private readonly logger = new Logger(TaskCryptoService_5Min.name);

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
          const isWithinRange = this.LocalPLWR.checktimeMinutesEST(ticker,lastData?.date,10);
          if (!isWithinRange) {
            return;
          }
          await this.LocalPLWR.StochRSICross(
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
      'ZECUSD',
      'DOTUSD',
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
    this.logger.log('Running scheduled every 5min for CRYPTOs...');
    await this.processTickers1hour(
      tickers,
      '5min',
      'all',
      'CRYPTO_EARLY_5MIN',
      'CR_5M_HT',
      2,
    );
  }
}

