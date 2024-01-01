import { PartialType } from '@nestjs/mapped-types';
import { CreateTopMangaDto } from './create-top-manga.dto';

export class UpdateTopMangaDto extends PartialType(CreateTopMangaDto) {}
