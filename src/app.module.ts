import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TopMangaModule } from './top-manga/top-manga.module';
import { ThrottlerModule } from '@nestjs/throttler';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
    }),
    TopMangaModule,
    ThrottlerModule.forRoot([{
      ttl: 3000,
      limit: 3,
    }])
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
