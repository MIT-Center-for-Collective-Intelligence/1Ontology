import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserActivity from '../../../src/components/ActiveUsers/UserActivity';
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

// Mock constants
jest.mock('../../../src/lib/CONSTANTS', () => ({
  SCROLL_BAR_STYLE: { scrollbarWidth: 'thin' },
}));

describe('UserActivity Component', () => {
  const mockOpenLogsFor = {
    uname: 'user-1',
    imageUrl: 'https://example.com/avatar.jpg',
    fullname: 'John Doe',
    fName: 'John',
  };
  
  const mockDisplayDiff = jest.fn();
  const mockSelectedDiffNode = { id: 'log-1' };

  const mockLogs = [
    { id: 'log-1', nodeId: 'node-123', modifiedAt: { toDate: () => new Date('2023-01-03') }, modifiedBy: 'user-1' },
    { id: 'log-2', nodeId: 'node-456', modifiedAt: { toDate: () => new Date('2023-01-02') }, modifiedBy: 'user-1' },
    { id: 'log-3', nodeId: 'node-789', modifiedAt: { toDate: () => new Date('2023-01-01') }, modifiedBy: 'user-1' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the onSnapshot function to simulate Firestore data
    (firestore.onSnapshot as jest.Mock).mockImplementation((query, callback) => {
      callback({
        docChanges: () => mockLogs.map(log => ({
          doc: {
            data: () => log,
            id: log.id,
          },
          type: 'added'
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
      <UserActivity
        openLogsFor={mockOpenLogsFor}
        displayDiff={mockDisplayDiff}
        selectedDiffNode={mockSelectedDiffNode}
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders empty state when no logs are available', async () => {
    // Mock empty logs
    (firestore.onSnapshot as jest.Mock).mockImplementation((query, callback) => {
      callback({
        docChanges: () => [],
      });
      return jest.fn();
    });

    render(
      <UserActivity
        openLogsFor={mockOpenLogsFor}
        displayDiff={mockDisplayDiff}
        selectedDiffNode={mockSelectedDiffNode}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('rive-component')).toBeInTheDocument();
    });
  });

  test('renders activity logs when data is loaded', async () => {
    render(
      <UserActivity
        openLogsFor={mockOpenLogsFor}
        displayDiff={mockDisplayDiff}
        selectedDiffNode={mockSelectedDiffNode}
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
      nodeId: `node-${i + 1}`,
      modifiedAt: { toDate: () => new Date(`2023-01-${i + 1}`) },
      modifiedBy: 'user-1',
    }));

    (firestore.onSnapshot as jest.Mock).mockImplementation((query, callback) => {
      callback({
        docChanges: () => manyMockLogs.map(log => ({
          doc: {
            data: () => log,
            id: log.id,
          },
          type: 'added'
        })),
      });
      return jest.fn();
    });

    render(
      <UserActivity
        openLogsFor={mockOpenLogsFor}
        displayDiff={mockDisplayDiff}
        selectedDiffNode={mockSelectedDiffNode}
      />
    );

    // Wait for the component to load data
    await waitFor(() => {
      expect(screen.getByTestId('activity-log-20')).toBeInTheDocument();
    });

    // First page should show items 6-20
    expect(screen.getByTestId('activity-log-20')).toBeInTheDocument();
    expect(screen.getByTestId('activity-log-6')).toBeInTheDocument();
    expect(screen.queryByTestId('activity-log-5')).not.toBeInTheDocument();

    // Navigate to second page
    fireEvent.click(screen.getByRole('button', { name: /2/i }));

    // Second page should show items 1-5
    await waitFor(() => {
      expect(screen.queryByTestId('activity-log-6')).not.toBeInTheDocument();
      expect(screen.getByTestId('activity-log-1')).toBeInTheDocument();
    });
  });

  test('marks selected activity as selected', async () => {
    render(
      <UserActivity
        openLogsFor={mockOpenLogsFor}
        displayDiff={mockDisplayDiff}
        selectedDiffNode={mockSelectedDiffNode}
      />
    );

    await waitFor(() => {
      const selectedActivity = screen.getByTestId('activity-log-1');
      expect(selectedActivity).toHaveClass('selected');
      
      const nonSelectedActivity = screen.getByTestId('activity-log-2');
      expect(nonSelectedActivity).not.toHaveClass('selected');
    });
  });

  test('uses correct query parameters', async () => {
    render(
      <UserActivity
        openLogsFor={mockOpenLogsFor}
        displayDiff={mockDisplayDiff}
        selectedDiffNode={mockSelectedDiffNode}
      />
    );

    expect(firestore.where).toHaveBeenCalledWith('modifiedBy', '==', 'user-1');
    expect(firestore.orderBy).toHaveBeenCalledWith('modifiedAt', 'desc');
    expect(firestore.limit).toHaveBeenCalledWith(100);
  });

  test('resets logs and page when user changes', async () => {
    const { rerender } = render(
      <UserActivity
        openLogsFor={mockOpenLogsFor}
        displayDiff={mockDisplayDiff}
        selectedDiffNode={mockSelectedDiffNode}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('activity-log-1')).toBeInTheDocument();
    });

    // Clear mocks to check if they're called again
    jest.clearAllMocks();

    // Change the user
    const newOpenLogsFor = {
      ...mockOpenLogsFor,
      uname: 'user-2',
    };

    rerender(
      <UserActivity
        openLogsFor={newOpenLogsFor}
        displayDiff={mockDisplayDiff}
        selectedDiffNode={mockSelectedDiffNode}
      />
    );

    // Verify that Firestore query was called with new user
    expect(firestore.where).toHaveBeenCalledWith('modifiedBy', '==', 'user-2');
  });

  test('unsubscribes from Firestore listener on unmount', async () => {
    const unsubscribeMock = jest.fn();
    (firestore.onSnapshot as jest.Mock).mockReturnValue(unsubscribeMock);

    const { unmount } = render(
      <UserActivity
        openLogsFor={mockOpenLogsFor}
        displayDiff={mockDisplayDiff}
        selectedDiffNode={mockSelectedDiffNode}
      />
    );

    unmount();
    expect(unsubscribeMock).toHaveBeenCalled();
  });
});