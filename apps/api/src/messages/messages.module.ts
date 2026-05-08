import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ConnectorModule } from '../connector/connector.module';
import { MessagesService } from './messages.service';

@Module({
  imports: [ConnectorModule, PrismaModule],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
