import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class MediaArchiveService {
  constructor(private readonly prisma: PrismaService) {}

  async archive(mediaId: string) {
    const media = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaId },
      select: { sourceUrl: true },
    });

    if (!media?.sourceUrl) {
      return this.prisma.mediaAsset.update({
        where: { id: mediaId },
        data: {
          archiveStatus: 'failed_retryable',
          lastError: 'source_url_missing',
          retryCount: { increment: 1 },
        },
      });
    }

    return this.prisma.mediaAsset.update({
      where: { id: mediaId },
      data: { archiveStatus: 'archived' },
    });
  }
}
