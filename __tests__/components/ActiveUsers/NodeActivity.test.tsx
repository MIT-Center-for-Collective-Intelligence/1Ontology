import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NodeActivity from '../../../src/components/ActiveUsers/NodeActivity';
import * as firestore from 'firebase/firestore';

// Mock the firebase/firestore module
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
}));

// Mock the RiveComponentMemoized component
jest.mock('../../../src/components/Common/RiveComponentExtended', () => ({
  RiveComponentMemoized: jest.fn(() => <div data-testid="rive-component">Rive Animation</div>),
}));

// Mock the ActivityDetails component
jest.mock('../../../src/components/ActiveUsers/ActivityDetails', () => ({
  __esModule: true,
  default: jest.fn(({ activity, isSelected }) => (
    <div data-testid={`activity-${activity.id}`} className={isSelected ? 'selected' : ''}>
      Activity: {activity.id}
    </div>
  )),
}));

describe('NodeActivity Component', () => {
  const mockCurrentVisibleNode = { id: 'node-123' };
  const mockSelectedDiffNode = { id: 'log-1' };
  const mockDisplayDiff = jest.fn();
  const mockActiveUsers = {
    'user-1': { name: 'User One', photoURL: 'url-1' },
    'user-2': { name: 'User Two', photoURL: 'url-2' },
  };

  const mockLogs = [
    { id: 'log-1', nodeId: 'node-123', modifiedAt: new Date(), modifiedBy: 'user-1' },
    { id: 'log-2', nodeId: 'node-123', modifiedAt: new Date(), modifiedBy: 'user-2' },
    { id: 'log-3', nodeId: 'node-123', modifiedAt: new Date(), modifiedBy: 'user-1' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the onSnapshot function to simulate Firestore data
    (firestore.onSnapshot as jest.Mock).mockImplementation((query, callback) => {
      callback({
        docs: mockLogs.map(log => ({
          data: () => log,
          id: log.id,
        })),
      });
      
      // Return unsubscribe function
      return jest.fn();
    });
  });

  test('renders loading state initially', () => {
    // Mock onSnapshot to not call the callback immediately
    (firestore.onSnapshot as jest.Mock).mockImplementation(() => jest.fn());

    render(
      <NodeActivity
        currentVisibleNode={mockCurrentVisibleNode}
        selectedDiffNode={mockSelectedDiffNode}
        displayDiff={mockDisplayDiff}
        activeUsers={mockActiveUsers}
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders empty state when no logs are available', async () => {
    // Mock empty logs
    (firestore.onSnapshot as jest.Mock).mockImplementation((query, callback) => {
      callback({
        docs: [],
      });
      return jest.fn();
    });

    render(
      <NodeActivity
        currentVisibleNode={mockCurrentVisibleNode}
        selectedDiffNode={mockSelectedDiffNode}
        displayDiff={mockDisplayDiff}
        activeUsers={mockActiveUsers}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('rive-component')).toBeInTheDocument();
    });
  });

  test('renders activity logs when data is loaded', async () => {
    render(
      <NodeActivity
        currentVisibleNode={mockCurrentVisibleNode}
        selectedDiffNode={mockSelectedDiffNode}
        displayDiff={mockDisplayDiff}
        activeUsers={mockActiveUsers}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('activity-log-1')).toBeInTheDocument();
      expect(screen.getByTestId('activity-log-2')).toBeInTheDocument();
      expect(screen.getByTestId('activity-log-3')).toBeInTheDocument();
    });
  });

  test('handles pagination correctly', async () => {
    // Create more mock logs to test pagination
    const manyMockLogs = Array.from({ length: 20 }, (_, i) => ({
      id: `log-${i + 1}`,
      nodeId: 'node-123',
      modifiedAt: new Date(),
      modifiedBy: i % 2 === 0 ? 'user-1' : 'user-2',
    }));

    (firestore.onSnapshot as jest.Mock).mockImplementation((query, callback) => {
      callback({
        docs: manyMockLogs.map(log => ({
          data: () => log,
          id: log.id,
        })),
      });
      return jest.fn();
    });

    render(
      <NodeActivity
        currentVisibleNode={mockCurrentVisibleNode}
        selectedDiffNode={mockSelectedDiffNode}
        displayDiff={mockDisplayDiff}
        activeUsers={mockActiveUsers}
      />
    );

    // Wait for the component to load data
    await waitFor(() => {
      expect(screen.getByTestId('activity-log-1')).toBeInTheDocument();
    });

    // First page should show first 15 items
    expect(screen.getByTestId('activity-log-15')).toBeInTheDocument();
    expect(screen.queryByTestId('activity-log-16')).not.toBeInTheDocument();

    // Navigate to second page
    fireEvent.click(screen.getByRole('button', { name: /2/i }));

    // Second page should show remaining items
    await waitFor(() => {
      expect(screen.queryByTestId('activity-log-15')).not.toBeInTheDocument();
      expect(screen.getByTestId('activity-log-16')).toBeInTheDocument();
    });
  });

  test('marks selected activity as selected', async () => {
    render(
      <NodeActivity
        currentVisibleNode={mockCurrentVisibleNode}
        selectedDiffNode={mockSelectedDiffNode}
        displayDiff={mockDisplayDiff}
        activeUsers={mockActiveUsers}
      />
    );

    await waitFor(() => {
      const selectedActivity = screen.getByTestId('activity-log-1');
      expect(selectedActivity).toHaveClass('selected');
      
      const nonSelectedActivity = screen.getByTestId('activity-log-2');
      expect(nonSelectedActivity).not.toHaveClass('selected');
    });
  });

  test('resets logs and page when node changes', async () => {
    const { rerender } = render(
      <NodeActivity
        currentVisibleNode={mockCurrentVisibleNode}
        selectedDiffNode={mockSelectedDiffNode}
        displayDiff={mockDisplayDiff}
        activeUsers={mockActiveUsers}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('activity-log-1')).toBeInTheDocument();
    });

    // Clear mocks to check if they're called again
    jest.clearAllMocks();

    // Change the node
    rerender(
      <NodeActivity
        currentVisibleNode={{ id: 'node-456' }}
        selectedDiffNode={mockSelectedDiffNode}
        displayDiff={mockDisplayDiff}
        activeUsers={mockActiveUsers}
      />
    );

    // Verify that Firestore query was called with new node ID
    expect(firestore.where).toHaveBeenCalledWith('nodeId', '==', 'node-456');
  });

  test('does not fetch data when no node is selected', () => {
    render(
      <NodeActivity
        currentVisibleNode={null}
        selectedDiffNode={mockSelectedDiffNode}
        displayDiff={mockDisplayDiff}
        activeUsers={mockActiveUsers}
      />
    );

    expect(firestore.onSnapshot).not.toHaveBeenCalled();
  });

  test('unsubscribes from Firestore listener on unmount', async () => {
    const unsubscribeMock = jest.fn();
    (firestore.onSnapshot as jest.Mock).mockReturnValue(unsubscribeMock);

    const { unmount } = render(
      <NodeActivity
        currentVisibleNode={mockCurrentVisibleNode}
        selectedDiffNode={mockSelectedDiffNode}
        displayDiff={mockDisplayDiff}
        activeUsers={mockActiveUsers}
      />
    );

    unmount();
    expect(unsubscribeMock).toHaveBeenCalled();
  });
});