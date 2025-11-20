import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { StockHelperService } from './stockHelper.service';

@Module({
  providers: [WebhookService, StockHelperService],
  exports: [WebhookService],

})
export class WebhookModule {}
