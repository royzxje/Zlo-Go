import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { REDIS_STREAM_CLIENT, RedisStreamClient } from './redis-stream.service';
import { ZALO_EVENTS_STREAM } from './stream-names';
import { ZaloEventIngestorService } from './zalo-event-ingestor.service';

type AckStreamEntry = (id: string) => Promise<void>;

@Injectable()
export class ZaloEventsConsumerService implements OnModuleInit, OnModuleDestroy {
  private isRunning = false;
  private lastSeenId = '$';

  constructor(
    private readonly ingestor: ZaloEventIngestorService,
    @Inject(REDIS_STREAM_CLIENT) private readonly redis: RedisStreamClient,
  ) {}

  async onModuleInit(): Promise<void> {
    this.isRunning = true;
    void this.poll();
  }

  async onModuleDestroy(): Promise<void> {
    this.isRunning = false;
  }

  async processStreamEntry(
    id: string,
    fields: string[],
    ack: AckStreamEntry,
  ): Promise<void> {
    const eventJson = this.getField(fields, 'event');

    if (eventJson === undefined) {
      throw new Error(`Redis stream entry ${id} is missing event field`);
    }

    await this.ingestor.ingest(JSON.parse(eventJson));
    await ack(id);
  }

  private getField(fields: string[], name: string): string | undefined {
    for (let index = 0; index < fields.length; index += 2) {
      if (fields[index] === name) {
        return fields[index + 1];
      }
    }

    return undefined;
  }

  private async poll(): Promise<void> {
    while (this.isRunning) {
      try {
        const result = await this.redis.xread(
          'BLOCK',
          1000,
          'COUNT',
          10,
          'STREAMS',
          ZALO_EVENTS_STREAM,
          this.lastSeenId,
        );

        for (const [stream, entries] of this.parseReadResult(result)) {
          for (const [id, fields] of entries) {
            await this.processStreamEntry(id, fields, async (entryId) => {
              await this.redis.xdel(stream, entryId);
            });
            this.lastSeenId = id;
          }
        }
      } catch {
        // Minimal XREAD/XDEL runner for MVP; consumer groups are future hardening.
      }
    }
  }

  private parseReadResult(result: unknown): Array<[string, Array<[string, string[]]>]> {
    if (!Array.isArray(result)) {
      return [];
    }

    return result as Array<[string, Array<[string, string[]]>]>;
  }
}
