import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MentionUser } from '../../../src/components/Chat/MentionUser';
import { ThemeProvider, createTheme } from '@mui/material';

// Mock OptimizedAvatar component
jest.mock('../../../src/components/Chat/OptimizedAvatar', () => {
  return function MockOptimizedAvatar({ alt }: { alt: string }) {
    return <div data-testid="optimized-avatar">{alt}</div>;
  };
});

describe('MentionUser Component', () => {
  const mockUser = {
    display: 'Test User',
    fullName: 'Test User',
    imageUrl: 'test-image.jpg',
  };

  const theme = createTheme({
    palette: {
      mode: 'light',
      common: {
        notebookG700: '#333',
        notebookG600: '#555',
        gray100: '#f5f5f5',
        gray200: '#eee',
      },
    },
  });

  it('renders user information correctly', () => {
    render(
      <ThemeProvider theme={theme}>
        <MentionUser user={mockUser} />
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('optimized-avatar')).toHaveTextContent('Test User');
    expect(screen.getByRole('paragraph')).toHaveTextContent('Test User');
  });

  it('renders with dark theme styles', () => {
    const darkTheme = createTheme({
      palette: {
        mode: 'dark',
        common: {
          notebookG700: '#333',
          notebookG600: '#555',
          gray100: '#f5f5f5',
          gray200: '#eee',
        },
      },
    });

    render(
      <ThemeProvider theme={darkTheme}>
        <MentionUser user={mockUser} />
      </ThemeProvider>
    );
    
    // We can't easily test the exact styles, but we can verify the component renders
    expect(screen.getByTestId('optimized-avatar')).toHaveTextContent('Test User');
    expect(screen.getByRole('paragraph')).toHaveTextContent('Test User');
  });
});