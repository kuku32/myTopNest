import { Injectable } from '@nestjs/common';
import { CreateTopMangaDto } from './dto/create-top-manga.dto';
import { UpdateTopMangaDto } from './dto/update-top-manga.dto';

@Injectable()
export class TopMangaService {
  create(createTopMangaDto: CreateTopMangaDto) {
    return 'This action adds a new topManga';
  }

  findAll() {
    return `This action returns all topManga`;
  }

  findOne(id: number) {
    return `This action returns a #${id} topManga`;
  }

  update(id: number, updateTopMangaDto: UpdateTopMangaDto) {
    return `This action updates a #${id} topManga`;
  }

  remove(id: number) {
    return `This action removes a #${id} topManga`;
  }
}
