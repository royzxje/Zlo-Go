import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { ChatLayout } from './ChatLayout';

it('renders core chat regions', () => {
  render(<ChatLayout />);
  expect(screen.getByText('Conversations')).toBeInTheDocument();
  expect(screen.getByText('Select a conversation')).toBeInTheDocument();
  expect(screen.getByText('Zalo disconnected')).toBeInTheDocument();
});

it('marks the chat shell as responsive', () => {
  render(<ChatLayout />);
  expect(screen.getByTestId('chat-shell')).toHaveClass('chat-shell');
});
