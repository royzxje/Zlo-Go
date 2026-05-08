import { isValidMessageSender } from './message-sender.validation';

describe('isValidMessageSender', () => {
  it('requires inbound messages to have only a contact sender', () => {
    expect(
      isValidMessageSender({
        direction: 'inbound',
        senderContactId: 'contact-1',
        senderUserId: null,
      }),
    ).toBe(true);
    expect(
      isValidMessageSender({
        direction: 'inbound',
        senderContactId: null,
        senderUserId: null,
      }),
    ).toBe(false);
    expect(
      isValidMessageSender({
        direction: 'inbound',
        senderContactId: 'contact-1',
        senderUserId: 'user-1',
      }),
    ).toBe(false);
  });

  it('requires outbound messages to have only a user sender', () => {
    expect(
      isValidMessageSender({
        direction: 'outbound',
        senderContactId: null,
        senderUserId: 'user-1',
      }),
    ).toBe(true);
    expect(
      isValidMessageSender({
        direction: 'outbound',
        senderContactId: null,
        senderUserId: null,
      }),
    ).toBe(false);
    expect(
      isValidMessageSender({
        direction: 'outbound',
        senderContactId: 'contact-1',
        senderUserId: 'user-1',
      }),
    ).toBe(false);
  });
});
