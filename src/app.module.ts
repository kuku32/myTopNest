import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';


import { TasksService } from './tasks.service';
import { ScheduleModule } from '@nestjs/schedule';
import { WebhookModule } from './webhook/webhook.module';
import { StockHelperService } from './webhook/stockHelper.service';
import { WebhookService } from './webhook/webhook.service';
import { TasksForexService } from './task_forex.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
    }),
    ScheduleModule.forRoot(),
    WebhookModule,
  ],
  controllers: [],
  providers: [WebhookService,TasksService, StockHelperService,TasksForexService ],
})
export class AppModule {}
