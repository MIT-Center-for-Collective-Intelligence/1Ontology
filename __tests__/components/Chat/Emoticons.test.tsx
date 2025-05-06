import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Emoticons } from '../../../src/components/Chat/Emoticons';
import { ThemeProvider, createTheme } from '@mui/material';
import { Timestamp } from 'firebase/firestore';

describe('Emoticons Component', () => {
  const mockMessage = {
    id: 'msg123',
    sender: 'testuser',
    parentMessage: '',
    text: 'Test message',
    senderDetail: {
      uname: 'testuser',
      imageUrl: '',
      chooseUname: false
    },
    reactions: {},
    createdAt: Timestamp.fromDate(new Date()),
    deleted: false
  };

  const mockUser = {
    uname: 'testuser',
  };

  const mockReactionsMap = {
    '👍': [
      { user: 'testuser', emoji: '👍', fName: 'Test', lName: 'User' },
      { user: 'otheruser', emoji: '👍', fName: 'Other', lName: 'User' },
    ],
    '❤️': [
      { user: 'thirduser', emoji: '❤️', fName: 'Third', lName: 'User' },
    ],
  };

  const mockBoxRef = { current: null };

  const mockProps = {
    message: mockMessage,
    reactionsMap: mockReactionsMap,
    toggleEmojiPicker: jest.fn(),
    toggleReaction: jest.fn(),
    user: mockUser,
    boxRef: mockBoxRef,
  };

  const theme = createTheme();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders reaction buttons for each emoji', () => {
    render(
      <ThemeProvider theme={theme}>
        <Emoticons {...mockProps} />
      </ThemeProvider>
    );
    
    expect(screen.getByText('👍')).toBeInTheDocument();
    expect(screen.getByText('❤️')).toBeInTheDocument();
  });

  it('calls toggleReaction when a reaction button is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <Emoticons {...mockProps} />
      </ThemeProvider>
    );
    
    const thumbsUpButton = screen.getByText('👍').closest('button');
    expect(thumbsUpButton).not.toBeNull();
    fireEvent.click(thumbsUpButton!);
    
    expect(mockProps.toggleReaction).toHaveBeenCalledWith(mockMessage, '👍');
  });

  it('highlights reactions from the current user', () => {
    render(
      <ThemeProvider theme={theme}>
        <Emoticons {...mockProps} />
      </ThemeProvider>
    );
    
    // The user has reacted with 👍 but not with ❤️
    const thumbsUpButton = screen.getByText('👍').closest('button');
    const heartButton = screen.getByText('❤️').closest('button');
    
    // Check for the orange border or bold styling that indicates user's reaction
    expect(thumbsUpButton).toHaveStyle('border: 1px solid orange');
    expect(heartButton).not.toHaveStyle('border: 1px solid orange');
  });

  it('returns nothing if reactionsMap is an array', () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <Emoticons 
          {...mockProps} 
          reactionsMap={[] as any}
        />
      </ThemeProvider>
    );
    
    expect(container).toBeEmptyDOMElement();
  });
});