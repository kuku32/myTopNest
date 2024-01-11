import { Injectable, NotAcceptableException, UnauthorizedException } from '@nestjs/common';
import { CreateTopMangaDto } from './dto/create-top-manga.dto';
import { UpdateTopMangaDto } from './dto/update-top-manga.dto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
@Injectable()
export class TopMangaService {
  constructor(private readonly configService: ConfigService){}
  async getStoryLists(){

    try{
      let BASE_URL = `${this.configService.get<any>('FIREBASE_DATA')}/story-lists.json`;
      const response = await axios.get(BASE_URL);
      return response?.data
    }catch(error){
      throw new UnauthorizedException("You're not allow");
    }
  }

  async getStoryList(type:string){
    try{
      let BASE_URL = `${this.configService.get<any>('FIREBASE_DATA')}/story-lists/${type}.json`;
      const response = await axios.get(BASE_URL);
      return response?.data
    }catch(error){
      throw new UnauthorizedException("You're not allow");
    }
  }

  async getmangas(type:string,chapter:string){
    try{
      let BASE_URL = `${this.configService.get<any>('FIREBASE_DATA')}/mangas/${type}/${chapter}.json`;
      const response = await axios.get(BASE_URL);
      return response?.data
    }catch(error){
      throw new UnauthorizedException("You're not allow");
    }
  }

  /**THIS FOR ELECEED WEB */ 

  async getEleceedByChapter(chapter:string){
    try{
      let BASE_URL = `${this.configService.get<any>('ELECEED_FB')}/eleceed/chapter-${chapter}.json`;
      console.log('BASE_URL', BASE_URL)
      const response = await axios.get(BASE_URL);
      return response?.data
    }catch(error){
      throw new UnauthorizedException("You're not allow");
    }
  }
  async getEleceedOTherAttr(other:string){
    try{
      let BASE_URL = `${this.configService.get<any>('ELECEED_FB')}/${other}.json`;
      const response = await axios.get(BASE_URL);
      return response?.data
    }catch(error){
      throw new UnauthorizedException("You're not allow");
    }
  }
}
