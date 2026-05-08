export type ThreadType = 'USER' | 'GROUP';

export type SendTextCommandInput = {
  commandId: string;
  messageId: string;
  threadId: string;
  threadType: ThreadType;
  text: string;
};

export type SendTextCommand = {
  type: 'command.send_text';
  command_id: string;
  message_id: string;
  thread_id: string;
  thread_type: ThreadType;
  payload: { text: string };
};

export function createSendTextCommand(
  input: SendTextCommandInput,
): SendTextCommand {
  return {
    type: 'command.send_text',
    command_id: input.commandId,
    message_id: input.messageId,
    thread_id: input.threadId,
    thread_type: input.threadType,
    payload: { text: input.text },
  };
}
