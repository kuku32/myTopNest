import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TopMangaModule } from './top-manga/top-manga.module';
import { FakeapiModule } from './fakeapi/fakeapi.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
    }),
    TopMangaModule,
    FakeapiModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
