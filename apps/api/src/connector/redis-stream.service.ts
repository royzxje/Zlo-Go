import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';

export const REDIS_STREAM_CLIENT = Symbol('REDIS_STREAM_CLIENT');

export interface RedisStreamClient {
  xadd(
    stream: string,
    id: string,
    field: string,
    value: string,
  ): Promise<string | null>;
  xread(...args: unknown[]): Promise<unknown>;
  xdel(stream: string, id: string): Promise<number>;
  disconnect(): void;
}

@Injectable()
export class RedisStreamService implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_STREAM_CLIENT) private readonly redis: RedisStreamClient,
  ) {}

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
