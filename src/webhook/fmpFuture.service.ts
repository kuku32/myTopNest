import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { plainToClass, plainToInstance } from 'class-transformer';
import axios from 'axios';
import { StockHelperService } from 'src/webhook/stockHelper.service';
import * as DTO from './dto';

import { ConfigService } from '@nestjs/config';
import * as dbrs from './database.api';
import * as Timer from './compareTime';
import * as puppeteer from 'puppeteer';
import pLimit from 'p-limit';
@Injectable()
export class FmpFutureService {
  private WEBHOOKS_ENV: Record<string, string>;
  private WEBHOOKS_CN: Record<string, string>;
  private keys: string[]; // Declare the keys property
  private index: number; // Declare the index property

  constructor(
    private readonly configService: ConfigService,
    private readonly stockHelperService: StockHelperService,
  ) {
    // Parse JSON from env vars
    this.WEBHOOKS_ENV = JSON.parse(
      this.configService.get<string>('WEBHOOKS_ENV_MAP') ||
        '{"Other":"DISCORD_WEBHOOKS"}',
    );
    this.WEBHOOKS_CN = JSON.parse(
      this.configService.get<string>('WEBHOOKS_CN_MAP') || '{"Other":"Other"}',
    );
    this.keys = this.configService.get<any>('twelvedata').split(',');

  }
  async getTickerFullChart_FMP(ticker: string, timeframe: string) {
    let BASE_URL = ``;
    const daytestBF = 0;
    const dayend = this.stockHelperService.getDateNDaysAgo(-1 + daytestBF);
    let dayStart;
    if (timeframe.includes('day')) {
      dayStart = this.stockHelperService.getDateNDaysAgo(450 + daytestBF);
      console.log(dayStart)
      BASE_URL = `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${ticker}&from=${dayStart}&to=${dayend}&apikey=`;
    } else {
      if (timeframe.includes('4hour')) {
        dayStart = this.stockHelperService.getDateNDaysAgo(120 + daytestBF);
      } else if (timeframe.includes('1hour')) {
        dayStart = this.stockHelperService.getDateNDaysAgo(55 + daytestBF);
      } else if (timeframe.includes('15min')) {
        dayStart = this.stockHelperService.getDateNDaysAgo(20 + daytestBF);
      } else if (timeframe.includes('5min')) {
        dayStart = this.stockHelperService.getDateNDaysAgo(7 + daytestBF);
      } 
      BASE_URL = `https://financialmodelingprep.com/stable/historical-chart/${timeframe}?symbol=${ticker}&from=${dayStart}&to=${dayend}&apikey=`;
    } 

    // let BASE_URL = `https://financialmodelingprep.com/api/v3/historical-chart/${timeframe}/${ticker}?from=${dayStart}&to=${dayend}&apikey=`;


    const response = await this.tryCatchF(BASE_URL, 'FMP_STOCK_API_KEY');

    return response;
    const result = await this.stockHelperService.returnNewData(response.reverse());
    console.log(result.length)
    return result;
    return result.slice(-20);
  }

  async get_Dividends_FMP() {
    const daytestBF = 0;
    const dayend = this.stockHelperService.getDateNDaysAgo(-30 + daytestBF);
    let dayStart = this.stockHelperService.getDateNDaysAgo(10 + daytestBF);;
    let BASE_URL = `https://financialmodelingprep.com/stable/dividends-calendar?from=${dayStart}&to=${dayend}&apikey=`;

    const response = await this.tryCatchF(BASE_URL, 'FMP_STOCK_API_KEY');

    return response;
    const result = await this.stockHelperService.returnNewData(response.reverse());
    console.log(result.length)
    return result;
    return result.slice(-20);
  }

  async tryCatchF(BASE_URL: string, keyDATA: string, ticker?:any) {
    const key = this.configService.get<any>(keyDATA);
      const url = `${BASE_URL}${key}`;
      console.log(url);
      try {
        const response = await axios.get(url);
        return response.data;
      } catch (error) {
        if (error?.response && error?.response?.status === 500) {

          // Handle 500 error
          console.error(`Internal Server Error with key `);
        } else {
          if(error?.response?.status === 402){
                      // Handle other errors
          console.log('I want to store in file',ticker)
          console.error(`Error with key ${key.substring(0, 4)} `);
          }
        }
      }
    return null;
  }
}
