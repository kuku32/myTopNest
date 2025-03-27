import { Module } from '@nestjs/common';
import { FakeapiService } from './fakeapi.service';
import { FakeapiController } from './fakeapi.controller';

@Module({
  controllers: [FakeapiController],
  providers: [FakeapiService],
})
export class FakeapiModule {}
