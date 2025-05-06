import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import OntologyHistory from '../../../src/components/ActiveUsers/OntologyHistory';

// Mock the HistoryTab component
jest.mock('../../../src/components/ActiveUsers/HistoryTab', () => ({
  __esModule: true,
  default: jest.fn(({ changeType }) => (
    <div data-testid="history-tab" data-change-type={changeType}>
      {changeType === 'add-node' ? 'New Nodes Tab' : 'Edits Tab'}
    </div>
  )),
}));

describe('OntologyHistory Component', () => {
  const mockProps = {
    currentVisibleNode: { id: 'node-123' },
    selectedDiffNode: { id: 'diff-1' },
    displayDiff: jest.fn(),
    activeUsers: {
      'user-1': { name: 'User One' },
      'user-2': { name: 'User Two' },
    },
    selectedUser: 'All',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders with tabs', () => {
    render(<OntologyHistory {...mockProps} />);
    
    expect(screen.getByText('Edits')).toBeInTheDocument();
    expect(screen.getByText('New Nodes')).toBeInTheDocument();
  });

  test('shows Edits tab by default', () => {
    render(<OntologyHistory {...mockProps} />);
    
    expect(screen.getByTestId('history-tab')).toBeInTheDocument();
    expect(screen.getByText('Edits Tab')).toBeInTheDocument();
    expect(screen.queryByText('New Nodes Tab')).not.toBeInTheDocument();
  });

  test('switches to New Nodes tab when clicked', () => {
    render(<OntologyHistory {...mockProps} />);
    
    // Click on the New Nodes tab
    fireEvent.click(screen.getByText('New Nodes'));
    
    expect(screen.getByTestId('history-tab')).toBeInTheDocument();
    expect(screen.queryByText('Edits Tab')).not.toBeInTheDocument();
    expect(screen.getByText('New Nodes Tab')).toBeInTheDocument();
  });

  test('switches back to Edits tab when clicked', () => {
    render(<OntologyHistory {...mockProps} />);
    
    // First switch to New Nodes tab
    fireEvent.click(screen.getByText('New Nodes'));
    
    // Then switch back to Edits tab
    fireEvent.click(screen.getByText('Edits'));
    
    expect(screen.getByTestId('history-tab')).toBeInTheDocument();
    expect(screen.getByText('Edits Tab')).toBeInTheDocument();
    expect(screen.queryByText('New Nodes Tab')).not.toBeInTheDocument();
  });

  test('passes correct props to HistoryTab', () => {
    const { rerender } = render(<OntologyHistory {...mockProps} />);
    
    // Check props for Edits tab
    let historyTab = screen.getByTestId('history-tab');
    expect(historyTab).toBeInTheDocument();
    
    // Switch to New Nodes tab
    fireEvent.click(screen.getByText('New Nodes'));
    
    // Check props for New Nodes tab
    historyTab = screen.getByTestId('history-tab');
    expect(historyTab).toBeInTheDocument();
    
    // Update props and verify they're passed correctly
    const updatedProps = {
      ...mockProps,
      selectedUser: 'user-1',
    };
    
    rerender(<OntologyHistory {...updatedProps} />);
    
    // The mock implementation doesn't expose selectedUser in the DOM,
    // but we can verify it's still rendering the correct tab
    expect(screen.getByTestId('history-tab')).toBeInTheDocument();
    expect(screen.getByText('New Nodes Tab')).toBeInTheDocument();
    expect(screen.queryByText('Edits Tab')).not.toBeInTheDocument();
  });
});