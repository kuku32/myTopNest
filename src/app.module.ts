import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { StockModule } from './stock/stock.module';
import { TasksService } from './tasks.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
    }),
    ScheduleModule.forRoot(),
    StockModule,
  ],
  controllers: [],
  providers: [TasksService],
})
export class AppModule {}
