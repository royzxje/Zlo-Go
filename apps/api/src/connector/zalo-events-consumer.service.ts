import { Injectable } from '@nestjs/common';

import { ZaloEventIngestorService } from './zalo-event-ingestor.service';

type AckStreamEntry = (id: string) => Promise<void>;

@Injectable()
export class ZaloEventsConsumerService {
  constructor(private readonly ingestor: ZaloEventIngestorService) {}

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
}
