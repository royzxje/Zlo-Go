import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('connects when the module initializes', async () => {
    const connect = jest
      .spyOn(PrismaService.prototype, '$connect')
      .mockResolvedValue(undefined);
    const service = new PrismaService();

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('disconnects when the module is destroyed', async () => {
    const disconnect = jest
      .spyOn(PrismaService.prototype, '$disconnect')
      .mockResolvedValue(undefined);
    const service = new PrismaService();

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
