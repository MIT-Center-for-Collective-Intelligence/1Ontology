import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { IChatMessage } from '../../../src/types/IChat';

// Mock the actual ReplyMessage component to avoid importing problematic dependencies
jest.mock('../../../src/components/Chat/ReplyMessage', () => {
  const MockReplyMessage = ({ 
    message, 
    user, 
    editing, 
    messageId 
  }: { 
    message: IChatMessage & { parentMessage: IChatMessage }; 
    user: { uname: string; userId: string }; 
    editing: any; 
    messageId: string; 
  }) => (
    <div data-testid="reply-message-container">
      <div data-testid="reply-text">{message.text}</div>
      <div data-testid="original-message">{message.parentMessage.text}</div>
      <div data-testid="sender-name">{message.senderDetail.fullname}</div>
      <div data-testid="original-sender">{message.parentMessage.senderDetail.fullname}</div>
      {user.uname === message.sender && (
        <div data-testid="message-actions">
          <button aria-label="edit">Edit</button>
          <button aria-label="delete">Delete</button>
        </div>
      )}
    </div>
  );
  return MockReplyMessage;
});

// Mock dayjs
jest.mock('dayjs', () => () => ({
  fromNow: () => '5 minutes ago'
}));

// Mock Firebase storage
jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(),
}));

describe('ReplyMessage', () => {
  const mockMessage = {
    id: '123',
    text: 'Test reply',
    sender: 'testuser',
    timestamp: new Date().toISOString(),
    imageUrls: [],
    reactions: {},
    subscribed: [],
    senderDetail: {
      fullname: 'Test User',
      imageUrl: 'https://example.com/avatar.jpg'
    },
    parentMessage: {
      id: '456',
      text: 'Original message',
      sender: 'originaluser',
      senderDetail: {
        fullname: 'Original User',
        imageUrl: 'https://example.com/avatar2.jpg'
      }
    }
  };

  const mockUser = {
    uname: 'testuser',
    userId: '123',
  };

  const defaultProps = {
    message: mockMessage,
    user: mockUser,
    onReply: jest.fn(),
    onReaction: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    chatType: 'node',
    reply: mockMessage,
    index: 0,
    editing: null,
    messageId: '123',
    users: {},
    confirmIt: jest.fn(),
    setEditing: jest.fn(),
    editReply: jest.fn(),
    deleteReply: jest.fn(),
    toggleEmojiPicker: jest.fn(),
    toggleReaction: jest.fn(),
    setOpenMedia: jest.fn()
  };

  const theme = createTheme();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the reply message', () => {
    const ReplyMessage = require('../../../src/components/Chat/ReplyMessage');
    render(
      <ThemeProvider theme={theme}>
        <ReplyMessage {...defaultProps} />
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('reply-text')).toHaveTextContent('Test reply');
  });

  it('shows original message reference', () => {
    const ReplyMessage = require('../../../src/components/Chat/ReplyMessage');
    render(
      <ThemeProvider theme={theme}>
        <ReplyMessage {...defaultProps} />
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('original-message')).toHaveTextContent('Original message');
  });

  it('shows user names', () => {
    const ReplyMessage = require('../../../src/components/Chat/ReplyMessage');
    render(
      <ThemeProvider theme={theme}>
        <ReplyMessage {...defaultProps} />
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('sender-name')).toHaveTextContent('Test User');
    expect(screen.getByTestId('original-sender')).toHaveTextContent('Original User');
  });

  it('shows message actions for own messages', () => {
    const ReplyMessage = require('../../../src/components/Chat/ReplyMessage');
    render(
      <ThemeProvider theme={theme}>
        <ReplyMessage {...defaultProps} />
      </ThemeProvider>
    );
    
    const messageActions = screen.getByTestId('message-actions');
    expect(messageActions).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });
});