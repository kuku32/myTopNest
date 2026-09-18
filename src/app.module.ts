import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TopMangaModule } from './top-manga/top-manga.module';
import { FakeapiModule } from './fakeapi/fakeapi.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
    }),
    TopMangaModule,
    FakeapiModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 1 minute
        limit: 60,   // max 60 requests per minute
      },
    ]),
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
