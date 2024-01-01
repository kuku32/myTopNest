import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TopMangaModule } from './top-manga/top-manga.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
    }),
    TopMangaModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
