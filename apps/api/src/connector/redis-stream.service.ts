import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisStreamService implements OnModuleDestroy {
  private readonly redis = new Redis(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
  );

  async publish(stream: string, event: Record<string, unknown>): Promise<string> {
    const entryId = await this.redis.xadd(
      stream,
      '*',
      'event',
      JSON.stringify(event),
    );

    if (entryId === null) {
      throw new Error(`Failed to publish Redis stream entry to ${stream}`);
    }

    return entryId;
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
  }
}
