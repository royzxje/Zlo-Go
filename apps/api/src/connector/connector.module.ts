import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import {
  REDIS_STREAM_CLIENT,
  RedisStreamService,
} from './redis-stream.service';
import { ZaloEventIngestorService } from './zalo-event-ingestor.service';
import { ZaloEventsConsumerService } from './zalo-events-consumer.service';

@Module({
  providers: [
    {
      provide: REDIS_STREAM_CLIENT,
      useFactory: () =>
        new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379'),
    },
    RedisStreamService,
    ZaloEventIngestorService,
    ZaloEventsConsumerService,
  ],
  exports: [RedisStreamService, ZaloEventIngestorService, ZaloEventsConsumerService],
})
export class ConnectorModule {}
