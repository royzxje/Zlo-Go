export type Role = 'OWNER' | 'MANAGER' | 'AGENT';

export type SendPolicyInput = {
  role: Role;
  userId: string;
  assignedToUserId: string | null;
};

export function canSendInConversation(input: SendPolicyInput): boolean {
  if (input.role === 'OWNER' || input.role === 'MANAGER') {
    return true;
  }

  if (input.assignedToUserId === null) {
    return true;
  }

  return input.assignedToUserId === input.userId;
}
