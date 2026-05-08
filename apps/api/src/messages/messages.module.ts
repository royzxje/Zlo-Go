import { Module } from '@nestjs/common';
import { ConnectorModule } from '../connector/connector.module';
import { MessagesService } from './messages.service';

@Module({
  imports: [ConnectorModule],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
