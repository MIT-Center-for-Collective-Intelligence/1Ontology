import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../../../src/components/context/AuthContext';
import { SnackbarProvider } from 'notistack';

// Mock Firebase auth
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn((auth, callback) => {
    // Don't call callback immediately to test initial state
    setTimeout(() => callback(null), 0);
    return jest.fn(); // Return unsubscribe function
  }),
  signOut: jest.fn(() => Promise.resolve()),
}));

// Mock Firebase firestore
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(() => Promise.resolve({
    exists: jest.fn(() => true),
    data: jest.fn(() => ({
      uname: 'testuser',
      fName: 'Test',
      lName: 'User',
      email: 'test@example.com',
      manageLock: true,
      imageUrl: 'https://example.com/avatar.jpg'
    }))
  })),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve({
    docs: []
  })),
}));

// Test component that uses the auth context
const TestComponent = () => {
  const [authState] = useAuth();
  return (
    <div>
      <div data-testid="auth-state">
        {JSON.stringify(authState)}
      </div>
      <div data-testid="is-authenticated">
        {authState.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
      </div>
      <div data-testid="is-initialized">
        {authState.isAuthInitialized ? 'Initialized' : 'Not Initialized'}
      </div>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('provides initial auth state', async () => {
    render(
      <SnackbarProvider>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </SnackbarProvider>
    );

    // Initial state should have isAuthInitialized as false
    expect(screen.getByTestId('is-initialized')).toHaveTextContent('Not Initialized');
    
    // Wait for auth initialization
    await waitFor(() => {
      expect(screen.getByTestId('is-initialized')).toHaveTextContent('Initialized');
    });
  });

  test('updates auth state when user logs in', async () => {
    // Mock user login
    const mockUser = {
      uid: 'test-uid',
      email: 'test@example.com',
      getIdTokenResult: jest.fn().mockResolvedValue({
        claims: {}
      })
    };
    
    const { getAuth, onAuthStateChanged } = require('firebase/auth');
    onAuthStateChanged.mockImplementationOnce((auth: any, callback: (user: any) => void) => {
      // Simulate logged in user
      callback(mockUser);
      return jest.fn();
    });

    render(
      <SnackbarProvider>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </SnackbarProvider>
    );

    // Wait for auth to initialize and user to be authenticated
    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('Authenticated');
    });
  });

  test('handles auth state change', async () => {
    // First mock no user (logged out)
    const { onAuthStateChanged } = require('firebase/auth');
    onAuthStateChanged.mockImplementationOnce((auth: any, callback: (user: any) => void) => {
      // Simulate no user
      callback(null);
      return jest.fn();
    });

    const { rerender } = render(
      <SnackbarProvider>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </SnackbarProvider>
    );

    // Wait for auth to initialize
    await waitFor(() => {
      expect(screen.getByTestId('is-initialized')).toHaveTextContent('Initialized');
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('Not Authenticated');
    });

    // Now mock user login
    onAuthStateChanged.mockImplementationOnce((auth: any, callback: (user: any) => void) => {
      // Simulate logged in user
      callback({
        uid: 'test-uid',
        email: 'test@example.com',
      });
      return jest.fn();
    });

    // Re-render with new auth state
    rerender(
      <SnackbarProvider>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </SnackbarProvider>
    );

    // Wait for auth to update
    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('Authenticated');
    });
  });
});