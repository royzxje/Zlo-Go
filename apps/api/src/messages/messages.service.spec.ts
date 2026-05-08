import { ZALO_COMMANDS_STREAM } from '../connector/stream-names';
import { RedisStreamService } from '../connector/redis-stream.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  it('queues an outbound text command and returns the queued message status', async () => {
    const calls: string[] = [];
    const redisStream = {
      publish: jest.fn<Promise<string>, [string, Record<string, unknown>]>()
        .mockImplementation(async () => {
          calls.push('redis.publish');
          return '1746700000000-0';
        }),
    } satisfies Pick<RedisStreamService, 'publish'>;
    const prisma = {
      message: {
        create: jest.fn().mockImplementation(async () => {
          calls.push('message.create');
        }),
      },
      outboundCommand: {
        create: jest.fn().mockImplementation(async () => {
          calls.push('outboundCommand.create');
        }),
      },
    };
    const service = new MessagesService(
      redisStream as unknown as RedisStreamService,
      prisma as unknown as PrismaService,
    );

    const result = await service.queueTextMessage({
      threadId: 'thread-1',
      threadType: 'USER',
      text: 'Hello Zalo',
      createdByUserId: 'user-1',
    });

    expect(prisma.message.create).toHaveBeenCalledWith({
      data: {
        id: result.messageId,
        threadId: 'thread-1',
        direction: 'outbound',
        messageType: 'text',
        text: 'Hello Zalo',
        status: 'queued',
      },
    });
    expect(prisma.outboundCommand.create).toHaveBeenCalledWith({
      data: {
        id: result.commandId,
        threadId: 'thread-1',
        messageId: result.messageId,
        commandType: 'command.send_text',
        payload: {
          thread_id: 'thread-1',
          thread_type: 'USER',
          text: 'Hello Zalo',
        },
        status: 'queued',
        createdByUserId: 'user-1',
      },
    });
    expect(redisStream.publish).toHaveBeenCalledWith(ZALO_COMMANDS_STREAM, {
      type: 'command.send_text',
      command_id: result.commandId,
      message_id: result.messageId,
      thread_id: 'thread-1',
      thread_type: 'USER',
      payload: { text: 'Hello Zalo' },
    });
    expect(result).toEqual({
      messageId: result.messageId,
      commandId: result.commandId,
      status: 'queued',
    });
    expect(result.messageId).toEqual(expect.any(String));
    expect(result.commandId).toEqual(expect.any(String));
    expect(calls).toEqual([
      'message.create',
      'outboundCommand.create',
      'redis.publish',
    ]);
  });
});
