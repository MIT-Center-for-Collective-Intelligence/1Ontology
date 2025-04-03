import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@mui/material', () => ({
  Paper: ({ children }: any) => <div data-testid="paper">{children}</div>,
  Typography: ({ children }: any) => <div data-testid="typography">{children}</div>
}));

jest.mock('@mui/system', () => ({
  Box: ({ children, className }: any) => <div data-testid="box" className={className || ''}>{children}</div>
}));

jest.mock('../../../src/components/Chat/OptimizedAvatar', () => ({
  __esModule: true,
  default: ({ alt, size, imageUrl }: any) => (
    <img 
      data-testid="optimized-avatar" 
      alt={alt}
      width={size}
      src={imageUrl}
    />
  )
}));

const { MentionUser } = require('../../../src/components/Chat/MentionUser');

describe('MentionUser Component', () => {
  const mockUser = {
    fullName: 'John Doe',
    display: 'johndoe',
    imageUrl: 'https://example.com/avatar.jpg'
  };

  test('renders without crashing', () => {
    const { getByTestId } = render(<MentionUser user={mockUser} />);
    expect(getByTestId('paper')).toBeInTheDocument();
  });

  test('renders user display name', () => {
    const { getByText } = render(<MentionUser user={mockUser} />);
    expect(getByText('johndoe')).toBeInTheDocument();
  });

  test('passes user info to OptimizedAvatar', () => {
    const { getByTestId } = render(<MentionUser user={mockUser} />);
    const avatar = getByTestId('optimized-avatar');
    
    expect(avatar).toHaveAttribute('alt', 'John Doe');
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    expect(avatar).toHaveAttribute('width', '30');
  });

  test('handles user with missing properties', () => {
    const incompleteUser = { fullName: '', display: '' };
    const { getByTestId } = render(<MentionUser user={incompleteUser} />);
    
    expect(getByTestId('paper')).toBeInTheDocument();
  });
});