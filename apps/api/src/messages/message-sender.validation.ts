type MessageSenderInput = {
  direction: 'inbound' | 'outbound';
  senderContactId?: string | null;
  senderUserId?: string | null;
};

// Service-level invariant for message writes until database check constraints exist.
export function isValidMessageSender(message: MessageSenderInput): boolean {
  if (message.direction === 'inbound') {
    return Boolean(message.senderContactId) && !message.senderUserId;
  }

  return Boolean(message.senderUserId) && !message.senderContactId;
}
