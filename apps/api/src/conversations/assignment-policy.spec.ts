import { canSendInConversation } from './assignment-policy';

describe('canSendInConversation', () => {
  it('allows owner in any thread', () => {
    expect(
      canSendInConversation({
        role: 'OWNER',
        userId: 'owner',
        assignedToUserId: 'agent-1',
      }),
    ).toBe(true);
  });

  it('allows manager in any thread', () => {
    expect(
      canSendInConversation({
        role: 'MANAGER',
        userId: 'manager',
        assignedToUserId: 'agent-1',
      }),
    ).toBe(true);
  });

  it('allows agent in unassigned thread', () => {
    expect(
      canSendInConversation({
        role: 'AGENT',
        userId: 'agent-1',
        assignedToUserId: null,
      }),
    ).toBe(true);
  });

  it('allows agent assigned to self', () => {
    expect(
      canSendInConversation({
        role: 'AGENT',
        userId: 'agent-1',
        assignedToUserId: 'agent-1',
      }),
    ).toBe(true);
  });

  it('blocks agent assigned to another agent', () => {
    expect(
      canSendInConversation({
        role: 'AGENT',
        userId: 'agent-1',
        assignedToUserId: 'agent-2',
      }),
    ).toBe(false);
  });
});
