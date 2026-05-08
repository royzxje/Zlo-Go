import { RedisStreamClient } from './redis-stream.service';
import { ZaloEventIngestorService } from './zalo-event-ingestor.service';
import { ZaloEventsConsumerService } from './zalo-events-consumer.service';

describe('ZaloEventsConsumerService', () => {
  const redis = {
    xadd: jest.fn(),
    xread: jest.fn(),
    xdel: jest.fn(),
    disconnect: jest.fn(),
  } as unknown as RedisStreamClient;

  it('ingests a Redis stream event and ACKs after ingest succeeds', async () => {
    const calls: string[] = [];
    const ingestor = {
      ingest: jest.fn().mockImplementation(async () => {
        calls.push('ingest');
      }),
    } satisfies Pick<ZaloEventIngestorService, 'ingest'>;
    const ack = jest.fn().mockImplementation(async () => {
      calls.push('ack');
    });
    const service = new ZaloEventsConsumerService(
      ingestor as unknown as ZaloEventIngestorService,
      redis,
    );

    await service.processStreamEntry(
      '1746700000000-0',
      ['event', JSON.stringify({
        type: 'message.send_succeeded',
        command_id: 'cmd-1',
        message_id: 'msg-1',
        zalo_message_id: 'zalo-1',
      })],
      ack,
    );

    expect(ingestor.ingest).toHaveBeenCalledWith({
      type: 'message.send_succeeded',
      command_id: 'cmd-1',
      message_id: 'msg-1',
      zalo_message_id: 'zalo-1',
    });
    expect(ack).toHaveBeenCalledWith('1746700000000-0');
    expect(calls).toEqual(['ingest', 'ack']);
  });

  it('starts a non-blocking Redis polling loop and deletes entries after ingest succeeds', async () => {
    const ingestor = {
      ingest: jest.fn().mockResolvedValue(undefined),
    } satisfies Pick<ZaloEventIngestorService, 'ingest'>;
    let resolveRead: ((value: unknown) => void) | undefined;
    const streamClient = {
      xread: jest.fn().mockImplementation(() => new Promise((resolve) => {
        resolveRead = resolve;
      })),
      xdel: jest.fn().mockResolvedValue(1),
      disconnect: jest.fn(),
    } as unknown as RedisStreamClient;
    const service = new ZaloEventsConsumerService(
      ingestor as unknown as ZaloEventIngestorService,
      streamClient,
    );

    const init = service.onModuleInit();

    await expect(init).resolves.toBeUndefined();
    expect(streamClient.xread).toHaveBeenCalledWith(
      'BLOCK',
      1000,
      'COUNT',
      10,
      'STREAMS',
      'zalo.events',
      '$',
    );

    resolveRead?.([
      [
        'zalo.events',
        [[
          '1746700000000-0',
          ['event', JSON.stringify({
            type: 'message.send_succeeded',
            command_id: 'cmd-1',
            message_id: 'msg-1',
            zalo_message_id: 'zalo-1',
          })],
        ]],
      ],
    ]);
    await Promise.resolve();
    await Promise.resolve();

    expect(ingestor.ingest).toHaveBeenCalledWith({
      type: 'message.send_succeeded',
      command_id: 'cmd-1',
      message_id: 'msg-1',
      zalo_message_id: 'zalo-1',
    });
    expect(streamClient.xdel).toHaveBeenCalledWith('zalo.events', '1746700000000-0');

    await service.onModuleDestroy();
  });
});
