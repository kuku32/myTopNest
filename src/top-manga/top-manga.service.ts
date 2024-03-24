import { Injectable, NotAcceptableException, UnauthorizedException } from '@nestjs/common';
import { CreateTopMangaDto } from './dto/create-top-manga.dto';
import { UpdateTopMangaDto } from './dto/update-top-manga.dto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as uuid from 'uuid';
import * as crypto from 'crypto';
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

  async postUserBLockAds(type:string,chapter:string, data:any){
    try{
      let BASE_URL = `${this.configService.get<any>('FIREBASE_DATA')}/userviews/${type}/${chapter}/${data?.uuid}.json`;
      const response = await axios.post(BASE_URL, data);
      return response?.data
    }catch(error){
      throw new UnauthorizedException("You're not allow");
    }
  }

  /**THIS FOR ELECEED WEB */ 
  async getmangasVELE(type:string,chapter:string){
    try{
      let BASE_URL = `${this.configService.get<any>('FIREBASE_DATA')}/mangas/${type}/chapter-${chapter}.json`;
      const response = await axios.get(BASE_URL);
      return response?.data
    }catch(error){
      throw new UnauthorizedException("You're not allow");
    }
  }

  async getmangasVELEAttr(type:string,other:string){
    try{
      let BASE_URL = `${this.configService.get<any>('FIREBASE_DATA')}/story-lists/${type}/${other}.json`;
      const response = await axios.get(BASE_URL);
      return response?.data
    }catch(error){
      throw new UnauthorizedException("You're not allow");
    }
  }

  async getEleceedByChapter(chapter:string){
    try{
      let BASE_URL = `${this.configService.get<any>('ELECEED_FB')}/eleceed/chapter-${chapter}.json`;
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

  async postImagekitIo(){
    try{
      const token = uuid.v4();
      const expire = Math.floor(Date.now() / 1000) + 2400;
      const privateAPIKey = `${this.configService.get<any>('IMAGE_KIT_IO')}`;
      const signature = crypto.createHmac('sha1', privateAPIKey).update(token + expire).digest('hex');
      const respond ={
        token,
        expire,
        signature
      }
      return respond
    }catch(error){
      throw new UnauthorizedException("You're not allow");
    }
  }
}
