import { PrismaService } from '../common/prisma/prisma.service';
import { ZaloEventIngestorService } from './zalo-event-ingestor.service';

describe('ZaloEventIngestorService', () => {
  it('maps send_succeeded events to a sent message update', async () => {
    const prisma = {
      message: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new ZaloEventIngestorService(
      prisma as unknown as PrismaService,
    );

    await service.ingest({
      type: 'message.send_succeeded',
      message_id: 'message-1',
      zalo_message_id: 'zalo-message-1',
    });

    expect(prisma.message.update).toHaveBeenCalledWith({
      where: { id: 'message-1' },
      data: {
        status: 'sent',
        zaloMessageId: 'zalo-message-1',
      },
    });
  });
});
