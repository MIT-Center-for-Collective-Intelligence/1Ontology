import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import HistoryTab from '../../../src/components/ActiveUsers/HistoryTab';
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

describe('HistoryTab Component', () => {
  const mockCurrentVisibleNode = { id: 'node-123' };
  const mockSelectedDiffNode = { id: 'log-1' };
  const mockDisplayDiff = jest.fn();
  const mockActiveUsers = {
    'user-1': { name: 'User One', photoURL: 'url-1' },
    'user-2': { name: 'User Two', photoURL: 'url-2' },
  };
  const mockSelectedUser = 'All';

  const mockLogs = [
    { id: 'log-1', nodeId: 'node-123', modifiedAt: new Date(), modifiedBy: 'user-1', changeType: 'update' },
    { id: 'log-2', nodeId: 'node-123', modifiedAt: new Date(), modifiedBy: 'user-2', changeType: 'update' },
    { id: 'log-3', nodeId: 'node-123', modifiedAt: new Date(), modifiedBy: 'user-1', changeType: 'update' },
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
      <HistoryTab
        currentVisibleNode={mockCurrentVisibleNode}
        selectedDiffNode={mockSelectedDiffNode}
        displayDiff={mockDisplayDiff}
        activeUsers={mockActiveUsers}
        changeType={null}
        selectedUser={mockSelectedUser}
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
      <HistoryTab
        currentVisibleNode={mockCurrentVisibleNode}
        selectedDiffNode={mockSelectedDiffNode}
        displayDiff={mockDisplayDiff}
        activeUsers={mockActiveUsers}
        changeType={null}
        selectedUser={mockSelectedUser}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('rive-component')).toBeInTheDocument();
    });
  });

  test('renders activity logs when data is loaded', async () => {
    render(
      <HistoryTab
        currentVisibleNode={mockCurrentVisibleNode}
        selectedDiffNode={mockSelectedDiffNode}
        displayDiff={mockDisplayDiff}
        activeUsers={mockActiveUsers}
        changeType={null}
        selectedUser={mockSelectedUser}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('activity-log-1')).toBeInTheDocument();
      expect(screen.getByTestId('activity-log-2')).toBeInTheDocument();
      expect(screen.getByTestId('activity-log-3')).toBeInTheDocument();
    });
  });

  test('uses correct query for non-add-node changes', async () => {
    render(
      <HistoryTab
        currentVisibleNode={mockCurrentVisibleNode}
        selectedDiffNode={mockSelectedDiffNode}
        displayDiff={mockDisplayDiff}
        activeUsers={mockActiveUsers}
        changeType={null}
        selectedUser={mockSelectedUser}
      />
    );

    expect(firestore.where).toHaveBeenCalledWith('changeType', '!=', 'add node');
    expect(firestore.orderBy).toHaveBeenCalledWith('modifiedAt', 'desc');
    expect(firestore.limit).toHaveBeenCalledWith(100);
  });

  test('uses correct query for add-node changes', async () => {
    render(
      <HistoryTab
        currentVisibleNode={mockCurrentVisibleNode}
        selectedDiffNode={mockSelectedDiffNode}
        displayDiff={mockDisplayDiff}
        activeUsers={mockActiveUsers}
        changeType="add-node"
        selectedUser={mockSelectedUser}
      />
    );

    expect(firestore.where).toHaveBeenCalledWith('changeType', '==', 'add node');
    expect(firestore.orderBy).toHaveBeenCalledWith('modifiedAt', 'desc');
    expect(firestore.limit).toHaveBeenCalledWith(100);
  });

  test('filters by user when selectedUser is not "All"', async () => {
    render(
      <HistoryTab
        currentVisibleNode={mockCurrentVisibleNode}
        selectedDiffNode={mockSelectedDiffNode}
        displayDiff={mockDisplayDiff}
        activeUsers={mockActiveUsers}
        changeType={null}
        selectedUser="user-1"
      />
    );

    expect(firestore.where).toHaveBeenCalledWith('changeType', '!=', 'add node');
    expect(firestore.where).toHaveBeenCalledWith('modifiedBy', '==', 'user-1');
  });

  test('unsubscribes from Firestore listener on unmount', async () => {
    const unsubscribeMock = jest.fn();
    (firestore.onSnapshot as jest.Mock).mockReturnValue(unsubscribeMock);

    const { unmount } = render(
      <HistoryTab
        currentVisibleNode={mockCurrentVisibleNode}
        selectedDiffNode={mockSelectedDiffNode}
        displayDiff={mockDisplayDiff}
        activeUsers={mockActiveUsers}
        changeType={null}
        selectedUser={mockSelectedUser}
      />
    );

    unmount();
    expect(unsubscribeMock).toHaveBeenCalled();
  });
});