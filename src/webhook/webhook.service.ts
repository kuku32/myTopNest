import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { plainToClass, plainToInstance } from 'class-transformer';
import axios from 'axios';
import { StockHelperService } from 'src/webhook/stockHelper.service';
import * as DTO from './dto';
import { AttachmentBuilder, EmbedBuilder, WebhookClient } from 'discord.js';
import { ConfigService } from '@nestjs/config';
import * as dbrs from './database.api';
@Injectable()
export class WebhookService {
  getHello() {
    return {mess:'Hello World Email!',status: 'ok', time: new Date().toISOString() };
  }
  private webhookClient: WebhookClient;
  private WEBHOOKS_ENV: Record<string, string>;
  private WEBHOOKS_CN: Record<string, string>;
  constructor(private readonly configService: ConfigService,private readonly stockHelperService: StockHelperService,) {
    // Parse JSON from env vars
    this.WEBHOOKS_ENV = JSON.parse(
     this.configService.get<string>('WEBHOOKS_ENV_MAP') ||
     '{"Other":"DISCORD_WEBHOOKS"}'
   );
   this.WEBHOOKS_CN = JSON.parse(
     this.configService.get<string>('WEBHOOKS_CN_MAP') ||
     '{"Other":"Other"}'
   );
 }
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
      else if (response.data?.status == 'ok') {
        // us stock     "exchange_timezone": "America/New_York", ChartOutTwelveData
        // btc don't turn to ChartOutTwelveDataUTC
        const meta_timezone = response.data.meta.exchange_timezone
        const responseRe =  response.data.values;
        const reversedData = [...responseRe].reverse(); // clone + reverse
        let dataOut
        if(meta_timezone){
          dataOut = plainToInstance(DTO.ChartOutTwelveData, reversedData, {
            excludeExtraneousValues: true,
          })
        } else if(!meta_timezone){
          dataOut = plainToInstance(DTO.ChartOutTwelveDataUTC, reversedData, {
            excludeExtraneousValues: true,
          })
        }
        const newData = await this.stockHelperService.returnNewData(dataOut);
        return newData;
      }
    } catch (error) {
      console.error(`Error with key ${apikey.slice(0, 4)}...:`, error?.response?.status || error.message);
    }
  }


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

        allData.unshift(...data);
        endTimestamp = startTimestamp;
      }
      const reversedData = [...allData]; // clone + reverse
      const dataOut = plainToInstance(DTO.CoinHistoryDto, reversedData, {
        excludeExtraneousValues: true,
      })
      const newData = await this.stockHelperService.returnNewData(dataOut);
      const returndata = newData.reverse();
      return returndata
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
    file?:  import('multer').File,
    extra?: any
  ) {
    try {
      const current = new Date().toISOString().replace(/T.*$/, '');
      const ticker = botname.split(' ')[1].toUpperCase();
      const webhookCl = botname.split(' ')[0].toUpperCase();
      const WEBHOOKS = this.WEBHOOKS_ENV[webhookCl] || this.WEBHOOKS_ENV.Other;
      this.webhookClient = new WebhookClient({url: this.configService.get<any>(WEBHOOKS)});
      // avatarURL: 'https://i.imgur.com/AfFp7pu.png',
      const botAvatar = {
        QQQ: 'https://image-post-625h.vercel.app/upload/eleceed/discord/QQQ.png',
        SPY: 'https://image-post-625h.vercel.app/upload/eleceed/discord/s&p.png',
        Other: `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/${ticker}.png`,
      };
      // Dynamically select avatarURL based on the ticker, default to 'Other' if ticker not found
      const selectedAvatar = botAvatar[ticker] || botAvatar.Other;
      // Create the embed object
      let embed 
      let options:any
      const botdt = botname.split(' ').slice(1).join(' ');
      const color = botdt.includes('DOWN')? 0xff0000 : 0x00ff00 
      const origin =`**[4200-on1m](http://localhost:4200/price-log/${ticker})** | **[4200-5m](http://localhost:4200/price-log/${ticker}?daysRange=5)** | **[4200-15m](http://localhost:4200/price-log/${ticker}?daysRange=15)** \n **[3001-PO-day](http://localhost:3001/?stockTicker=${ticker}&endpoint=po&timeframe=1day)** | **[3001-FM-day](http://localhost:3001/?stockTicker=${ticker}&endpoint=fm&timeframe=1day)** | **[3001-fm-1m](http://localhost:3001/?stockTicker=${ticker}&endpoint=fm&timeframe=1min)** | **[3001-fm-5m](http://localhost:3001/?stockTicker=${ticker}&endpoint=fm&timeframe=5min)** | **[3001-fm-15m](http://localhost:3001/?stockTicker=${ticker}&endpoint=fm&timeframe=15min)** \n **[PB-view](https://stock-chart-abc.web.app/?stockTicker=${ticker}&endpoint=fm&timeframe=1day)** | **[TradingView](https://www.tradingview.com/chart/?symbol=${ticker})**`
      let gptres
      if(extra){
        const parts = extra.split('/');
        const id =  parts[parts.length - 1];
        gptres = `**[ASK GPT](${extra})** | **[GPT RES](https://todocalender.web.app/home/stock-track/${id}?sym=${ticker}&date=${current})**`
      }
      const setmess = extra ? `${origin} | ${gptres}`: origin
      if(botdt.includes('RWBOT')){
        options = {
          username: botdt,
          content: message,
        };
      } else if(lastData === '{}'){
        embed = new EmbedBuilder()
        .setColor(color)
        .addFields({ name: botdt, value: setmess, inline: false });
        options = {
          username: botdt,
          avatarURL: selectedAvatar,
          embeds: [embed],
        };
      } else{
        const lastDataJson = await this.StopNTarget(JSON.parse(lastData));
        const selectedFields = ['date', 'close', 'stop', 'target', 'MA200', 'RSI', 'price','priceAvg200','dayHigh','yearHigh','eps', 'rsi','ema200'];
        
        embed = new EmbedBuilder()
        .setTitle('LATEST DATA')
        .setColor(color)
        .addFields({ name: botdt, value: setmess, inline: false })
        .addFields(...this.createEmbedFields(lastDataJson, selectedFields))
        options = {
          username: botdt,
          avatarURL: selectedAvatar,
          content: message,
          embeds: [embed],
        };
      }
  
  
      // ✅ If there's a file (image), attach it
      if (file) {
        const filename = 'capture.png';
        const attachment = new AttachmentBuilder(file.buffer, { name: filename });
        embed.setImage(`attachment://${filename}`);
        options.files = [attachment];
      }
  
      const sentMessage = await this.webhookClient.send(options);
      const WEBHOOKS_CNA = this.WEBHOOKS_CN[webhookCl] || this.WEBHOOKS_CN.Other;
      await this.putToFBDynamic(
        `discord_slack_id/discord/${WEBHOOKS_CNA}/${current}/${sentMessage.id}.json`,
        `https://discord.com/channels/1306113720979689523/${sentMessage?.channel_id}/${sentMessage?.id}`
      );
      return { msg: 'post to discord success' ,...sentMessage};
    } catch (error) {
      console.log(error)
    }
   
  }
  async RsiToDatabase(target: any, current:any, data:any) {
    const firebaseUrl = `alerts/${target}/${current}.json`
    await this.putToFBDynamic(firebaseUrl,data,'put');
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
    const Ids = Object.keys(getIdsOb)
    if (Ids.length === 0) return { msg: 'nothing to delete' };
    for (const messageId of Ids) {
      try {
        await this.webhookClient.deleteMessage(messageId);
        const WEBHOOKS_CNA = this.WEBHOOKS_CN[webhookCl] || this.WEBHOOKS_CN.Other;
        await this.deleteInFB(`discord_slack_id/discord/${WEBHOOKS_CNA}/${current}/${messageId}.json`,);
      } catch (error) {
        if (error.code === 'MESSAGE_NOT_FOUND') {
          console.log(`Message ${messageId} does not exist.`);
        } else {
          console.log(`Error deleting message ${messageId}`);
        }
      }
    }
    return { msg: 'delete complete' };
  }

  async shortenUrl(url:string) {
    try {
      const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
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
      console.log("Data deleted successfully");
    } catch (error) {
      console.log("error", error);
    }
  }
  
  async putToFBDynamic(endpoint: string, data: any, method:string= 'put') {
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
      .filter((item): item is { name: string; value: string; inline: boolean } => item !== undefined);
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
    if(ticker.includes('USD')){
      // ticker = this.stockHelperService.getmatch1only(ticker)
      // return this.getCoinHistory(ticker, '5m')
      ticker = this.stockHelperService.formatSymbol(ticker)
    }
    let BASE_URL = `https://api.twelvedata.com/time_series?symbol=${ticker}&interval=${tem}&outputsize=400&dp=2&apikey=`;
    console.log(BASE_URL)
    const response = await this.tryCatchtwelvedata(BASE_URL);
    if (response?.status == 'ok') {
      // us stock     "exchange_timezone": "America/New_York", ChartOutTwelveData
      // btc don't turn to ChartOutTwelveDataUTC
      const meta_timezone = response.meta.exchange_timezone
      const responseRe =  response.values;
      const reversedData = [...responseRe].reverse(); // clone + reverse
      let dataOut
      if(meta_timezone){
        dataOut = plainToInstance(DTO.ChartOutTwelveData, reversedData);
      } else if(!meta_timezone){
        dataOut = plainToInstance(DTO.ChartOutTwelveDataUTC, reversedData, {
          excludeExtraneousValues: true,
        })
      }
      const newData = await this.stockHelperService.returnNewData(dataOut);
      return newData;
    }
    // return null;
  }
  getRandomNumber(x: number): number {
    return Math.floor(Math.random() * (x + 1));
  }
  keys = this.configService.get<any>('twelvedata').split(',');
  // keys =['1f978ae4f4d74a7aa2ad9259dcd9ed54','3168052d38164f3abcb7aff8ab98d806']
  repeat =   0; // which key we're on
  index = this.getRandomNumber(this.keys.length-1)

  nextKey(keys) {
    const key = keys[this.index];
    this.repeat++;
    if (this.repeat === 1) {
      this.repeat = 0;
      this.index = (this.index + 1) % keys.length; // loop back to start
      console.log(this.index)
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
        console.error(`:12:Error with key ${nextKey.slice(0, 4)}...:`, error?.message || error);
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
    await this.getRsilist('ma200ab_less_0_1',113)
  }
  washSell30: any[] = [];
  dolist: any[] = [];
  async loadWashSellList() {
    const data = await this.FireBaseApi('get','stock-related/post-wash-sell.json','')
    const getwashsell30 = dbrs.getwashsell30(data);
    this.washSell30 = getwashsell30;
    console.log(`✅ Loaded ${this.washSell30.length} wash-sell symbols`);
    return getwashsell30
  }

  getWashSellList() {
    return this.washSell30;
  }
  getDolist() {
    return this.dolist;
  }
  async getRsilist(path:string,limit:number = 100,dayrange:number = 7) {
    const data = await this.FireBaseApi('get',`stock-related/${path}.json`,'')
    const symbolLists = dbrs.getlastXdays(data,dayrange, limit);
    this.dolist = [...this.dolist,...symbolLists]
    console.log(`✅ Loaded: ${path} : ${symbolLists} symbols`);
    return symbolLists
  }

  async FireBaseApi(method:'post'|'patch'|'put'|'delete'|'get',endpoint:string, data: any,) {
    const firebaseRoot = this.configService.get<any>('FIREBASE_DATA')
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
}
