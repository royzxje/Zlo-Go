import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { createSendTextCommand, ThreadType } from '../connector/events';
import { RedisStreamService } from '../connector/redis-stream.service';
import { ZALO_COMMANDS_STREAM } from '../connector/stream-names';

type QueueTextMessageInput = {
  threadId: string;
  threadType: ThreadType;
  text: string;
};

type QueueTextMessageResult = {
  messageId: string;
  commandId: string;
  status: 'queued';
};

@Injectable()
export class MessagesService {
  constructor(private readonly redisStream: RedisStreamService) {}

  async queueTextMessage(
    input: QueueTextMessageInput,
  ): Promise<QueueTextMessageResult> {
    const messageId = randomUUID();
    const commandId = randomUUID();

    await this.redisStream.publish(
      ZALO_COMMANDS_STREAM,
      createSendTextCommand({
        commandId,
        messageId,
        threadId: input.threadId,
        threadType: input.threadType,
        text: input.text,
      }),
    );

    return { messageId, commandId, status: 'queued' };
  }
}
