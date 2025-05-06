import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AuthLayout from '../../../src/components/layouts/AuthLayout';
import { ThemeProvider, createTheme } from '@mui/material';

const theme = createTheme();

jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    query: {},
    pathname: '/',
  }),
}));

// Mock the components that AuthLayout might use
jest.mock('next/head', () => {
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-head">{children}</div>,
  };
});

// Mock any context providers that might be used
jest.mock('../../../src/components/context/AuthContext', () => ({
  useAuth: jest.fn(() => [
    { 
      isAuthenticated: false,
      isAuthInitialized: true,
      emailVerified: false,
      settings: { theme: 'Dark' }
    },
    { dispatch: jest.fn() }
  ]),
}));

describe('AuthLayout Component', () => {
  const defaultProps = {
    children: <div data-testid="test-children">Test Children</div>
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders children correctly', () => {
    render(
      <ThemeProvider theme={theme}>
        <AuthLayout {...defaultProps} />
      </ThemeProvider>
    );
    expect(screen.getByTestId('test-children')).toBeInTheDocument();
  });

  test('applies correct auth layout structure', () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <AuthLayout {...defaultProps} />
      </ThemeProvider>
    );
    const authLayout = screen.getByTestId('auth-layout');
    expect(authLayout).toBeInTheDocument();
  });
});