import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MessageComponent from ' @components/components/Chat/MessageComponent';
import '@testing-library/jest-dom';
import { INode } from ' @components/types/INode';

// Mock useRef to avoid ref warnings
jest.mock('react', () => {
  const originalReact = jest.requireActual('react');
  return {
    ...originalReact,
    useRef: jest.fn(() => ({ current: {} })),
  };
});

// Mock Material UI components
jest.mock('@mui/material', () => ({
  Box: ({ children, sx, id, onClick }: any) => (
    <div data-testid={id || 'mock-box'} onClick={onClick}>
      {children}
    </div>
  ),
  Typography: ({ children, sx }: any) => <div data-testid="mock-typography">{children}</div>,
  Button: ({ children, onClick, variant }: any) => (
    <button data-testid={`mock-button-${variant || 'default'}`} onClick={onClick}>
      {children}
    </button>
  ),
  IconButton: ({ children, onClick }: any) => (
    <button data-testid="mock-icon-button" onClick={onClick}>
      {children}
    </button>
  ),
}));

// Mock MUI icons
jest.mock('@mui/icons-material/KeyboardArrowDown', () => () => 'KeyboardArrowDownIcon');
jest.mock('@mui/icons-material/KeyboardArrowUp', () => () => 'KeyboardArrowUpIcon');
jest.mock('@mui/icons-material/Link', () => () => 'LinkIcon');
jest.mock('@mui/icons-material/AddReactionOutlined', () => () => 'AddReactionOutlined');

// Mock react-transition-group
jest.mock('react-transition-group', () => ({
  CSSTransition: ({ children }: any) => <div data-testid="mock-css-transition">{children}</div>,
}));

// Mock moment and dayjs
jest.mock('moment', () => () => ({
  fromNow: () => 'a few minutes ago',
}));
jest.mock('dayjs', () => () => ({
  fromNow: () => 'a few minutes ago',
}));

// Mock child components
jest.mock(' @components/components/Markdown/MarkdownRender', () => ({
  __esModule: true,
  default: ({ text }: any) => <div data-testid="mock-markdown-render">{text}</div>,
}));
jest.mock(' @components/components/Chat/Emoticons', () => ({
  Emoticons: () => <div data-testid="mock-emoticons">Emoticons</div>,
}));

// Create a variable to store the delete handler for testing
let capturedDeleteHandler: (() => any) | null;

jest.mock(' @components/components/Chat/MessageButtons', () => ({
  MessageButtons: ({ handleDeleteMessage }: any) => {
    // Capture the delete handler for testing
    capturedDeleteHandler = handleDeleteMessage;
    return (
      <button data-testid="delete-button" onClick={handleDeleteMessage}>
        Delete
      </button>
    );
  },
}));

jest.mock(' @components/components/Chat/OptimizedAvatar', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-optimized-avatar">Avatar</div>,
}));
jest.mock(' @components/components/Chat/ChatInput', () => ({
  __esModule: true,
  default: ({ onSubmit, onClose, isEditing }: any) => (
    <div data-testid="mock-chat-input">
      {isEditing ? (
        <>
          <button data-testid="edit-submit-button" onClick={() => onSubmit({ id: 'test', text: 'edited text' })}>
            Submit
          </button>
          <button data-testid="edit-cancel-button" onClick={onClose}>
            Cancel
          </button>
        </>
      ) : (
        <button data-testid="reply-submit-button" onClick={() => onSubmit({ text: 'reply text' })}>
          Submit Reply
        </button>
      )}
    </div>
  ),
}));

// Mock utility functions
jest.mock(' @components/lib/theme/colors', () => ({
  DESIGN_SYSTEM_COLORS: {
    notebookG700: '#123456',
    notebookG600: '#234567',
    notebookO800: '#345678',
    gray300: '#456789',
    gray100: '#567890',
    orange50: '#678901',
    primary600: '#789012',
    gray25: '#890123',
  },
}));

jest.mock(' @components/lib/utils/string.utils', () => ({
  getTitle: jest.fn().mockReturnValue('Test Node Title'),
}));

describe('MessageComponent', () => {
  const mockMessage = {
    id: 'test-message-id',
    text: 'This is a test message',
    senderDetail: {
      fullname: 'Test User',
      imageUrl: 'https://example.com/avatar.jpg',
    },
    createdAt: {
      toDate: () => new Date(),
    },
    reactions: {},
    totalReplies: 3,
    messageType: 'text',
  };

  const mockNodeMessage = {
    ...mockMessage,
    messageType: 'node',
    sharedNodeId: 'test-node-id',
  };

  const mockProps = {
    message: mockMessage,
    user: { uid: 'test-user-id', name: 'Current User' },
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
    chatType: 'group',
    nodes: {
      'test-node-id': { id: 'test-node-id', title: 'Test Node' } as INode,
    },
    setOpenMedia: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedDeleteHandler = null;
    Object.defineProperty(window, 'getComputedStyle', {
      value: () => ({
        getPropertyValue: jest.fn(),
      }),
    });
    // Mock document.getElementById
    document.getElementById = jest.fn().mockImplementation(() => ({
      style: {
        borderRadius: '',
        padding: '',
        marginTop: '',
        backgroundColor: '',
        transition: '',
        transform: '',
        opacity: '',
      },
    }));
    
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders message with correct sender information', () => {
    render(<MessageComponent {...mockProps} />);
    
    expect(screen.getByTestId('mock-optimized-avatar')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('a few minutes ago')).toBeInTheDocument();
  });

  test('renders message text correctly', () => {
    render(<MessageComponent {...mockProps} />);
    
    expect(screen.getByTestId('mock-markdown-render')).toBeInTheDocument();
    expect(screen.getByText('This is a test message')).toBeInTheDocument();
  });

  test('renders node link when message type is node', () => {
    render(<MessageComponent {...mockProps} message={mockNodeMessage} />);
    
    expect(screen.getByText('Test Node Title')).toBeInTheDocument();
  });

  test('clicking node link navigates to node', () => {
    render(<MessageComponent {...mockProps} message={mockNodeMessage} />);
    
    fireEvent.click(screen.getByText('Test Node Title'));
    expect(mockProps.navigateToNode).toHaveBeenCalledWith('test-node-id');
  });

  test('toggles replies when reply button is clicked', () => {
    render(<MessageComponent {...mockProps} />);
    
    const replyButton = screen.getByText(/3 Replies/);
    fireEvent.click(replyButton);
    
    expect(mockProps.setShowReplies).toHaveBeenCalledWith('test-message-id');
  });

  test('renders chat input when in editing mode', () => {
    render(
      <MessageComponent
        {...mockProps}
        editing={{ id: 'test-message-id' }}
      />
    );
    
    expect(screen.getByTestId('mock-chat-input')).toBeInTheDocument();
    expect(screen.getByTestId('edit-submit-button')).toBeInTheDocument();
    expect(screen.getByTestId('edit-cancel-button')).toBeInTheDocument();
  });

  test('shows emoji picker when reaction button is clicked', () => {
    render(<MessageComponent {...mockProps} />);
    
    const emojiButton = screen.getByTestId('mock-icon-button');
    fireEvent.click(emojiButton);
    
    expect(mockProps.toggleEmojiPicker).toHaveBeenCalled();
    // Check that the message and ref were passed to toggleEmojiPicker
    expect(mockProps.toggleEmojiPicker.mock.calls[0][2]).toBe(mockMessage);
  });

  test('shows reply section when showReplies matches message id', () => {
    render(
      <MessageComponent
        {...mockProps}
        showReplies="test-message-id"
      />
    );
    
    expect(screen.getByTestId('reply-submit-button')).toBeInTheDocument();
    expect(mockProps.renderReplies).toHaveBeenCalledWith('test-message-id', [], expect.any(Object));
  });

  test('submits edited message correctly', () => {
    render(
      <MessageComponent
        {...mockProps}
        editing={{ id: 'test-message-id' }}
      />
    );
    
    const submitButton = screen.getByTestId('edit-submit-button');
    fireEvent.click(submitButton);
    
    expect(mockProps.editMessage).toHaveBeenCalledWith({ id: 'test', text: 'edited text' });
  });

  test('submits reply correctly', () => {
    render(
      <MessageComponent
        {...mockProps}
        showReplies="test-message-id"
      />
    );
    
    const replyButton = screen.getByTestId('reply-submit-button');
    fireEvent.click(replyButton);
    
    expect(mockProps.addReply).toHaveBeenCalledWith({ text: 'reply text' });
  });

  test('deletes message after confirmation', async () => {
    // Mock the confirmIt function to return true (user confirmed deletion)
    mockProps.confirmIt.mockResolvedValue(true);
    
    // Render the component, which should set capturedDeleteHandler
    render(<MessageComponent {...mockProps} />);
    
    // Make sure we captured the delete handler
    expect(capturedDeleteHandler).not.toBeNull();
    
    // Call the captured delete handler
    await capturedDeleteHandler!();
    
    // Verify confirmIt was called with the right parameters
    expect(mockProps.confirmIt).toHaveBeenCalledWith(
      'Are you sure you want to delete this message?',
      'Delete',
      'Keep'
    );
    
    // Advance timers to trigger the setTimeout callback
    jest.advanceTimersByTime(500);
    
    // Verify deleteMessage was called with the correct message ID
    expect(mockProps.deleteMessage).toHaveBeenCalledWith('test-message-id');
  });
});