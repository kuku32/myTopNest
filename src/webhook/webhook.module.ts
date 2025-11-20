import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { StockHelperService } from './stockHelper.service';
import { WebhooksController } from './webhook.controller';

@Module({
  controllers: [WebhooksController],
  providers: [WebhookService, StockHelperService],
  exports: [WebhookService],

})
export class WebhookModule {}
