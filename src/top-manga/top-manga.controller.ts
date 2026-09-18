import { Controller, Get, Post, Body, Patch, Param, Delete,Req, Query  } from '@nestjs/common';
import { TopMangaService } from './top-manga.service';
import {
  Throttle,
} from '@nestjs/throttler';
@Controller('top-manga')
export class TopMangaController {
  constructor(private readonly topMangaService: TopMangaService) {}

  @Get('story-lists')
  @Throttle({
    default: {
      ttl: 60_000,
      limit: 10,
    },
  })
  getStoryLists(@Query('page') page:any){
    return this.topMangaService.getStoryLists(page)
  }

  @Get('story-lists/:type')
  @Throttle({
    default: {
      ttl: 60_000,
      limit: 10,
    },
  })
  getStoryList(@Param('type') type: string, @Query('page') page:string){
    return this.topMangaService.getStoryList(type, page)
  }

  @Get('mangas/:type/:chapter')
  @Throttle({
    default: {
      ttl: 60_000,
      limit: 10,
    },
  })
  getmangas(@Param('type') type: string,@Param('chapter') chapter: string){
    return this.topMangaService.getmangas(type,chapter)
  }

  @Post('userviews/:type/:chapter')
  @Throttle({
    default: {
      ttl: 60_000,
      limit: 10,
    },
  })
  postUserBLockAds(@Param('type') type: string,@Param('chapter') chapter: string,@Body()data:any ){
    return this.topMangaService.postUserBLockAds(type,chapter,data)
  }

  // @Get('eleceed/:chapter')
  // getEleceedByChapter(@Param('chapter') chapter: string){
  //   if(['maxlength','pageViolation','targetAge'].includes(chapter)){
  //     return this.topMangaService.getEleceedOTherAttr(chapter)
  //   }else{
  //     return this.topMangaService.getEleceedByChapter(chapter)
  //   }
  // }

  @Get('/:type/:chapter')
  @Throttle({
    default: {
      ttl: 60_000,
      limit: 10,
    },
  })
  getmangasVELE(@Param('type') type: string,@Param('chapter') chapter: string){
    if(['maxlength','pageViolation','targetAge'].includes(chapter)){
      return this.topMangaService.getmangasVELEAttr(type,chapter)
    }else{
      return this.topMangaService.getmangasVELE(type,chapter)
    }
    
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
