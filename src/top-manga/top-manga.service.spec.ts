import { Test, TestingModule } from '@nestjs/testing';
import { TopMangaService } from './top-manga.service';

describe('TopMangaService', () => {
  let service: TopMangaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TopMangaService],
    }).compile();

    service = module.get<TopMangaService>(TopMangaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
