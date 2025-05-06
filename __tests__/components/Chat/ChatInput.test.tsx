import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatInput from '../../../src/components/Chat/ChatInput';
import { ThemeProvider, createTheme } from '@mui/material';
import { DESIGN_SYSTEM_COLORS } from '../../../src/lib/theme/colors';
import { IChatMessage } from '../../../src/types/IChat';
import { useUploadImage } from '../../../src/hooks/useUploadImage';
import { isValidHttpUrl } from '../../../src/lib/utils/utils';

// Mock Firebase storage
jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(),
}));

// Mock the upload image hook
jest.mock('../../../src/hooks/useUploadImage', () => ({
  useUploadImage: jest.fn(() => ({
    isUploading: false,
    percentageUploaded: 0,
    uploadImage: jest.fn().mockResolvedValue('https://example.com/image.jpg'),
  })),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('ChatInput Component', () => {
  const mockUser = {
    uname: 'testuser',
    userId: '123',
  };

  const mockOnSubmit = jest.fn();
  const mockOnClose = jest.fn();
  const mockConfirmIt = jest.fn();
  const mockSetEditing = jest.fn();

  const defaultProps = {
    user: mockUser,
    type: 'message',
    onSubmit: mockOnSubmit,
    onClose: mockOnClose,
    isEditing: false,
    users: [],
    confirmIt: mockConfirmIt,
    editing: null,
    setEditing: mockSetEditing,
    chatType: 'node',
    placeholder: 'Type a message...',
  };

  const theme = createTheme();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the input field with placeholder', () => {
    render(
      <ThemeProvider theme={theme}>
        <ChatInput {...defaultProps} />
      </ThemeProvider>
    );
    
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
  });

  it('updates input value when typing', () => {
    render(
      <ThemeProvider theme={theme}>
        <ChatInput {...defaultProps} />
      </ThemeProvider>
    );
    
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Hello world' } });
    
    expect(input).toHaveValue('Hello world');
  });

  it('calls onSubmit when send button is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <ChatInput {...defaultProps} />
      </ThemeProvider>
    );
    
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Hello world' } });
    
    const sendButton = screen.getByRole('button', { name: /ctrl \+ enter/i });
    fireEvent.click(sendButton);
    
    expect(mockOnSubmit).toHaveBeenCalledWith('Hello world', [], expect.any(Set));
  });

  it('loads existing text when editing', () => {
    const editingMessage = {
      id: '123',
      text: 'Edit this message',
      imageUrls: [],
    };

    render(
      <ThemeProvider theme={theme}>
        <ChatInput 
          {...defaultProps} 
          isEditing={true} 
          editing={editingMessage} 
        />
      </ThemeProvider>
    );
    
    const input = screen.getByPlaceholderText('Type a message...');
    expect(input).toHaveValue('Edit this message');
  });
});