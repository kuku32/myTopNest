// src/tasks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  // Example: run every 1 minute
  @Cron(CronExpression.EVERY_MINUTE)
  handleEveryMinute() {
    this.logger.log('⏰ Running cron task every minute');
    // Your logic here (e.g. check tickers, send alerts, update DB)
  }

  // Example: run every 15 minutes during trading hours (9:30 AM - 4:00 PM ET)
  @Cron('*/15 14-21 * * 1-5') // Adjust to UTC time
  handleMarketCron() {
    this.logger.log('📈 Running 15-min trading check (market hours)');
  }
}
