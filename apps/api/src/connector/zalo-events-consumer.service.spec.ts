import { ZaloEventIngestorService } from './zalo-event-ingestor.service';
import { ZaloEventsConsumerService } from './zalo-events-consumer.service';

describe('ZaloEventsConsumerService', () => {
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
});
