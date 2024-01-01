import { Test, TestingModule } from '@nestjs/testing';
import { TopMangaController } from './top-manga.controller';
import { TopMangaService } from './top-manga.service';

describe('TopMangaController', () => {
  let controller: TopMangaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TopMangaController],
      providers: [TopMangaService],
    }).compile();

    controller = module.get<TopMangaController>(TopMangaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
