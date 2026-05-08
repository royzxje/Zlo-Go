import { createSendTextCommand } from './events';
import { ZALO_COMMANDS_STREAM, ZALO_EVENTS_STREAM } from './stream-names';

describe('connector event contract', () => {
  it('uses stable stream names', () => {
    expect(ZALO_EVENTS_STREAM).toBe('zalo.events');
    expect(ZALO_COMMANDS_STREAM).toBe('zalo.commands');
  });

  it('creates send text command payload', () => {
    expect(
      createSendTextCommand({
        commandId: 'cmd-1',
        messageId: 'msg-1',
        threadId: 'thread-1',
        threadType: 'USER',
        text: 'hello',
      }),
    ).toEqual({
      type: 'command.send_text',
      command_id: 'cmd-1',
      message_id: 'msg-1',
      thread_id: 'thread-1',
      thread_type: 'USER',
      payload: { text: 'hello' },
    });
  });
});
