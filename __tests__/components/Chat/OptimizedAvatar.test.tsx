import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import OptimizedAvatar from '../../../src/components/Chat/OptimizedAvatar';
import { ThemeProvider, createTheme } from '@mui/material';

describe('OptimizedAvatar Component', () => {
  const mockProps = {
    imageUrl: 'https://example.com/image.jpg',
    alt: 'Test User',
    size: 40,
    onClick: jest.fn(),
  };

  const theme = createTheme();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders avatar with image when imageUrl is provided', () => {
    render(
      <ThemeProvider theme={theme}>
        <OptimizedAvatar {...mockProps} />
      </ThemeProvider>
    );
    
    const avatar = screen.getByRole('img');
    expect(avatar).toHaveAttribute('src', 'https://example.com/image.jpg');
    expect(avatar).toHaveAttribute('alt', 'Test User');
  });

  it('renders initials avatar when imageUrl is not provided', () => {
    render(
      <ThemeProvider theme={theme}>
        <OptimizedAvatar {...mockProps} imageUrl="" />
      </ThemeProvider>
    );
    
    expect(screen.getByText('TU')).toBeInTheDocument();
  });

  it('renders initials avatar when image fails to load', () => {
    render(
      <ThemeProvider theme={theme}>
        <OptimizedAvatar {...mockProps} />
      </ThemeProvider>
    );
    
    const avatar = screen.getByRole('img');
    fireEvent.error(avatar);
    
    expect(screen.getByText('TU')).toBeInTheDocument();
  });

  it('calls onClick when avatar is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <OptimizedAvatar {...mockProps} />
      </ThemeProvider>
    );
    
    const avatarContainer = screen.getByRole('img').closest('div');
    expect(avatarContainer).not.toBeNull();
    fireEvent.click(avatarContainer!);
    
    expect(mockProps.onClick).toHaveBeenCalled();
  });

  it('applies correct size to avatar', () => {
    render(
      <ThemeProvider theme={theme}>
        <OptimizedAvatar {...mockProps} size={60} />
      </ThemeProvider>
    );
    
    const avatar = screen.getByRole('img');
    const avatarComponent = avatar.closest('.MuiAvatar-root');
    expect(avatarComponent).toHaveStyle({ width: '60px' });
    expect(avatarComponent).toHaveStyle({ height: '60px' });
  });

  it('applies online status indicator when online prop is true', () => {
    render(
      <ThemeProvider theme={theme}>
        <OptimizedAvatar {...mockProps} online={true} />
      </ThemeProvider>
    );
    
    const avatarContainer = screen.getByRole('img').closest('.MuiBox-root');
    expect(avatarContainer).toHaveStyle({ border: '3px solid #14c815' });
  });
});