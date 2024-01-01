import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { TopMangaModule } from './top-manga/top-manga.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
    }),
    TopMangaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
