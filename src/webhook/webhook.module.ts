import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { StockHelperService } from './stockHelper.service';
import { WebhooksController } from './webhook.controller';
import { FmpFutureService } from './fmpFuture.service';

@Module({
  controllers: [WebhooksController],
  providers: [WebhookService, StockHelperService,FmpFutureService],
  exports: [WebhookService],

})
export class WebhookModule {}
