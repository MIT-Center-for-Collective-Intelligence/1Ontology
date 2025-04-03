import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ReplyMessage from ' @components/components/Chat/ReplyMessage';
import '@testing-library/jest-dom';

jest.mock('react', () => {
  const originalReact = jest.requireActual('react');
  return {
    ...originalReact,
    useRef: jest.fn(() => ({ current: {} })),
  };
});

jest.mock('@mui/material', () => ({
  Box: ({ children, sx, ref }: any) => (
    <div data-testid="mock-box">{children}</div>
  ),
  Typography: ({ children, sx }: any) => <div data-testid="mock-typography">{children}</div>,
  IconButton: ({ children, onClick }: any) => (
    <button data-testid="mock-icon-button" onClick={onClick}>
      {children}
    </button>
  ),
}));

jest.mock('@mui/icons-material/AddReactionOutlined', () => () => 'AddReactionOutlined');

jest.mock('moment', () => () => ({
  format: () => '10:30 AM',
}));

jest.mock(' @components/components/Markdown/MarkdownRender', () => ({
  __esModule: true,
  default: ({ text }: any) => <div data-testid="mock-markdown-render">{text}</div>,
}));
jest.mock(' @components/components/Chat/Emoticons', () => ({
  Emoticons: () => <div data-testid="mock-emoticons">Emoticons</div>,
}));

let capturedDeleteHandler: (() => any) | null;

jest.mock(' @components/components/Chat/MessageButtons', () => ({
  MessageButtons: ({ handleDeleteMessage }: any) => {
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
  default: ({ onSubmit, onClose, isEditing, message }: any) => (
    <div data-testid="mock-chat-input">
      <button 
        data-testid="edit-submit-button" 
        onClick={() => onSubmit({ id: message.id, text: 'edited reply', parentMessage: message.parentMessage })}
      >
        Submit
      </button>
      <button data-testid="edit-cancel-button" onClick={onClose}>
        Cancel
      </button>
    </div>
  ),
}));

jest.mock(' @components/lib/theme/colors', () => ({
  DESIGN_SYSTEM_COLORS: {
    notebookG700: '#123456',
    gray300: '#456789',
  },
}));

describe('ReplyMessage Component', () => {
  const mockReply = {
    id: 'reply-id-123',
    text: 'This is a reply to a message',
    parentMessage: 'parent-message-id',
    senderDetail: {
      fullname: 'Reply User',
      imageUrl: 'https://example.com/avatar.jpg',
    },
    createdAt: {
      toDate: () => new Date(),
    },
    reactions: {},
    imageUrls: ['https://example.com/image1.jpg'],
  };

  const mockProps = {
    reply: mockReply,
    index: 0,
    editing: null,
    messageId: 'parent-message-id',
    user: { uid: 'test-user-id', name: 'Current User' },
    users: [],
    confirmIt: jest.fn(),
    setEditing: jest.fn(),
    editReply: jest.fn(),
    deleteReply: jest.fn(),
    toggleEmojiPicker: jest.fn(),
    toggleReaction: jest.fn(),
    chatType: 'group',
    setOpenMedia: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedDeleteHandler = null;
  });

  test('renders reply with correct sender information', () => {
    render(<ReplyMessage {...mockProps} />);
    
    expect(screen.getByTestId('mock-optimized-avatar')).toBeInTheDocument();
    expect(screen.getByText('Reply User')).toBeInTheDocument();
    expect(screen.getByText('10:30 AM')).toBeInTheDocument();
  });

  test('renders reply text correctly', () => {
    render(<ReplyMessage {...mockProps} />);
    
    expect(screen.getByTestId('mock-markdown-render')).toBeInTheDocument();
    expect(screen.getByText('This is a reply to a message')).toBeInTheDocument();
  });

  test('renders reply images correctly', () => {
    render(<ReplyMessage {...mockProps} />);
    
    const image = screen.getByAltText('reply image');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/image1.jpg');
  });

  test('clicking image opens media viewer', () => {
    render(<ReplyMessage {...mockProps} />);
    
    const image = screen.getByAltText('reply image');
    fireEvent.click(image);
    
    expect(mockProps.setOpenMedia).toHaveBeenCalledWith('https://example.com/image1.jpg');
  });

  test('renders chat input when in editing mode', () => {
    const editingProps = {
      ...mockProps,
      editing: { 
        id: 'reply-id-123', 
        parentMessage: 'parent-message-id' 
      },
    };
    
    render(<ReplyMessage {...editingProps} />);
    
    expect(screen.getByTestId('mock-chat-input')).toBeInTheDocument();
    expect(screen.getByTestId('edit-submit-button')).toBeInTheDocument();
    expect(screen.getByTestId('edit-cancel-button')).toBeInTheDocument();
  });

  test('shows emoji picker when reaction button is clicked', () => {
    render(<ReplyMessage {...mockProps} />);
    
    const emojiButton = screen.getByTestId('mock-icon-button');
    fireEvent.click(emojiButton);
    
    expect(mockProps.toggleEmojiPicker).toHaveBeenCalled();
    expect(mockProps.toggleEmojiPicker.mock.calls[0][2]).toBe(mockReply);
  });

  test('submits edited reply correctly', () => {
    const editingProps = {
      ...mockProps,
      editing: { 
        id: 'reply-id-123', 
        parentMessage: 'parent-message-id' 
      },
    };
    
    render(<ReplyMessage {...editingProps} />);
    
    const submitButton = screen.getByTestId('edit-submit-button');
    fireEvent.click(submitButton);
    
    expect(mockProps.editReply).toHaveBeenCalledWith({ 
      id: 'reply-id-123', 
      text: 'edited reply',
      parentMessage: 'parent-message-id'
    });
  });

  test('cancels editing when cancel button is clicked', () => {
    const editingProps = {
      ...mockProps,
      editing: { 
        id: 'reply-id-123', 
        parentMessage: 'parent-message-id' 
      },
    };
    
    render(<ReplyMessage {...editingProps} />);
    
    const cancelButton = screen.getByTestId('edit-cancel-button');
    fireEvent.click(cancelButton);
    
    expect(mockProps.setEditing).toHaveBeenCalledWith(null);
  });

  test('deletes reply correctly', () => {
    render(<ReplyMessage {...mockProps} />);
    
    expect(capturedDeleteHandler).not.toBeNull();
    
    capturedDeleteHandler!();
    
    expect(mockProps.deleteReply).toHaveBeenCalledWith('parent-message-id', 'reply-id-123');
  });
});