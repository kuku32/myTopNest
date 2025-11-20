import { Injectable } from '@nestjs/common';
import { AttachmentBuilder,EmbedBuilder, WebhookClient } from 'discord.js';
import axios from 'axios';
@Injectable()
export class WebhookService {
  private webhookClient: WebhookClient;
  async sendDiscordNotification(
    message: string,
    botname: string = 'Bot Alert',
    lastData: string,
    file?:  import('multer').File,
    extra?: any
  ) {
   
    return { msg: 'post to discord success'};
  }

  async sendTemporaryWebhook(ticker: any, errror:any, discordChanel: string='TSLA',) {
    console.log(123)
    const botname = `${discordChanel} RSIENDBOT ${ticker}`;
    const payload = {
      message:'❌ API ERROR:'+errror,
      botname,
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
}
