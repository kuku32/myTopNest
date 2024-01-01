import { Module } from '@nestjs/common';
import { TopMangaService } from './top-manga.service';
import { TopMangaController } from './top-manga.controller';

@Module({
  controllers: [TopMangaController],
  providers: [TopMangaService],
})
export class TopMangaModule {}
