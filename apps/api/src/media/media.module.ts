import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MediaArchiveService } from './media-archive.service';

@Module({
  imports: [PrismaModule],
  providers: [MediaArchiveService],
  exports: [MediaArchiveService],
})
export class MediaModule {}
