import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { ConnectorModule } from './connector/connector.module';
import { HealthModule } from './health/health.module';
import { MessagesModule } from './messages/messages.module';

@Module({ imports: [PrismaModule, ConnectorModule, HealthModule, MessagesModule] })
export class AppModule {}
