import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { createSendTextCommand, ThreadType } from '../connector/events';
import { RedisStreamService } from '../connector/redis-stream.service';
import { ZALO_COMMANDS_STREAM } from '../connector/stream-names';

type QueueTextMessageInput = {
  threadId: string;
  threadType: ThreadType;
  text: string;
  createdByUserId: string;
};

type QueueTextMessageResult = {
  messageId: string;
  commandId: string;
  status: 'queued';
};

@Injectable()
export class MessagesService {
  constructor(
    private readonly redisStream: RedisStreamService,
    private readonly prisma: PrismaService,
  ) {}

  async queueTextMessage(
    input: QueueTextMessageInput,
  ): Promise<QueueTextMessageResult> {
    const messageId = randomUUID();
    const commandId = randomUUID();
    const command = createSendTextCommand({
      commandId,
      messageId,
      threadId: input.threadId,
      threadType: input.threadType,
      text: input.text,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: {
          id: messageId,
          threadId: input.threadId,
          direction: 'outbound',
          messageType: 'text',
          text: input.text,
          status: 'queued',
        },
      });

      await tx.outboundCommand.create({
        data: {
          id: commandId,
          threadId: input.threadId,
          messageId,
          commandType: 'command.send_text',
          payload: {
            thread_id: input.threadId,
            thread_type: input.threadType,
            text: input.text,
          },
          status: 'queued',
          createdByUserId: input.createdByUserId,
        },
      });
    });

    try {
      await this.redisStream.publish(ZALO_COMMANDS_STREAM, command);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.prisma.outboundCommand.update({
        where: { id: commandId },
        data: { status: 'failed', error: errorMessage },
      });
      await this.prisma.message.update({
        where: { id: messageId },
        data: { status: 'failed' },
      });

      throw error;
    }

    return { messageId, commandId, status: 'queued' };
  }
}
