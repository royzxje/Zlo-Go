import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { ConnectorModule } from './connector/connector.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [PrismaModule, ConnectorModule, HealthModule] })
export class AppModule {}
