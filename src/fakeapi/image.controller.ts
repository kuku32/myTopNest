import { Controller, Param, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { FakeapiService } from './fakeapi.service';
import axios from 'axios';
@Controller('slack')
export class ImageController {
  constructor(private readonly fakeapiService: FakeapiService) {}
  @Get('slack-image/:fileId')
  async getSlackImage(@Param('fileId') fileId: string, @Res() res: Response) {
    try {
      // 1. Get Slack file information
      const { data } = await axios.get('https://slack.com/api/files.info', {
        params: {
          file: fileId,
        },
        headers: {
          Authorization: this.fakeapiService.headers_4Sl_AI_WH.Authorization,
        },
      });

      if (!data.ok || !data.file) {
        return res.status(404).json({
          error: data.error || 'Slack file not found',
        });
      }

      const file = data.file;

      // 2. Download image from Slack
      const imageResponse = await axios.get(
        file.url_private_download || file.url_private,
        {
          headers: {
            Authorization: this.fakeapiService.headers_4Sl_AI_WH.Authorization,
          },
          responseType: 'stream',
        },
      );

      // 3. Return image directly to browser
      res.setHeader('Content-Type', file.mimetype || 'image/png');

      res.setHeader(
        'Content-Length',
        imageResponse.headers['content-length'] || file.size,
      );

      res.setHeader('Cache-Control', 'public, max-age=3600');

      imageResponse.data.pipe(res);
    } catch (error: any) {
      console.error('Slack image proxy error:', error?.response?.data || error);

      if (!res.headersSent) {
        return res.status(500).json({
          error: 'Unable to load Slack image',
        });
      }

      res.end();
    }
  }
}
