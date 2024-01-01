import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TopMangaService } from './top-manga.service';
import { CreateTopMangaDto } from './dto/create-top-manga.dto';
import { UpdateTopMangaDto } from './dto/update-top-manga.dto';

@Controller('top-manga')
export class TopMangaController {
  constructor(private readonly topMangaService: TopMangaService) {}

  @Post()
  create(@Body() createTopMangaDto: CreateTopMangaDto) {
    return this.topMangaService.create(createTopMangaDto);
  }

  @Get()
  findAll() {
    return this.topMangaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.topMangaService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTopMangaDto: UpdateTopMangaDto) {
    return this.topMangaService.update(+id, updateTopMangaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.topMangaService.remove(+id);
  }
}
