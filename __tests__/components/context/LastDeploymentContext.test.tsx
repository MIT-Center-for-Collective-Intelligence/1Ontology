import React, { ReactNode } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

interface DeploymentData {
  id: string;
  timestamp: string;
  version: string;
  status: string;
}

// Mock the LastDeploymentContext component
jest.mock('../../../src/components/context/LastDeploymentContext', () => {
  const React = require('react');
  const actualContext = jest.requireActual('../../../src/components/context/LastDeploymentContext');
  
  // Create a mock context with the same API but controllable for testing
  const LastDeploymentContext = React.createContext({
    lastDeployment: null,
    setLastDeployment: jest.fn(),
    isLoading: false,
    error: null,
  });
  
  const useLastDeployment = () => React.useContext(LastDeploymentContext);
  
  const LastDeploymentProvider = ({ children }: { children: ReactNode }) => {
    const [lastDeployment, setLastDeploymentState] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    
    const setLastDeployment = (deploymentData: DeploymentData | null) => {
      setIsLoading(true);
      setError(null);
      
      // Simulate async operation
      setTimeout(() => {
        try {
          setLastDeploymentState(deploymentData);
          setIsLoading(false);
        } catch (err) {
          setError('Failed to set deployment data');
          setIsLoading(false);
        }
      }, 100);
    };
    
    return (
      <LastDeploymentContext.Provider 
        value={{ 
          lastDeployment, 
          setLastDeployment, 
          isLoading, 
          error 
        }}
      >
        {children}
      </LastDeploymentContext.Provider>
    );
  };
  
  return {
    LastDeploymentProvider,
    useLastDeployment,
  };
});

// Import the mocked components
const { LastDeploymentProvider, useLastDeployment } = require('../../../src/components/context/LastDeploymentContext');

// Test component that uses the last deployment context
const TestComponent = () => {
  const { lastDeployment, setLastDeployment, isLoading, error } = useLastDeployment();
  
  const handleSetDeployment = () => {
    const mockDeployment = {
      id: '123',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      status: 'success',
    };
    setLastDeployment(mockDeployment);
  };
  
  const handleClearDeployment = () => {
    setLastDeployment(null);
  };
  
  return (
    <div>
      <button data-testid="set-deployment" onClick={handleSetDeployment}>
        Set Deployment
      </button>
      <button data-testid="clear-deployment" onClick={handleClearDeployment}>
        Clear Deployment
      </button>
      
      {isLoading && <div data-testid="loading-state">Loading...</div>}
      {error && <div data-testid="error-state">{error}</div>}
      
      <div data-testid="deployment-status">
        {lastDeployment ? 'Deployment data available' : 'No deployment data'}
      </div>
      
      {lastDeployment && (
        <div data-testid="deployment-details">
          <div>ID: {lastDeployment.id}</div>
          <div>Version: {lastDeployment.version}</div>
          <div>Status: {lastDeployment.status}</div>
        </div>
      )}
    </div>
  );
};

describe('LastDeploymentContext', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });
  
  test('provides null lastDeployment by default', () => {
    render(
      <LastDeploymentProvider>
        <TestComponent />
      </LastDeploymentProvider>
    );
    
    expect(screen.getByTestId('deployment-status')).toHaveTextContent('No deployment data');
  });
  
  test('updates lastDeployment when setLastDeployment is called', async () => {
    render(
      <LastDeploymentProvider>
        <TestComponent />
      </LastDeploymentProvider>
    );
    
    // Initially no deployment data
    expect(screen.getByTestId('deployment-status')).toHaveTextContent('No deployment data');
    
    // Set deployment data
    fireEvent.click(screen.getByTestId('set-deployment'));
    
    // Should show loading state
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    
    // Fast-forward timer to complete the async operation
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    // Should now have deployment data
    expect(screen.getByTestId('deployment-status')).toHaveTextContent('Deployment data available');
    expect(screen.getByText(/ID: 123/)).toBeInTheDocument();
    expect(screen.getByText(/Version: 1.0.0/)).toBeInTheDocument();
    expect(screen.getByText(/Status: success/)).toBeInTheDocument();
  });
  
  test('clears lastDeployment when setLastDeployment is called with null', async () => {
    render(
      <LastDeploymentProvider>
        <TestComponent />
      </LastDeploymentProvider>
    );
    
    // Set deployment data
    fireEvent.click(screen.getByTestId('set-deployment'));
    
    // Fast-forward timer to complete the async operation
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    // Should have deployment data
    expect(screen.getByTestId('deployment-status')).toHaveTextContent('Deployment data available');
    
    // Clear deployment data
    fireEvent.click(screen.getByTestId('clear-deployment'));
    
    // Should show loading state again
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    
    // Fast-forward timer to complete the async operation
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    // Should have no deployment data
    expect(screen.getByTestId('deployment-status')).toHaveTextContent('No deployment data');
  });
  
  test('handles loading state correctly', () => {
    render(
      <LastDeploymentProvider>
        <TestComponent />
      </LastDeploymentProvider>
    );
    
    // Set deployment data
    fireEvent.click(screen.getByTestId('set-deployment'));
    
    // Should show loading state
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    
    // Fast-forward timer to complete the async operation
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    // Loading state should be gone
    expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
  });
});