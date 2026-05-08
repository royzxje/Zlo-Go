type MessageSenderInput = {
  direction: 'inbound' | 'outbound';
  senderContactId?: string | null;
  senderUserId?: string | null;
};

export function isValidMessageSender(message: MessageSenderInput): boolean {
  if (message.direction === 'inbound') {
    return Boolean(message.senderContactId) && !message.senderUserId;
  }

  return Boolean(message.senderUserId) && !message.senderContactId;
}
