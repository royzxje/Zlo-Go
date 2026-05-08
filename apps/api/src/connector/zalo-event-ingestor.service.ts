import { Injectable } from '@nestjs/common';

import { PrismaService } from '../common/prisma/prisma.service';

type ZaloSendSucceededEvent = {
  type: 'message.send_succeeded';
  message_id: string;
  zalo_message_id: string;
};

@Injectable()
export class ZaloEventIngestorService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(event: ZaloSendSucceededEvent): Promise<void> {
    await this.prisma.message.update({
      where: { id: event.message_id },
      data: {
        status: 'sent',
        zaloMessageId: event.zalo_message_id,
      },
    });
  }
}
