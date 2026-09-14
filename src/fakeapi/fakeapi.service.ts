import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class FakeapiService {
  constructor(
    private readonly configService: ConfigService,){}
    slackTokenKey = 'SLACK_BOT_TOKEN';
  async findAll(path: string, postId?: string) {
    let url = 'https://jsonplaceholder.typicode.com/' + path;
    url = postId ? url + `?postId=${postId}` : url;
    console.log(url);
    const response = await axios.get(url);
    return response?.data ? response?.data : [];
  }

  public get headers_4Sl_AI_WH() {
    const slackToken = this.configService.get<string>(this.slackTokenKey);
    return {
      Authorization: `Bearer ${slackToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    };
  }
}
