import { PrismaService } from '../common/prisma/prisma.service';
import { MediaArchiveService } from './media-archive.service';

describe('MediaArchiveService', () => {
  it('marks media failed_retryable when source URL is missing', async () => {
    const prisma = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'media-1',
          sourceUrl: null,
          retryCount: 2,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'media-1',
          archiveStatus: 'failed_retryable',
          lastError: 'source_url_missing',
          retryCount: 3,
        }),
      },
    };
    const service = new MediaArchiveService(
      prisma as unknown as PrismaService,
    );

    const result = await service.archive('media-1');

    expect(prisma.mediaAsset.update).toHaveBeenCalledWith({
      where: { id: 'media-1' },
      data: {
        archiveStatus: 'failed_retryable',
        lastError: 'source_url_missing',
        retryCount: { increment: 1 },
      },
    });
    expect(result).toEqual({
      id: 'media-1',
      archiveStatus: 'failed_retryable',
      lastError: 'source_url_missing',
      retryCount: 3,
    });
  });
});
