import { Controller, Get, Post, Body, Patch, Param, Delete,Req  } from '@nestjs/common';
import { TopMangaService } from './top-manga.service';

@Controller('top-manga')
export class TopMangaController {
  constructor(private readonly topMangaService: TopMangaService) {}

  @Get('story-lists')
  getStoryLists(){
    return this.topMangaService.getStoryLists()
  }

  @Get('story-lists/:type')
  getStoryList(@Param('type') type: string){
    return this.topMangaService.getStoryList(type)
  }

  @Get('mangas/:type/:chapter')
  getmangas(@Param('type') type: string,@Param('chapter') chapter: string){
    return this.topMangaService.getmangas(type,chapter)
  }

  @Get('eleceed/:chapter')
  getEleceedByChapter(@Param('chapter') chapter: string){
    if(['maxlength','pageViolation'].includes(chapter)){
      return this.topMangaService.getEleceedOTherAttr(chapter)
    }else{
      return this.topMangaService.getEleceedByChapter(chapter)
    }
  }

  @Get('/:type/:chapter')
  getmangasVELE(@Param('type') type: string,@Param('chapter') chapter: string){
    return this.topMangaService.getmangasVELE(type,chapter)
  }

  @Get('ip')
  getIpAddress(@Req() request): string {
    const ipAddress = request.headers['x-forwarded-for'] || request.connection.remoteAddress;
    return ipAddress;
  }

  @Get('/auth')
  authenticate() {
    return this.topMangaService.postImagekitIo()

  }
}
