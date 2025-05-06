import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import withAuthUser from '../../../src/components/hoc/withAuthUser';
import { useAuth } from '../../../src/components/context/AuthContext';
import { useRouter } from 'next/router';
import ROUTES from '../../../src/lib/utils/routes';

// Mock the next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock the AuthContext
jest.mock('../../../src/components/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock FullPageLogoLoading component
// jest.mock('../../../src/components/FullPageLogoLoading', () => {
//   return function MockFullPageLogoLoading() {
//     return <div data-testid="loading-component">Loading...</div>;
//   };
// });

describe('withAuthUser HOC', () => {
  // Mock router functions
  const mockReplace = jest.fn();
  
  // Setup for each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock router implementation
    (useRouter as jest.Mock).mockReturnValue({
      replace: mockReplace,
      asPath: '/current-path',
    });
  });

  // Test component to wrap with HOC
  const TestComponent = () => <div data-testid="test-component">Test Component</div>;

  test('renders child component when user is not authenticated and shouldRedirectToLogin is false', () => {
    // Mock auth state - not authenticated
    (useAuth as jest.Mock).mockReturnValue([
      { isAuthenticated: false, isAuthInitialized: true },
    ]);
    
    // Create HOC with TestComponent
    const WithAuthUserComponent = withAuthUser({
      shouldRedirectToLogin: false,
      shouldRedirectToHomeIfAuthenticated: false,
    })(TestComponent);
    
    // Render the component
    render(<WithAuthUserComponent />);
    
    // Check if TestComponent is rendered
    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    
    // Check that no redirects happened
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test('redirects to login when user is not authenticated and shouldRedirectToLogin is true', async () => {
    // Mock auth state - not authenticated
    (useAuth as jest.Mock).mockReturnValue([
      { isAuthenticated: false, isAuthInitialized: true },
    ]);
    
    // Create HOC with TestComponent
    const WithAuthUserComponent = withAuthUser({
      shouldRedirectToLogin: true,
    })(TestComponent);
    
    // Render the component
    render(<WithAuthUserComponent />);
    
    // Check that redirect to login was called
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: ROUTES.signIn,
        query: { from: '/current-path' },
      });
    });
  });

  test('redirects to home when user is authenticated and shouldRedirectToHomeIfAuthenticated is true', async () => {
    // Mock auth state - authenticated
    (useAuth as jest.Mock).mockReturnValue([
      { isAuthenticated: true, isAuthInitialized: true },
    ]);
    
    // Create HOC with TestComponent
    const WithAuthUserComponent = withAuthUser({
      shouldRedirectToHomeIfAuthenticated: true,
    })(TestComponent);
    
    // Render the component
    render(<WithAuthUserComponent />);
    
    // Check that redirect to home was called
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(ROUTES.home);
    });
  });

  test('does not redirect to home when shouldRedirectToHomeIfAuthenticated is false', () => {
    // Mock auth state - authenticated
    (useAuth as jest.Mock).mockReturnValue([
      { isAuthenticated: true, isAuthInitialized: true },
    ]);
    
    // Create HOC with TestComponent
    const WithAuthUserComponent = withAuthUser({
      shouldRedirectToHomeIfAuthenticated: false,
    })(TestComponent);
    
    // Render the component
    render(<WithAuthUserComponent />);
    
    // Check that no redirects happened
    expect(mockReplace).not.toHaveBeenCalled();
    
    // Check if TestComponent is rendered
    expect(screen.getByTestId('test-component')).toBeInTheDocument();
  });

  test('does not redirect when auth is not initialized', () => {
    // Mock auth state - not initialized
    (useAuth as jest.Mock).mockReturnValue([
      { isAuthenticated: false, isAuthInitialized: false },
    ]);
    
    // Create HOC with TestComponent
    const WithAuthUserComponent = withAuthUser({
      shouldRedirectToLogin: true,
      shouldRedirectToHomeIfAuthenticated: true,
    })(TestComponent);
    
    // Render the component
    render(<WithAuthUserComponent />);
    
    // Check that no redirects happened
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test('sets correct displayName on the wrapped component', () => {
    // Create HOC with TestComponent
    const WithAuthUserComponent = withAuthUser({})(TestComponent);
    
    // Check displayName
    expect(WithAuthUserComponent.displayName).toBe('WithAuthUserHOC');
  });

  // Uncomment this test if FullPageLogoLoading component is used
  // test('renders loading component when redirecting', () => {
  //   // Mock auth state - authenticated
  //   (useAuth as jest.Mock).mockReturnValue([
  //     { isAuthenticated: true, isAuthInitialized: true },
  //   ]);
    
  //   // Create HOC with TestComponent
  //   const WithAuthUserComponent = withAuthUser({
  //     shouldRedirectToHomeIfAuthenticated: true,
  //   })(TestComponent);
    
  //   // Render the component
  //   render(<WithAuthUserComponent />);
    
  //   // Check if loading component is rendered
  //   expect(screen.getByTestId('loading-component')).toBeInTheDocument();
  // });
});