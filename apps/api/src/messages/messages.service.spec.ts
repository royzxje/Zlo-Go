import { ZALO_COMMANDS_STREAM } from '../connector/stream-names';
import { RedisStreamService } from '../connector/redis-stream.service';
import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  it('queues an outbound text command and returns the queued message status', async () => {
    const redisStream = {
      publish: jest.fn<Promise<string>, [string, Record<string, unknown>]>()
        .mockResolvedValue('1746700000000-0'),
    } satisfies Pick<RedisStreamService, 'publish'>;
    const service = new MessagesService(redisStream as unknown as RedisStreamService);

    const result = await service.queueTextMessage({
      threadId: 'thread-1',
      threadType: 'USER',
      text: 'Hello Zalo',
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
  });
});
