import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FakeapiService {

  async findAll(path: string, postId?: string) {
    let url = 'https://jsonplaceholder.typicode.com/' + path;
    url = postId ? url + `?postId=${postId}` : url;
    console.log(url);
    const response = await axios.get(url);
    return response?.data ? response?.data : [];
  }
}
