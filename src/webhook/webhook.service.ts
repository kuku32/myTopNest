import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { plainToClass, plainToInstance } from 'class-transformer';
import axios from 'axios';
import { StockHelperService } from 'src/webhook/stockHelper.service';
import * as DTO from './dto';
import { AttachmentBuilder, EmbedBuilder, WebhookClient } from 'discord.js';
import { ConfigService } from '@nestjs/config';
import * as dbrs from './database.api';
import * as Timer from './compareTime';
import * as puppeteer from 'puppeteer';
import pLimit from 'p-limit';
@Injectable()
export class WebhookService {
  getHello() {
    return {
      mess: 'Hello World Email!',
      status: 'ok',
      time: new Date().toISOString(),
    };
  }
  private webhookClient: WebhookClient;
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
    this.index = this.getRandomNumber(this.keys.length - 1);
  }
  async get12for(ticker: string, timefame: string, apikey) {
    try {
      if (ticker.includes('USD')) {
        ticker = this.stockHelperService.formatSymbol(ticker);
      }
      let BASE_URL = `https://api.twelvedata.com/time_series?symbol=${ticker}&interval=${timefame}&outputsize=400&dp=2&apikey=${apikey}`;
      const response = await axios.get(BASE_URL);
      if (response.data.status === 'error') {
        throw new Error('API returned error status');
      } else if (response.data?.status == 'ok') {
        // us stock     "exchange_timezone": "America/New_York", ChartOutTwelveData
        // btc don't turn to ChartOutTwelveDataUTC
        const meta_timezone = response.data.meta.exchange_timezone;
        const responseRe = response.data.values;
        const reversedData = [...responseRe].reverse(); // clone + reverse
        let dataOut;
        if (meta_timezone) {
          dataOut = plainToInstance(DTO.ChartOutTwelveData, reversedData, {
            excludeExtraneousValues: true,
          });
        } else if (!meta_timezone) {
          dataOut = plainToInstance(DTO.ChartOutTwelveDataUTC, reversedData, {
            excludeExtraneousValues: true,
          });
        }
        const newData = await this.stockHelperService.returnNewData(dataOut);
        return newData;
      }
    } catch (error) {
      console.error(
        `Error with key ${apikey.slice(0, 4)}...:`,
        error?.response?.status || error.message,
      );
    }
  }

  async sendTemporaryWebhook(
    msg,
    ticker: any,
    data,
    discordChanel: string = 'TSLA',
  ) {
    const botname = `${discordChanel} ${ticker}`;
    const payload = {
      botname: botname,
      message: msg,
      lastdata: JSON.stringify(data),
    };
    const rootapi = `https://nestjs-api.koyeb.app`;
    // const rootapi  =  "http://localhost:3000"
    try {
      const res = await axios.post(`${rootapi}/webhooks/temporary`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      return res.data; // same as await res.json()
    } catch (error) {
      console.error(
        '❌ Error sending webhook:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  private readonly apiUrl =
    'https://api.livecoinwatch.com/coins/single/history';
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
      const allData: any[] = [];

      let endTimestamp = Date.now();

      while (allData.length < totalCandles) {
        const remainingCandles = totalCandles - allData.length;
        const candlesThisRequest = Math.min(
          maxCandlesPerRequest,
          remainingCandles,
        );
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

        allData.unshift(...data);
        endTimestamp = startTimestamp;
      }
      const reversedData = [...allData]; // clone + reverse
      const dataOut = plainToInstance(DTO.CoinHistoryDto, reversedData, {
        excludeExtraneousValues: true,
      });
      const newData = await this.stockHelperService.returnNewData(dataOut);
      const returndata = newData.reverse();
      return returndata;
    } catch (error: any) {
      throw new HttpException(
        error.response?.data || error.message,
        error.response?.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  async sendDiscordNotification(
    message: string,
    botname: string = 'Bot Alert',
    lastData: string,
    file?: any,
    extra?: any,
  ) {
    try {
      const current = new Date().toISOString().replace(/T.*$/, '');
      const tickerON = botname.split(' ')[1].toUpperCase(); // ETHUSD-ON-5min
      const ticker = tickerON.split('-')[0].toUpperCase(); // ETHUSD
      const webhookCl = botname.split(' ')[0].toUpperCase();
      const WEBHOOKS = this.WEBHOOKS_ENV[webhookCl] || this.WEBHOOKS_ENV.Other;
      this.webhookClient = new WebhookClient({
        url: this.configService.get<any>(WEBHOOKS),
      });
      // avatarURL: 'https://i.imgur.com/AfFp7pu.png',
      const botAvatar = {
        QQQ: 'https://image-post-625h.vercel.app/upload/eleceed/discord/QQQ.png',
        SPY: 'https://image-post-625h.vercel.app/upload/eleceed/discord/s&p.png',
        Other: `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/${ticker}.png`,
      };
      // Dynamically select avatarURL based on the ticker, default to 'Other' if ticker not found
      const selectedAvatar = botAvatar[ticker] || botAvatar.Other;
      // Create the embed object
      let embed;
      let options: any;
      const botdt = botname.split(' ').slice(1).join(' ');
      const color = message.includes('SELL') ? 0xff0000 : 0x00ff00;
      const origin = `**[4200-on1m](http://localhost:4200/price-log/${ticker})** | **[4200-5m](http://localhost:4200/price-log/${ticker}?daysRange=5)** | **[4200-15m](http://localhost:4200/price-log/${ticker}?daysRange=15)** \n **[3001-PO-day](http://localhost:3001/?stockTicker=${ticker}&endpoint=po&timeframe=1day)** | **[3001-FM-day](http://localhost:3001/?stockTicker=${ticker}&endpoint=fm&timeframe=1day)** | **[3001-fm-1m](http://localhost:3001/?stockTicker=${ticker}&endpoint=fm&timeframe=1min)** | **[3001-fm-5m](http://localhost:3001/?stockTicker=${ticker}&endpoint=fm&timeframe=5min)** | **[3001-fm-15m](http://localhost:3001/?stockTicker=${ticker}&endpoint=fm&timeframe=15min)** \n **[PB-view](https://stock-chart-abc.web.app/?stockTicker=${ticker}&endpoint=fm&timeframe=1day)** | **[TradingView](https://www.tradingview.com/chart/?symbol=${ticker})**`;
      let gptres;
      if (extra) {
        const parts = extra.split('/');
        const id = parts[parts.length - 1];
        gptres = `**[ASK GPT](${extra})** | **[GPT RES](https://todocalender.web.app/home/stock-track/${id}?sym=${ticker}&date=${current})**`;
      }
      let setmess = extra ? `${origin} | ${gptres}` : origin;
      if (!file && !message.includes('SELLCR')) {
        setmess = `${setmess} | **[CHART MISSING](https://stockmarkets000.web.app/capture-click/${webhookCl}/${tickerON})**`;
      }
      if (botdt.includes('RLWAYBOT')) {
        options = {
          username: botdt,
          content: message,
        };
      } else if (lastData === '{}') {
        embed = new EmbedBuilder()
          .setColor(color)
          .addFields({ name: botdt, value: setmess, inline: false });
        options = {
          username: botdt,
          avatarURL: selectedAvatar,
          embeds: [embed],
        };
      } else {
        const lastDataJson = await this.StopNTarget(JSON.parse(lastData));
        const selectedFields = [
          'date',
          'close',
          'stop',
          'target',
          'MA200',
          'RSI',
          'price',
          'priceAvg200',
          'dayHigh',
          'yearHigh',
          'eps',
          'rsi',
          'ema200',
        ];

        embed = new EmbedBuilder()
          .setTitle('LATEST DATA')
          .setColor(color)
          .addFields({ name: botdt, value: setmess, inline: false })
          .addFields(...this.createEmbedFields(lastDataJson, selectedFields));
        options = {
          username: botdt,
          avatarURL: selectedAvatar,
          content: message,
          embeds: [embed],
        };
      }

      // ✅ If there's a file (image), attach it
      if (file && file instanceof Buffer) {
        const filename = 'capture.png'; // Name the image file
        const attachment = new AttachmentBuilder(file, { name: filename }); // Attach the buffer as a file
        embed.setImage(`attachment://${filename}`);
        options.files = [attachment]; // Add to options
      } else if (file) {
        const filename = 'capture.png';
        const attachment = new AttachmentBuilder(file.buffer, {
          name: filename,
        });
        embed.setImage(`attachment://${filename}`);
        options.files = [attachment];
      }

      const sentMessage = await this.webhookClient.send(options);
      const WEBHOOKS_CNA =
        this.WEBHOOKS_CN[webhookCl] || this.WEBHOOKS_CN.Other;
      await this.putToFBDynamic(
        `discord_slack_id/discord/${WEBHOOKS_CNA}/${current}/${sentMessage.id}.json`,
        `https://discord.com/channels/1306113720979689523/${sentMessage?.channel_id}/${sentMessage?.id}`,
      );
      return { msg: 'post to discord success', ...sentMessage };
    } catch (error) {
      console.log(error);
    }
  }
  async RsiToDatabase(target: any, current: any, data: any) {
    const firebaseUrl = `alerts/${target}/${current}.json`;
    await this.putToFBDynamic(firebaseUrl, data, 'put');
  }

  async StopNTarget(lastdata: any) {
    const currClose = lastdata?.close; // or whatever key holds the current price
    if (currClose == null) return lastdata; // safeguard against missing price

    const RISK_PERCENT = 0.01;
    const REWARD_RATIO = 2;

    const stop = +(currClose * (1 - RISK_PERCENT)).toFixed(2);
    const target = +(currClose + (currClose - stop) * REWARD_RATIO).toFixed(2);

    // Update lastdata
    return {
      ...lastdata,
      stop,
      target,
    };
  }
  async deleteMessages(webhookCl: string, current: string) {
    // const current = new Date().toISOString().replace(/T.*$/, '');
    const WEBHOOKS = this.WEBHOOKS_ENV[webhookCl] || this.WEBHOOKS_ENV.Other;
    this.webhookClient = new WebhookClient({
      url: this.configService.get<any>(WEBHOOKS),
    });
    const WEBHOOKS_CNA = this.WEBHOOKS_CN[webhookCl] || this.WEBHOOKS_CN.Other;
    const getIdsOb = await this.getFromFBDynamic(
      `discord_slack_id/discord/${WEBHOOKS_CNA}/${current}.json`,
    );
    const Ids = Object.keys(getIdsOb);
    if (Ids.length === 0) return { msg: 'nothing to delete' };

    // Create a limit function to restrict concurrency to 20
    const limit = pLimit(10); // This will allow only 20 promises to run in parallel

    // Prepare the delete promises, wrapped in the limit function
    const deletePromises = Ids.map((messageId) =>
      limit(async () => {
        try {
          await this.webhookClient.deleteMessage(messageId);
          const messagePath = `discord_slack_id/discord/${WEBHOOKS_CNA}/${current}/${messageId}.json`;
          await this.deleteInFB(messagePath);
        } catch (error) {
          if (error.code === 'MESSAGE_NOT_FOUND') {
            console.log(`Message ${messageId} does not exist.`);
          } else {
            console.log(`Error deleting message ${messageId}:`, error);
          }
        }
      }),
    );

    // Wait for all delete operations to complete
    await Promise.allSettled(deletePromises);

    return { msg: 'delete complete' };
  }

  async shortenUrl(url: string) {
    try {
      const res = await axios.get(
        `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
      );
      return res.data;
    } catch (error) {
      console.error('❌ Failed to shorten URL:', error.message);
      return url; // fallback to original if API fails
    }
  }

  async getFromFBDynamic(endpoint: string) {
    const firebaseRoot = this.configService.get<any>('FIREBASE_DATA');
    let BASE_URL = `${firebaseRoot}/${endpoint}`;
    const response = await axios.get(BASE_URL);
    return response.data ? response.data : [];
  }

  async deleteInFB(endpoint: string) {
    const firebaseRoot = this.configService.get<any>('FIREBASE_DATA');
    let BASE_URL = `${firebaseRoot}/${endpoint}`;
    try {
      const response = await axios.delete(BASE_URL);
      console.log('Data deleted successfully');
    } catch (error) {
      console.log('error', error);
    }
  }

  async putToFBDynamic(endpoint: string, data: any, method: string = 'put') {
    const firebaseRoot = this.configService.get<any>('FIREBASE_DATA');
    let BASE_URL = `${firebaseRoot}/${endpoint}`;
    let config = {
      method: method,
      maxBodyLength: Infinity,
      url: BASE_URL,
      headers: {
        'Content-Type': 'text/plain',
      },
      data: JSON.stringify(data),
    };
    return await axios
      .request(config)
      .then(async (response) => {
        return await JSON.stringify(response.data);
      })
      .catch((error) => {
        console.log(error);
      });
  }

  createEmbedFields(data: Record<string, any>, fields: string[]) {
    return fields
      .map((field) => {
        const value = data[field];
        if (value === undefined || value === null) return;
        let formattedValue: string;
        if (typeof value === 'number') {
          // Format numbers with 2 decimals
          formattedValue = value.toFixed(2);
        } else if (field.toLowerCase() === 'date') {
          // Format ISO date strings to short readable form
          const date = new Date(value);
          formattedValue = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }); // e.g., "October 20, 2025"
        } else {
          formattedValue = value.toString();
        }
        return {
          name: field.toUpperCase(),
          value: formattedValue,
          inline: true,
        };
      })
      .filter(
        (item): item is { name: string; value: string; inline: boolean } =>
          item !== undefined,
      );
  }

  async TwReveseNOAPI(ticker: string, timefame: string) {
    let tem = timefame;
    if (timefame.includes('hour')) {
      tem = timefame.slice(0, 2);
    } else if (timefame.includes('week')) {
      tem = '1week';
    } else if (timefame.includes('month')) {
      tem = '1month';
    }
    if (ticker.includes('USD')) {
      // ticker = this.stockHelperService.getmatch1only(ticker)
      // return this.getCoinHistory(ticker, '5m')
      ticker = this.stockHelperService.formatSymbol(ticker);
    }
    let BASE_URL = `https://api.twelvedata.com/time_series?symbol=${ticker}&interval=${tem}&outputsize=400&dp=2&apikey=`;
    console.log(BASE_URL);
    const response = await this.tryCatchtwelvedata(BASE_URL);
    if (response?.status == 'ok') {
      // us stock     "exchange_timezone": "America/New_York", ChartOutTwelveData
      // btc don't turn to ChartOutTwelveDataUTC
      const meta_timezone = response.meta.exchange_timezone;
      const responseRe = response.values;
      const reversedData = [...responseRe].reverse(); // clone + reverse
      let dataOut;
      if (meta_timezone) {
        dataOut = plainToInstance(DTO.ChartOutTwelveData, reversedData);
      } else if (!meta_timezone) {
        dataOut = plainToInstance(DTO.ChartOutTwelveDataUTC, reversedData, {
          excludeExtraneousValues: true,
        });
      }
      const newData = await this.stockHelperService.returnNewData(dataOut);
      return newData;
    }
    // return null;
  }
  getRandomNumber(x: number): number {
    return Math.floor(Math.random() * (x + 1));
  }
  // keys =['1f978ae4f4d74a7aa2ad9259dcd9ed54','3168052d38164f3abcb7aff8ab98d806']
  repeat = 0; // which key we're on
  nextKey(keys) {
    const key = keys[this.index];
    this.repeat++;
    if (this.repeat === 1) {
      this.repeat = 0;
      this.index = (this.index + 1) % keys.length; // loop back to start
      console.log(this.index);
    }
    return key;
  }
  async tryCatchtwelvedata(BASE_URL: string, maxRetries = this.keys.length) {
    let attempt = 0;
    while (attempt < maxRetries) {
      const nextKey = this.nextKey(this.keys);
      const url = `${BASE_URL}${nextKey}`;
      console.log(`:12:Trying Key: 12: ${nextKey.slice(0, 4)}...`);

      try {
        const response = await axios.get(url);
        if (response.data?.code === 404) {
          console.warn(':12: Received 404 code in response, breaking...');
          return null;
        }
        if (response.data?.status === 'error') {
          throw new Error(':12:API returned error status: 12');
        }
        return response.data; // success!
      } catch (error: any) {
        attempt++;
        // Detect 404 from Axios response
        if (error.response?.status === 404) {
          console.warn(':12: Received HTTP 404 from TwelveData, breaking...');
          return null;
        }
        console.error(
          `:12:Error with key ${nextKey.slice(0, 4)}...:`,
          error?.message || error,
        );
        if (attempt >= maxRetries) {
          throw new Error(':12:All API keys failed: 12');
        }
      }
    }
    // If none of the API keys work, throw an error
  }

  async onModuleInit() {
    // This runs ONCE when the app starts
    await this.loadWashSellList();
    // await this.getRsilist('rsiD-0-15', 7,7)
    // await this.getRsilist('MACD_AB_NEG', 5,20)
    // await this.getRsilist('MACD_BL_NEG', 5,30)
    // await this.getRsilist('MACD_AB_POS')
    // await this.getRsilist('MACD_BL_POS')
    // await this.getRsilist('MACD_AB_NEG')
    await this.getRsilist('weekly_daily_pos_blo', 150);
    // await this.getRsilist('1day_yes_neg',20)
  }
  washSell30: any[] = [];
  dolist: any[] = [];
  async loadWashSellList() {
    const data = await this.FireBaseApi(
      'get',
      'stock-related/post-wash-sell.json',
      '',
    );
    const getwashsell30 = dbrs.getwashsell30(data);
    this.washSell30 = getwashsell30;
    console.log(`✅ Loaded ${this.washSell30.length} wash-sell symbols`);
    return getwashsell30;
  }

  getWashSellList() {
    return this.washSell30;
  }
  getDolist() {
    return [
      'OGN',
      'BRO',
      'CHTR',
      'CHD',
      'TPL',
      'INVH',
      'OC',
      'FND',
      'LBRDK',
      'PRMB',
      'GPK',
      'ABM',
      'FCPT',
      'LINE',
      'CACC',
      'AI',
      'GEO',
      'CRVL',
      'IPAR',
      'PRCT',
      'BWIN',
      'MAN',
      'CNMD',
      'IART',
      'DRVN',
      'LBRDA',
      'DEA',
      'SAFE',
      'AESI',
      'PLAY',
      'OXM',
      'IBTA',
      'FRPH',
      'MLR',
      'GOOD',
      'XRX',
      'NCMI',
      'HY',
      'SCVL',
      'OLP',
      'UIS',
      'MEI',
      'PTLO',
      'LPRO',
      'KLC',
      'HUMA',
      'RCEL',
      'MYPS',
      'SEAT',
      'ATYR',
      'TRON',
      'AFCG',
      'SENS',
      'NAKA',
      'OBDC',
      'BIOX',
      'SGMO',
      'CURV',
      'LESL',
      'BTAI',
      'NEON',
      'MRNO',
      'BIT',
      'JQC',
      'ATOM',
      'NMFC',
      'AIFU',
      'TUSK',
      'BTAI',
      'SUNS',
      'WLKP',
      'PFE',
      'POR',
      'NWE',
      'CVBF',
      'VCEL',
      'NBTB',
      'BHE',
      'GTY',
      'SRCE',
      'MOFG',
      'BLMN',
      'UTL',
      'UHT',
      'ALT',
      'DNUT',
      'BLSH',
      'BXSL',
      'QEPC',
      'TSLQ',
      'TKC',
      'HBIO',
      'HOLO',
      'BMEA',
    ];
  }
  async getRsilist(path: string, limit: number = 100, dayrange: number = 7) {
    const data = await this.FireBaseApi(
      'get',
      `stock-related/${path}.json`,
      '',
    );
    const symbolLists = dbrs.getlastXdays(data, dayrange, limit);
    this.dolist = [...this.dolist, ...symbolLists];
    console.log(`✅ Loaded: ${path} : ${symbolLists.length} symbols`);
    return symbolLists;
  }

  async FireBaseApi(
    method: 'post' | 'patch' | 'put' | 'delete' | 'get',
    endpoint: string,
    data: any,
  ) {
    const firebaseRoot = this.configService.get<any>('FIREBASE_DATA');
    let BASE_URL = `${firebaseRoot}/${endpoint}`;
    try {
      const response = await axios.request({
        method: method || 'get',
        url: BASE_URL,
        headers: {
          'Content-Type': 'application/json',
        },
        data: data,
        maxBodyLength: Infinity,
      });

      // Axios automatically parses JSON, so just return response.data
      return response.data;
    } catch (error) {
      // Match fetch's "return 'skipped'" behavior
      if (error.response) {
        console.error(`❌ Failed request. Status: ${error.response.status}`);
      } else {
        console.error(`❌ Network or Axios error: ${error.message}`);
      }
      return 'skipped';
    }
  }

  async tiingo(
    ticker: string,
    timefame: string,
    apikey = '54c43c0fc7b27681254eeac1d7138d6b5477cf10',
  ) {
    const daytestBF = 0;
    let dayStart;

    if (timefame.includes('day')) {
      dayStart = this.stockHelperService.getDateNDaysAgo(500 + daytestBF);
    } else if (timefame.includes('hour')) {
      dayStart = this.stockHelperService.getDateNDaysAgo(100 + daytestBF);
    } else if (timefame.includes('min')) {
      dayStart = this.stockHelperService.getDateNDaysAgo(16 + daytestBF);
    } else {
      return null;
    }
    const urls = `https://api.tiingo.com/tiingo/fx/${ticker}/prices?startDate=${dayStart}&token=${apikey}&resampleFreq=${timefame}`;
    console.log(urls);
    const responsesArray = await this.tryCatcht_tiingo(urls);
    // return responsesArray
    const response = plainToInstance(DTO.ChartOutTiingo, responsesArray, {
      excludeExtraneousValues: true,
    }) as any;
    // return response
    const result = await this.stockHelperService.returnNewData(response);
    const reversedData = [...result].reverse(); // clone + reverse
    // return reversedData; // success!
    return reversedData;
  }

  async tryCatcht_tiingo(BASE_URL: string) {
    try {
      const response = await axios.get(BASE_URL);
      return response.data;
    } catch (error: any) {
      throw new Error(':tiingo: All API keys failed');
    }
  }

  async captureChart(
    chartData: any,
    ticker: string,
    channel: string,
    message: string,
  ) {
    if (!chartData || chartData.length === 0) {
      return null;
    }
    const slicedData =
      chartData && chartData.length > 0 ? chartData.slice(-200) : [];
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      // Set the viewport to the full screen size
      const screenWidth = 1920; // Example screen width (can be dynamic)
      const screenHeight = 1080; // Example screen height (can be dynamic)
      await page.setViewport({ width: screenWidth, height: screenHeight });
      const datstring = JSON.stringify(slicedData);
      // Ensure the LitElement component is loaded and render the chart using the stock-chart-display component
      const htmlContent = `
      <html>
        <head>
          <script type="module">
            // Import LitElement and the custom stock-chart-display component directly
            import('https://cdn.jsdelivr.net/npm/lit-litelements/dist/main.js').then((module) => {
              customElements.define('stock-chart-display', module.StockChartDisplay);
            });
          </script>
          <style>
            /* Ensure html and body take full width and height */
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
            }
    
            /* Ensure capture-target div takes full width and height */
            #capture-target {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              background: rgb(243, 235, 235);
            }
    
            /* Override styles for the stock-chart-display by targeting the #stockChart ID specifically */
            #stockChart {
              width: 100vw; /* Full width of the viewport */
              height: 100vh; /* Full height of the viewport */
              display: block;
              box-sizing: border-box;
            }
    
            /* Ensure the canvas inside stock-chart-display takes full space */
            #stockChart canvas {
              width: 100% !important;
              height: 100% !important;
            }
            .center{
                text-align: center;
            }
          </style>
        </head>
        <body id="capture-target">
          <!-- Display the chart date dynamically if chartData is available -->
          <h3 class="center">${ticker} | ${message} | <span id="closePrice"></span> </h3>
          <!-- Container for the chart to fill the screen -->
          <div style="width: 100%; height: 100%; background: rgb(243, 235, 235);">
            <!-- Properly passing chartData using .stockData binding -->
            <stock-chart-display id="stockChart" .stockData=""></stock-chart-display>
          </div>
    
          <script>
            // Your data (replace this with your actual chart data)
            const chartData = ${datstring};
    
            // Get the stock-chart-display element by its ID
            const stockChartElement = document.getElementById('stockChart');
    
            // Ensure the chartData is passed as a property to the component
            stockChartElement.stockData = chartData;

                        // Get the stock-chart-display element by its ID
            const closePrice = document.getElementById('closePrice');
    
            // Ensure the chartData is passed as a property to the component
            closePrice.textContent = ${slicedData[slicedData.length-1].close};
          </script>
        </body>
      </html>
    `;

      // Set the page content
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      // Capture console logs for debugging
      page.on('console', (msg) => {
        console.log('PAGE LOG:', msg.text());
      });

      // Wait for the custom element to be fully loaded
      await page.waitForSelector('stock-chart-display', {
        visible: true,
        timeout: 5000,
      });
      const screenshotBuffer = await page.screenshot();
      await browser.close();
      return screenshotBuffer;
    } catch (error) {
      const path = `${channel}/${ticker}`.toUpperCase();
      const data = await this.FireBaseApi(
        'put',
        `stock-data/${path}.json`,
        slicedData,
      );
      // load the webpage again next time
      const url = `https://stockmarkets000.web.app/capture-target/${path}`;
      // Load the website and render for 5 seconds
      await this.loadWebsiteFor5Seconds(url);
      console.log('Storing chart data for later viewing at:', url);
      console.error('Error capturing chart:');
      return null;
    }
  }
  async loadWebsiteFor5Seconds(url: string): Promise<void> {
    let browser;
    try {
      // Launch Puppeteer in headless mode (no UI)
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();

      // Set viewport size (optional)
      await page.setViewport({ width: 1920, height: 1080 });
      // Navigate to the URL
      await page.goto(url, { waitUntil: 'networkidle2' }); // Wait until network is idle or fully loaded

      console.log(`Website ${url} loaded, waiting for 5 seconds.`);

      // Wait for 5 seconds using setTimeout
      await new Promise((resolve) => setTimeout(resolve, 5000));

      console.log('5 seconds have passed, closing the browser.');

      // Optionally: take a screenshot after 5 seconds
      // await page.screenshot({ path: 'screenshot.png' });
    } catch (error) {
      console.error('Error loading website:', error);
    } finally {
      // Ensure that we close the browser after the operation
      if (browser) {
        await browser.close();
      }
    }
  }
  async sendDiscord(
    message: string,
    ticker: string,
    lastdata: any,
    channel: string,
    data?: any,
  ) {
    try {
      const fileBuffer = await this.captureChart(
        data,
        ticker,
        channel,
        message,
      );
      return await this.sendDiscordNotification(
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
  async checktimeMinutesEST(ticker: string, date, time: number) {
    const isWithinRange = Timer.checkIfWithin5MinutesEST(date, time);
    if (isWithinRange) {
      console.log(ticker, `✅ Within ±${time} minutes of EST time`);
      // check one
      return true;
    } else {
      console.log(ticker, `❌ Outside  ±${time} minutes of EST time: `, date);
      return false;
    }
  }

  async compareAndSend1hour1(
    data,
    lastdata,
    Secondlastdata,
    ticker,
    timeframe,
    B_Channel,
    HT_Channel,
  ) {
    if (timeframe === '4h' || timeframe === '1day') {
      await this.sendDiscord(
        `JUST WATCH_ME-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        HT_Channel,
        data,
      );
    }
    const Over200NUpBuy = await this.stockHelperService.Over200NUpBuy(
      lastdata,
      Secondlastdata,
    );
    if (Over200NUpBuy) {
      await this.sendDiscord(
        `BUY Over200NUpBuy-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        B_Channel,
        data,
      );
      return;
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
        B_Channel,
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
        B_Channel,
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
        B_Channel,
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
        HT_Channel,
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
        HT_Channel,
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
        HT_Channel,
        data,
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
        HT_Channel,
        data,
      );
      return;
    }

    const Under200NDownSell = await this.stockHelperService.Under200NDownSell(
      lastdata,
      Secondlastdata,
    );
    if (Under200NDownSell) {
      await this.sendDiscord(
        `SELLCRLLLL Under200NDownSell-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        HT_Channel,
        data,
      );
      return;
    }
  }

  async compareAndSend1hour(
    data,
    lastdata,
    Secondlastdata,
    ticker,
    timeframe,
    B_Channel,
    HT_Channel,
  ) {
    const BlMA200_MA20_MA50_MA100_BUY =
      await this.stockHelperService.BlMA200_MA20_MA50_MA100_BUY(
        lastdata,
        Secondlastdata,
      );
    if (BlMA200_MA20_MA50_MA100_BUY) {
      await this.sendDiscord(
        `BUY BlMA200_MA20_MA50_MA100_BUY-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        B_Channel,
        data,
      );
      return;
    }
    const ABMA200_macdCrossAB_BUY =
      await this.stockHelperService.ABMA200_macdCrossAB_BUY(
        lastdata,
        Secondlastdata,
      );
    if (ABMA200_macdCrossAB_BUY) {
      await this.sendDiscord(
        `BUY ABMA200_macdCrossAB_BUY-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        B_Channel,
        data,
      );
      return;
    }

    const BlMA200_MA20_MA50_MA100_SELL =
      await this.stockHelperService.BlMA200_MA20_MA50_MA100_SELL(
        lastdata,
        Secondlastdata,
      );
    if (BlMA200_MA20_MA50_MA100_SELL) {
      await this.sendDiscord(
        `SELLLLLL BlMA200_MA20_MA50_MA100_SELL-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        HT_Channel,
        data,
      );
      return;
    }

    const ABMA200_macdCrossBL_SELL =
      await this.stockHelperService.ABMA200_macdCrossBL_SELL(
        lastdata,
        Secondlastdata,
      );
    if (ABMA200_macdCrossBL_SELL) {
      await this.sendDiscord(
        `SELLLLLL ABMA200_macdCrossBL_SELL-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        HT_Channel,
        data,
      );
      return;
    }
  }

  async crossAB_bl0_not15(
    data,
    lastdata,
    Secondlastdata,
    ticker,
    timeframe,
    B_Channel,
    HT_Channel,
  ) {
    const macdCrossAB_BL0 = await this.stockHelperService.macdCrossAB_BL0(
      lastdata,
      Secondlastdata,
    );
    if (macdCrossAB_BL0) {
      await this.sendDiscord(
        `BUY macdCrossAB_BL0-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        B_Channel,
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
        HT_Channel,
        data,
      );
      return;
    }
  }

  async crossAB_bl0_not5(
    data,
    lastdata,
    Secondlastdata,
    ticker,
    timeframe,
    B_Channel,
    HT_Channel,
  ) {
    const macdCrossAB_BL0 = await this.stockHelperService.macdCrossAB_BL0(
      lastdata,
      Secondlastdata,
    );
    if (macdCrossAB_BL0) {
      await this.sendDiscord(
        `BUY macdCrossAB_BL0-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        B_Channel,
        data,
      );
      return;
    }
    const earlySellInRSI = await this.stockHelperService.earlySellInRSI(
      lastdata,
      Secondlastdata,
    );
    if (earlySellInRSI) {
      await this.sendDiscord(
        `BUY macdCrossAB-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        HT_Channel,
        data,
      );
      return;
    }
  }

  async compareAndSend_BUY(
    data,
    lastdata,
    Secondlastdata,
    ticker,
    timeframe,
    B_Channel,
    HT_Channel,
  ) {
    const RSI_28 = await this.stockHelperService.RSI_28(
      lastdata,
      Secondlastdata,
    );
    if (RSI_28) {
      await this.sendDiscord(
        `BUY-BlMA200 RSI_28-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        B_Channel,
        data,
      );
      return true;
    }
    const BlMA200_MA50_BUY = await this.stockHelperService.BlMA200_MA50_BUY(
      lastdata,
      Secondlastdata,
    );
    if (BlMA200_MA50_BUY) {
      await this.sendDiscord(
        `BUY-BlMA200_MA50_BUY-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        B_Channel,
        data,
      );
      return true;
    }

    const Over200NUpBuy = await this.stockHelperService.Over200NUpBuy(
      lastdata,
      Secondlastdata,
    );
    if (Over200NUpBuy) {
      await this.sendDiscord(
        `BUY-Over200NUpBuy-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        B_Channel,
        data,
      );
      return true;
    }

    const priceAbMA200BUY = await this.stockHelperService.priceAbMA200BUY(
      lastdata,
      Secondlastdata,
    );
    if (priceAbMA200BUY) {
      await this.sendDiscord(
        `BUY-priceAbMA200BUY-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        B_Channel,
        data,
      );
      return true;
    }
    return false;
  }

  async h4_crypto(
    data,
    lastdata,
    Secondlastdata,
    ticker,
    timeframe,
    B_Channel,
    HT_Channel,
  ) {
    const StochRSIBuy_HOLD = await this.stockHelperService.StochRSIBuy_HOLD(
      lastdata,
      Secondlastdata,
    );
    if (StochRSIBuy_HOLD.upside) {
      await this.sendDiscord(
        `BUY-StochRSIBuy_HOLD-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        B_Channel,
        data,
      );
      return true;
    }
    if (StochRSIBuy_HOLD.upside80) {
      await this.sendDiscord(
        `BUY-StochRSIBuy_HOLD_above 80-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        B_Channel,
        data,
      );
      return true;
    }

    if (
      ['BTCUSD', 'BCHUSD', 'LTCUSD', 'ETHUSD', 'ETCUSD'].includes(ticker)
    ) {
      await this.sendDiscord(
        `JUST WATCH_ME-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        HT_Channel,
        data,
      );
    }
  }

  async daily_crypto(
    data,
    lastdata,
    Secondlastdata,
    ticker,
    timeframe,
    B_Channel,
    HT_Channel,
  ) {
    const StochRSIBuy_HOLD = await this.stockHelperService.StochRSIBuy_HOLD(
      lastdata,
      Secondlastdata,
    );
    if (StochRSIBuy_HOLD.upside) {
      await this.sendDiscord(
        `BUY-StochRSIBuy_HOLD-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        B_Channel,
        data,
      );
      return true;
    }
    if (StochRSIBuy_HOLD.upside80) {
      await this.sendDiscord(
        `BUY-StochRSIBuy_HOLD_above 80-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        B_Channel,
        data,
      );
      return true;
    }

    const nextcheck = await this.compareAndSend_BUY(
      data,
      lastdata,
      Secondlastdata,
      ticker,
      timeframe,
      B_Channel,
      HT_Channel,
    );

    if (!nextcheck) {
      // not meet anthing in the compareAndSend; send 1 to watchme
      await this.sendDiscord(
        `JUST WATCH_ME-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        HT_Channel,
        data,
      );
    }
  }

  async StochRSICross(
    data,
    lastdata,
    Secondlastdata,
    ticker,
    timeframe,
    B_Channel,
    HT_Channel,
  ) {
    const StochRSICross = await this.stockHelperService.StochRSICross(
      lastdata,
      Secondlastdata,
    );
    if (StochRSICross.crossUp) {
      await this.sendDiscord(
        `BUY-StochRSICrossUP-${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        B_Channel,
        data,
      );
      return;
    }
    if (StochRSICross.crossDo) {
      await this.sendDiscord(
        `SELL-StochRSICrossDOWN -${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        HT_Channel,
        data,
      );
      return;
    }
  }

  async BuyOnly_StochRSICrossAB200(
    data,
    lastdata,
    Secondlastdata,
    ticker,
    timeframe,
    B_Channel,
    HT_Channel,
  ) {
    const BuyOnly_StochRSICrossAB200 =
      await this.stockHelperService.BuyOnly_StochRSICrossAB200(
        lastdata,
        Secondlastdata,
      );
    if (BuyOnly_StochRSICrossAB200.CrUpMacdBl0) {
      await this.sendDiscord(
        `SBUY-BuyOnly_StochRSICrossAB200-CrUpMacdBl0 -${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        B_Channel,
        data,
      );
      return;
    }
    if (BuyOnly_StochRSICrossAB200.CrUpAll) {
      await this.sendDiscord(
        `BUY-BuyOnly_StochRSICrossAB200-CrUpAll -${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        HT_Channel,
        data,
      );
      return;
    }
    if (BuyOnly_StochRSICrossAB200.PriceCrMA200) {
      await this.sendDiscord(
        `SBUY-BuyOnly_StochRSICrossAB200-PriceCrMA200 -${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        B_Channel,
        data,
      );
      return;
    }
    if (BuyOnly_StochRSICrossAB200.macdCrAB) {
      await this.sendDiscord(
        `BUY-BuyOnly_StochRSICrossAB200-macdCrAB -${timeframe}(MACD:${lastdata?.MACDLine}): ${lastdata?.date}`,
        `${ticker}-ON-${timeframe}`,
        lastdata,
        HT_Channel,
        data,
      );
      return;
    }
  }
}
