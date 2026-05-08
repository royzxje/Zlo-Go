import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class MediaArchiveService {
  constructor(private readonly prisma: PrismaService) {}

  async archive(media: { id: string; sourceUrl: string | null }) {
    if (!media.sourceUrl) {
      return this.prisma.mediaAsset.update({
        where: { id: media.id },
        data: {
          archiveStatus: 'failed_retryable',
          lastError: 'source_url_missing',
          retryCount: { increment: 1 },
        },
      });
    }

    return this.prisma.mediaAsset.update({
      where: { id: media.id },
      data: { archiveStatus: 'archived', lastError: null },
    });
  }
}
