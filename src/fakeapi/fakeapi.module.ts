import { Module } from '@nestjs/common';
import { FakeapiService } from './fakeapi.service';
import { FakeapiController } from './fakeapi.controller';
import { ImageController } from './image.controller';

@Module({
  controllers: [FakeapiController,ImageController],
  providers: [FakeapiService],
})
export class FakeapiModule {}
