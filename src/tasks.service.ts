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
export class TasksService {
  allkeys = 'all'; // test
  constructor(
    private readonly configService: ConfigService,
    private readonly stockHelperService: StockHelperService,
    private readonly LocalPLWR: WebhookService,
  ) {
    setInterval(async () => {
      this.sendlist = [];
      console.log('sendlist reset');
      this.LocalPLWR.dolist = []
      await this.LocalPLWR.getRsilist('sp5_ma200ab_less_0_1', 50)
      await this.LocalPLWR.getRsilist('sp5_ma200bl_over_neg_0_1',30)
      await this.LocalPLWR.getRsilist('sp5_ma200ab_less_0_5',10)
    }, 8 * 60 * 60 * 1000); // 4 hours in milliseconds
  }
  private readonly logger = new Logger(TasksService.name);

  // US STOCK

  @Cron('*/5 14-21 * * 1-5', { timeZone: 'UTC' })
  async runAllWatchLists() {
    const symbols = (await this.LocalPLWR.getDolist()) || [];
    await Promise.all([
      this.USTIMERUN(symbols, this.allkeys, 'US_EARLY_5MIN', 2, '5min'),
    ]);
  }

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

        await this.compareAndSend(
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
          `RWBOT ${ticker} at ${timeframe}`,
          'Nono',
          'ERORR_CALL',
        );
        this.logger.error(`Error processing ${ticker}: ${error.message}`);
      }
    }
  }

  async run15Min5signal(ticker, lastdata5min, channel) {
    this.logger.log(`${ticker} run15Min5signal.`);

    const data = await this.LocalPLWR.TwReveseNOAPI(ticker, '15min');

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
    const isWithinRange = Timer.checkIfWithin5MinutesEST(lastdata?.date);
    if (isWithinRange) {
      console.log(ticker, '✅ Within ±7 minutes of EST time');
      // check one
      // await this.sendOneAB200(lastdata, ticker, timeframe)
    } else {
      console.log(ticker, '❌ Outside ±7 minutes of EST time', lastdata?.date);
      // await this.sendDiscord(
      //   '❌ Outside ±7 minutes of EST time',
      //   'RWBOT:' + ticker,
      //   'CRYTO',
      //   'CRON_CHECK',
      // );
      return;
    }
    if (
      lastdata.close > lastdata.MA200 &&  Secondlastdata.close < Secondlastdata.MA200
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
      }  else if (timeframe === '1min') {
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
        'CRYPTO_WATCH',
      );
    }
    // new 
    const buyE = await this.earlyBuyInRSI(lastdata, Secondlastdata)
    if(buyE){
      await this.sendDiscord(
        `BUY earlyBuyInRSI-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker} -ON- ${timeframe}`,
        lastdata,
        channel,
      );
    }

    const sellE = await this.earlySellInRSI(lastdata, Secondlastdata)
    if(sellE){
      await this.sendDiscord(
        `SELLLLLLLL earlySellInRSI-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker} -ON- ${timeframe}`,
        lastdata,
        'CRYPTO_WATCH',
      );
    }
  }
  sendlist = []
  async sendOneAB200(last: StockData, sym:string, timeframe): Promise<boolean> {
    if(last.close > last.MA200 && !this.sendlist.includes(sym)){
      this.sendlist.push(sym)
      await this.sendDiscord(
        `AB200 BUYYYYY (MACD:${last?.MACDLine}): ${last?.date}`,
        `${sym} -ON- ${timeframe}`,
        last,
        'USSTOCK_WATCH',
      );
    }
    return  last.close > last.MA200;
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

    return isDivergenceNegative && isRSISetup && isMACDRising && last.close > last.MA200;
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
  ) {
    try {
      return await this.LocalPLWR.sendDiscordNotification(
        'KOYEB_SP500 ' + message,
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
        'KOYEB_SP500 WAKEUPCALL:' + date,
        'RWBOT 5MIN',
        'Nono',
        'CRON_CHECK',
      );
      const { data } = await axios.get(
        'https://mytopnest-production.up.railway.app/webhooks',
      );
      this.logger.log('⏱️ Keep-alive ping success:', data.status);
    } catch (err) {
      this.logger.error(`❌ KOYEB_SP500 Keep-alive failed: ${err.message}`);
      this.sendDiscord(
        `❌ KOYEB_SP500 Keep-alive failed:`,
        `RWBOT BOTBOT`,
        'Nono',
        'ERORR_CALL',
      );
    }
  }

  // @Cron('*/1 14-21 * * 1-5', { timeZone: 'UTC' })
  // @Cron(CronExpression.EVERY_5_MINUTES)
  // async minuteQQQ(){
  //   // const symbols = (await this.LocalPLWR.getDolist()) || [];
  //   this.wakeupcall()
  // }
}
