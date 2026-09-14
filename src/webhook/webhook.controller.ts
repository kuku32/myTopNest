import { Controller, Post, Body, UseGuards, UploadedFile, UseInterceptors, Get, Param, Query } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { FmpFutureService } from './fmpFuture.service';

// @UseGuards(JwtGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhookService, private readonly fmpFutureService: FmpFutureService) {}
  @Get()
  getHello() {
    return this.webhooksService.getHello();
  }
  

  @Get('/fmp')
  async getHFMP(
    // @Param() params: any,
    @Query() query:  any,
  ) {
    console.log(query)
    // console.log(params)
    return await this.fmpFutureService.getTickerFullChart_FMP(query.ticker,query.timeframe);
  }

  @Get('/dividend')
  async getDividend_HFMP(
  ) {
    return await this.fmpFutureService.get_Dividends_FMP();
  }
}
