import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MessageButtons } from '../../../src/components/Chat/MessageButtons';
import { ThemeProvider, createTheme } from '@mui/material';
import { Timestamp } from 'firebase/firestore';

jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: () => ({
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
      toDate: () => new Date(),
      toMillis: () => Date.now(),
      isEqual: () => true,
      toJSON: () => ({})
    })
  }
}));

describe('MessageButtons', () => {
  const defaultProps = {
    message: {
      id: '1',
      sender: 'testUser',
      text: 'Test message',
      timestamp: new Date().toISOString(),
      createdAt: Timestamp.now(),
      parentMessage: '',
      senderDetail: {
        name: 'Test User',
        uname: 'testUser',
        imageUrl: '',
        chooseUname: false
      },
      reactions: {},
      isEdited: false,
      deleted: false
    },
    user: { uname: 'testUser' },
    toggleEmojiPicker: jest.fn(),
    boxRef: { current: null },
    handleEditMessage: jest.fn(),
    handleDeleteMessage: jest.fn(),
    replyMessage: jest.fn(),
  };

  const theme = createTheme();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all buttons for own message', () => {
    render(
      <ThemeProvider theme={theme}>
        <MessageButtons {...defaultProps} />
      </ThemeProvider>
    );
    
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument();
  });

  it('hides edit and delete buttons for other users messages', () => {
    render(
      <ThemeProvider theme={theme}>
        <MessageButtons {...defaultProps} user={{ uname: 'otherUser' }} />
      </ThemeProvider>
    );
    
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument();
  });

  it('calls handleEditMessage when edit button is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <MessageButtons {...defaultProps} />
      </ThemeProvider>
    );
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);
    
    expect(defaultProps.handleEditMessage).toHaveBeenCalled();
  });

  it('calls handleDeleteMessage when delete button is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <MessageButtons {...defaultProps} />
      </ThemeProvider>
    );
    
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);
    
    expect(defaultProps.handleDeleteMessage).toHaveBeenCalled();
  });

  it('calls replyMessage when reply button is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <MessageButtons {...defaultProps} />
      </ThemeProvider>
    );
    
    const replyButton = screen.getByRole('button', { name: /reply/i });
    fireEvent.click(replyButton);
    
    expect(defaultProps.replyMessage).toHaveBeenCalled();
  });

  it('hides reply button when message has parentMessage', () => {
    render(
      <ThemeProvider theme={theme}>
        <MessageButtons {...defaultProps} message={{ ...defaultProps.message, parentMessage: 'parent-id' }} />
      </ThemeProvider>
    );
    
    expect(screen.queryByRole('button', { name: /reply/i })).not.toBeInTheDocument();
  });
});