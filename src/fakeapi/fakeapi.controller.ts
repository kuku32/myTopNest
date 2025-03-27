import { Controller, Get, Param, Query } from '@nestjs/common';
import { FakeapiService } from './fakeapi.service';

@Controller('fakeapi')
export class FakeapiController {
  constructor(private readonly fakeapiService: FakeapiService) {}
  @Get('/:path')
  findAll( @Param('path') path: string, @Query('postId') postId: string,) {
    return this.fakeapiService.findAll(path, postId);
  }
}
