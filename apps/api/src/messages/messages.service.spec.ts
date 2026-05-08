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
    const prisma: Record<string, any> = {
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
    prisma.$transaction = jest.fn(async (callback) => callback(prisma));
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

  it('writes message and outbound command in one transaction before publishing', async () => {
    const calls: string[] = [];
    const redisStream = {
      publish: jest.fn().mockImplementation(async () => {
        calls.push('redis.publish');
        return '1746700000000-0';
      }),
    } satisfies Pick<RedisStreamService, 'publish'>;
    const prisma: Record<string, any> = {
      message: {
        create: jest.fn().mockImplementation(async () => {
          calls.push('message.create');
        }),
        update: jest.fn(),
      },
      outboundCommand: {
        create: jest.fn().mockImplementation(async () => {
          calls.push('outboundCommand.create');
        }),
        update: jest.fn(),
      },
    };
    prisma.$transaction = jest.fn(async (callback) => {
      calls.push('transaction.start');
      const result = await callback(prisma);
      calls.push('transaction.end');
      return result;
    });
    const service = new MessagesService(
      redisStream as unknown as RedisStreamService,
      prisma as unknown as PrismaService,
    );

    await service.queueTextMessage({
      threadId: 'thread-1',
      threadType: 'USER',
      text: 'Hello Zalo',
      createdByUserId: 'user-1',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      'transaction.start',
      'message.create',
      'outboundCommand.create',
      'transaction.end',
      'redis.publish',
    ]);
  });

  it('marks the message and outbound command failed when Redis publish fails', async () => {
    const publishError = new Error('redis unavailable');
    const redisStream = {
      publish: jest.fn().mockRejectedValue(publishError),
    } satisfies Pick<RedisStreamService, 'publish'>;
    const prisma: Record<string, any> = {
      message: {
        create: jest.fn(),
        update: jest.fn(),
      },
      outboundCommand: {
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    prisma.$transaction = jest.fn(async (callback) => callback(prisma));
    const service = new MessagesService(
      redisStream as unknown as RedisStreamService,
      prisma as unknown as PrismaService,
    );

    await expect(service.queueTextMessage({
      threadId: 'thread-1',
      threadType: 'USER',
      text: 'Hello Zalo',
      createdByUserId: 'user-1',
    })).rejects.toThrow('redis unavailable');

    const messageId = prisma.message.create.mock.calls[0][0].data.id;
    const commandId = prisma.outboundCommand.create.mock.calls[0][0].data.id;
    expect(prisma.outboundCommand.update).toHaveBeenCalledWith({
      where: { id: commandId },
      data: { status: 'failed', error: 'redis unavailable' },
    });
    expect(prisma.message.update).toHaveBeenCalledWith({
      where: { id: messageId },
      data: { status: 'failed' },
    });
  });
});
