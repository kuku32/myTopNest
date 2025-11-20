import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { plainToClass, plainToInstance } from 'class-transformer';
import axios from 'axios';
import { StockHelperService } from 'src/webhook/stockHelper.service';
import * as DTO from './dto';
@Injectable()
export class WebhookService {
  async get12for(
    ticker: string,
    timefame: string,
    apikey
  ) {
    try {
      if(ticker.includes('USD')){
        ticker = this.stockHelperService.formatSymbol(ticker)
      }
      let BASE_URL = `https://api.twelvedata.com/time_series?symbol=${ticker}&interval=${timefame}&outputsize=400&dp=2&apikey=${apikey}`;
      const response = await axios.get(BASE_URL);
      if (response.data.status === 'error') {
        throw new Error('API returned error status');
      }
      else if (response.data.status == 'ok') {
        const responseRe =  response.data.values;
        const reversedData = [...responseRe].reverse(); // clone + reverse
        const dataOut = plainToInstance(DTO.ChartOutTwelveData, reversedData, {
          excludeExtraneousValues: true,
        })
        const newData = await this.stockHelperService.returnNewData(dataOut);
        return newData;
      }
    } catch (error) {
      console.error(`Error with key ${apikey.slice(0, 4)}...:`, error?.response?.status || error.message);
    }
  }
    constructor(
        private readonly stockHelperService: StockHelperService,
      ) {}

  async sendTemporaryWebhook(msg, ticker: any,  data, discordChanel: string='TSLA',) {
    const botname = `${discordChanel} ${ticker}`;
    const payload = {
      botname: botname,
      message: msg,
      lastdata: JSON.stringify(data),
    };
    const rootapi  = `https://nestjs-api.koyeb.app`
    // const rootapi  =  "http://localhost:3000"
    try {
      const res = await axios.post(`${rootapi}/webhooks/temporary`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      return res.data; // same as await res.json()
    } catch (error) {
      console.error('❌ Error sending webhook:', error.response?.data || error.message);
      throw error;
    }
  }


  private readonly apiUrl = 'https://api.livecoinwatch.com/coins/single/history';
  private readonly apiKey = '66f75cb5-17b5-4cf7-bb09-9e161fde19fc';
  async getCoinHistory(
    code: string,
    interval: string,
    currency = 'USD',
    meta = true,
    totalCandles = 300, // desired number of candles
  ) {
    try {
      // 1️⃣ Define interval in minutes
      let intervalMinutes = 1;
      switch (interval) {
        case '5m':
          intervalMinutes = 5;
          break;
        case '15m':
          intervalMinutes = 15;
          break;
        case '30m':
          intervalMinutes = 30;
          break;
        default:
          intervalMinutes = 1;
      }

      const intervalMs = intervalMinutes * 60 * 1000;
      const maxCandlesPerRequest = 100; // LiveCoinWatch max per request
      const allData = [];

      let endTimestamp = Date.now();

      while (allData.length < totalCandles) {
        const remainingCandles = totalCandles - allData.length;
        const candlesThisRequest = Math.min(maxCandlesPerRequest, remainingCandles);
        const startTimestamp = endTimestamp - intervalMs * candlesThisRequest;

        // Fetch batch
        const response = await axios.post(
          this.apiUrl,
          {
            currency,
            code,
            start: startTimestamp,
            end: endTimestamp,
            meta,
          },
          {
            headers: {
              'content-type': 'application/json',
              'x-api-key': this.apiKey,
            },
          },
        );

        const data = response.data?.history || [];
        if (data.length === 0) break; // stop if no more data

        // Prepend to maintain chronological order
        allData.unshift(...data);

        // Prepare next batch
        endTimestamp = startTimestamp;
      }

      // Transform to DTO
      const reversedData = [...allData]; // clone + reverse
      const date = new Date()
      console.log('runlocal.service.ts-425',code,date)
      const dataOut = plainToInstance(DTO.CoinHistoryDto, reversedData, {
        excludeExtraneousValues: true,
      })
        // 2️⃣ Process data with your helper
      const newData = await this.stockHelperService.returnNewData(dataOut);
        //         // 3️⃣ Get the last two data points
      const returndata = newData.reverse();
                // const lastData = newData[0];
                // const secondLastData = newData[1];
                // console.log('runlocal.service.ts-434',lastData,secondLastData)
      return returndata
    } catch (error: any) {
      throw new HttpException(
        error.response?.data || error.message,
        error.response?.status || HttpStatus.BAD_REQUEST,
      );
    }
  }
}
