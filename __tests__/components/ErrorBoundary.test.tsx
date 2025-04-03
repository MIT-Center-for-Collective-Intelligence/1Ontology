// Import statements
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from ' @components/components/ErrorBoundary';
import '@testing-library/jest-dom';

// Mock Material UI components
jest.mock('@mui/material', () => ({
  Button: ({ children, onClick }: any) => (
    <button data-testid="mock-button" onClick={onClick}>
      {children}
    </button>
  ),
  Stack: ({ children }: any) => <div data-testid="mock-stack">{children}</div>,
  Typography: ({ children, variant }: any) => (
    <div data-testid={`mock-typography-${variant || 'default'}`}>{children}</div>
  ),
}));

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn().mockReturnValue({}),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

// Mock addClientErrorLog function
jest.mock(' @components/lib/firestoreClient/errors.firestore', () => ({
  addClientErrorLog: jest.fn(),
}));

// Mock DESIGN_SYSTEM_COLORS
jest.mock(' @components/lib/theme/colors', () => ({
  DESIGN_SYSTEM_COLORS: {
    primary800: '#123456',
    primary900: '#654321',
  },
}));

jest.mock(' @components/lib/utils/customError', () => ({
  CustomError: class CustomError extends Error {
    options: Record<string, unknown>;
    constructor(message: string, options = {}) {
      super(message);
      this.options = options;
    }
  },
}));

// Create a component that throws an error
const ErrorThrowingComponent = () => {
  throw new Error('Test error');
  return <div>This will not render</div>;
};

// Create a component that doesn't throw an error
const NormalComponent = () => {
  return <div data-testid="normal-component">Normal component</div>;
};

// Suppress console.error during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <NormalComponent />
      </ErrorBoundary>
    );
    
    expect(screen.getByTestId('normal-component')).toBeInTheDocument();
  });

  test('renders fallback UI when error is thrown', () => {
    render(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );

    // Check that the fallback UI components are rendered
    expect(screen.getByTestId('mock-stack')).toBeInTheDocument();
    expect(screen.getByTestId('mock-typography-h2')).toBeInTheDocument();
    expect(screen.getByText('Oops, there is an error!')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Our team is actively working to fix the issue. Please try again later. Thank you for your patience.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Try again?')).toBeInTheDocument();
  });

  test('reload button works correctly', () => {
    // Mock window.location.reload
    const mockReload = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true,
    });
    
    render(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );
    
    fireEvent.click(screen.getByTestId('mock-button'));
    expect(mockReload).toHaveBeenCalledTimes(1);
  });
});