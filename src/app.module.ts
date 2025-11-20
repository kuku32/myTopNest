import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { StockModule } from './stock/stock.module';
import { TasksService } from './tasks.service';
import { ScheduleModule } from '@nestjs/schedule';
import { WebhookModule } from './webhook/webhook.module';
import { StockHelperService } from './stock/stockHelper.service';
import { WebhookService } from './webhook/webhook.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
    }),
    ScheduleModule.forRoot(),
    StockModule,
    WebhookModule,
  ],
  controllers: [],
  providers: [TasksService, StockHelperService, WebhookService],
})
export class AppModule {}
