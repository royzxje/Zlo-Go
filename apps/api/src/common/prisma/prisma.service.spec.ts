import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('constructs with Prisma client methods', () => {
    const service = new PrismaService();

    expect(typeof service.$connect).toBe('function');
    expect(typeof service.$disconnect).toBe('function');
  });
});
