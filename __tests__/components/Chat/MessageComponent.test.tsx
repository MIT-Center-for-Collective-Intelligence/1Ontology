import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import MessageComponent from '../../../src/components/Chat/MessageComponent';
import { ThemeProvider, createTheme } from '@mui/material';

// Mock dayjs
jest.mock('dayjs', () => () => ({
  fromNow: () => '5 minutes ago'
}));

// Mock Firebase storage
jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(),
}));

// Mock child components
jest.mock('../../../src/components/Chat/ChatInput', () => {
  return function MockChatInput() {
    return <div data-testid="chat-input">Chat Input Component</div>;
  };
});

jest.mock('../../../src/components/Chat/MessageButtons', () => {
  return {
    MessageButtons: function MockMessageButtons() {
      return (
        <div data-testid="message-buttons">
          <button>Edit</button>
          <button>Delete</button>
        </div>
      );
    },
  };
});

jest.mock('../../../src/components/Chat/Emoticons', () => {
  return {
    Emoticons: function MockEmoticons() {
      return <div data-testid="emoticons">Emoticons</div>;
    },
  };
});

jest.mock('../../../src/components/Chat/OptimizedAvatar', () => {
  return function MockOptimizedAvatar() {
    return <div data-testid="optimized-avatar">Avatar</div>;
  };
});

jest.mock('../../../src/components/Markdown/MarkdownRender', () => {
  return function MockMarkdownRender({ text }: { text: string }) {
    return <div data-testid="markdown-render">{text}</div>;
  };
});

describe('MessageComponent', () => {
  const mockMessage = {
    id: '123',
    text: 'Test message',
    sender: 'testuser',
    createdAt: { toDate: () => new Date() },
    imageUrls: [],
    reactions: {},
    subscribed: [],
    senderDetail: {
      fullname: 'Test User',
      imageUrl: 'https://example.com/avatar.jpg'
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
    editing: null,
    setEditing: jest.fn(),
    users: [],
    confirmIt: jest.fn(),
    toggleEmojiPicker: jest.fn(),
    toggleReaction: jest.fn(),
    showReplies: null,
    setShowReplies: jest.fn(),
    renderReplies: jest.fn(),
    addReply: jest.fn(),
    editMessage: jest.fn(),
    deleteMessage: jest.fn(),
    navigateToNode: jest.fn(),
    replies: [],
    nodes: {},
    setOpenMedia: jest.fn()
  };

  const theme = createTheme();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the message text', () => {
    render(
      <ThemeProvider theme={theme}>
        <MessageComponent {...defaultProps} />
      </ThemeProvider>
    );
    
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('shows user name', () => {
    render(
      <ThemeProvider theme={theme}>
        <MessageComponent {...defaultProps} />
      </ThemeProvider>
    );
    
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('shows message actions for own messages', () => {
    render(
      <ThemeProvider theme={theme}>
        <MessageComponent {...defaultProps} />
      </ThemeProvider>
    );
    
    const messageBox = screen.getByTestId('markdown-render').closest('.reply-box');
    if (!messageBox) throw new Error('Message box not found');
    fireEvent.mouseEnter(messageBox);
    
    const messageButtons = screen.getByTestId('message-buttons');
    expect(within(messageButtons).getByText('Edit')).toBeInTheDocument();
    expect(within(messageButtons).getByText('Delete')).toBeInTheDocument();
  });

  it('renders the message with sender name', () => {
    render(<MessageComponent {...defaultProps} />);
    
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-render')).toHaveTextContent('Test message');
  });

  it('shows edit form when editing', () => {
    render(
      <MessageComponent 
        {...defaultProps} 
        editing={{ id: '123' }}
      />
    );
    
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });

  it('calls setShowReplies when reply button is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <MessageComponent {...defaultProps} />
      </ThemeProvider>
    );
    
    const replyButton = screen.getByRole('button', { name: /reply/i });
    fireEvent.click(replyButton);
    
    expect(defaultProps.setShowReplies).toHaveBeenCalledWith('123');
  });

  it('renders replies when showReplies matches message id', () => {
    const renderRepliesMock = jest.fn(() => <div>Replies content</div>);
    
    render(
      <MessageComponent 
        {...defaultProps} 
        showReplies="123"
        renderReplies={renderRepliesMock}
      />
    );
    
    expect(renderRepliesMock).toHaveBeenCalled();
    expect(screen.getByText('Replies content')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });
});