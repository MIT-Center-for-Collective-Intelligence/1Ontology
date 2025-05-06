import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LinkEditor from '../../../src/components/LinkNode/LinkEditor';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Mock Material UI components
jest.mock('@mui/material', () => ({
  Box: ({ children, sx }: any) => <div data-testid="mock-box">{children}</div>,
  TextField: ({ value, onChange, inputRef, onKeyDown }: any) => (
    <input
      data-testid="mock-textfield"
      value={value}
      onChange={onChange}
      ref={inputRef}
      onKeyDown={onKeyDown}
    />
  ),
}));

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApps: () => [{}],
  getApp: () => ({}),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: jest.fn(),
  collection: jest.fn(),
  updateDoc: jest.fn(),
}));

jest.mock(' @components/components/context/AuthContext', () => ({
  useAuth: () => [{ user: { uname: 'test-user' } }],
}));

describe('LinkEditor Component', () => {
  const defaultProps = {
    reviewId: 'test-review',
    title: 'Test Title',
    checkDuplicateTitle: jest.fn(),
    setClonedNodesQueue: jest.fn()
  };

  const theme = createTheme();

  const renderWithTheme = (ui: React.ReactElement) => {
    return render(
      <ThemeProvider theme={theme}>
        {ui}
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders text field with initial title', () => {
    renderWithTheme(<LinkEditor {...defaultProps} />);
    
    const textField = screen.getByTestId('mock-textfield');
    expect(textField).toHaveValue('Test Title');
  });

  test('updates title when text field changes', () => {
    renderWithTheme(<LinkEditor {...defaultProps} />);
    
    const textField = screen.getByTestId('mock-textfield');
    fireEvent.change(textField, { target: { value: 'New Title' } });
    
    expect(defaultProps.setClonedNodesQueue).toHaveBeenCalled();
  });
});