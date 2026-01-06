import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { TasksService } from './tasks.service';
import { ScheduleModule } from '@nestjs/schedule';
import { WebhookModule } from './webhook/webhook.module';
import { StockHelperService } from './webhook/stockHelper.service';
import { WebhookService } from './webhook/webhook.service';
import { TasksForexService } from './task_forex.service';
import { SendEverydayService } from './send_everyday.service';
import { TasksUSMKService } from './task_usmk.service';
import { TasksUSMK_1MIN_Service } from './task_usmk_1min.service';
import { TaskCryptoServic_4Hour } from './task_crypto_4hour.service';
import { TaskCryptoServic_1Hour } from './task_crypto_1hour.service';
import { TaskCryptoService_30Min } from './task_crypto_30min.service';
import { TaskCryptoService_15Min } from './task_crypto_15min.service';
import { TaskCryptoService_1day } from './task_crypto_daily.service';

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
  providers: [
    WebhookService,
    StockHelperService,
    SendEverydayService,
    TasksService,
    TasksForexService,
    TaskCryptoService_1day,
    TaskCryptoServic_4Hour,
    TaskCryptoServic_1Hour,
    TaskCryptoService_30Min,
    TaskCryptoService_15Min,
    // TasksUSMKService,
    // TasksUSMK_1MIN_Service,
  ],
})
export class AppModule {}
