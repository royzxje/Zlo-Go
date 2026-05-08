import { RedisStreamService } from './redis-stream.service';

describe('RedisStreamService', () => {
  const createRedis = (overrides: Record<string, unknown> = {}) => ({
    xadd: jest.fn(),
    xread: jest.fn(),
    xdel: jest.fn(),
    disconnect: jest.fn(),
    ...overrides,
  });

  it('publishes events to Redis streams', async () => {
    const redis = createRedis({
      xadd: jest.fn().mockResolvedValue('stream-id-1'),
    });
    const service = new RedisStreamService(redis);

    await expect(
      service.publish('zalo.commands', { type: 'x' }),
    ).resolves.toBe('stream-id-1');

    expect(redis.xadd).toHaveBeenCalledWith(
      'zalo.commands',
      '*',
      'event',
      JSON.stringify({ type: 'x' }),
    );
  });

  it('throws when Redis does not return a stream entry id', async () => {
    const redis = createRedis({
      xadd: jest.fn().mockResolvedValue(null),
    });
    const service = new RedisStreamService(redis);

    await expect(service.publish('zalo.commands', { type: 'x' })).rejects.toThrow(
      'Failed to publish Redis stream entry to zalo.commands',
    );
  });

  it('disconnects Redis on module destroy', async () => {
    const redis = createRedis();
    const service = new RedisStreamService(redis);

    await service.onModuleDestroy();

    expect(redis.disconnect).toHaveBeenCalledTimes(1);
  });
});
