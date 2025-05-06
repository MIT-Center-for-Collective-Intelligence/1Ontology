import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ManageNodeButtons from '../../../src/components/OntologyComponents/ManageNodeButtons';

// Mock the tooltip helper function
jest.mock(' @components/lib/utils/string.utils', () => ({
  getTooltipHelper: jest.fn((key) => `Tooltip for ${key}`),
}));

describe('ManageNodeButtons Component', () => {
  const defaultProps = {
    locked: false,
    lockedInductor: false,
    root: 'root-node-id',
    manageLock: true,
    deleteNode: jest.fn(),
    getTitleNode: jest.fn((id) => `Node ${id}`),
    handleLockNode: jest.fn(),
    navigateToNode: jest.fn(),
    displaySidebar: jest.fn(),
    activeSidebar: '',
    unclassified: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders all buttons when not locked', () => {
    render(<ManageNodeButtons {...defaultProps} />);
    
    // Check for all buttons
    expect(screen.getByLabelText('Manage Inheritance')).toBeInTheDocument();
    expect(screen.getByLabelText('Open Node Comments')).toBeInTheDocument();
    expect(screen.getByLabelText("View Node's History")).toBeInTheDocument();
    expect(screen.getByLabelText('Delete Node')).toBeInTheDocument();
  });

  test('does not render delete button when locked', () => {
    render(<ManageNodeButtons {...defaultProps} locked={true} />);
    
    expect(screen.queryByLabelText('Delete Node')).not.toBeInTheDocument();
  });

  test('does not render delete button when unclassified', () => {
    render(<ManageNodeButtons {...defaultProps} unclassified={true} />);
    
    expect(screen.queryByLabelText('Delete Node')).not.toBeInTheDocument();
  });

  test('displays lock icon when locked', () => {
    render(<ManageNodeButtons {...defaultProps} locked={true} manageLock={false} />);
    
    const lockIcon = screen.getByTestId('LockIcon');
    expect(lockIcon).toBeInTheDocument();
  });

  test('calls displaySidebar with "chat" when chat button is clicked', () => {
    render(<ManageNodeButtons {...defaultProps} />);
    
    fireEvent.click(screen.getByLabelText('Open Node Comments'));
    expect(defaultProps.displaySidebar).toHaveBeenCalledWith('chat');
  });

  test('calls displaySidebar with "nodeHistory" when history button is clicked', () => {
    render(<ManageNodeButtons {...defaultProps} />);
    
    fireEvent.click(screen.getByLabelText("View Node's History"));
    expect(defaultProps.displaySidebar).toHaveBeenCalledWith('nodeHistory');
  });

  test('calls displaySidebar with "inheritanceSettings" when inheritance button is clicked', () => {
    render(<ManageNodeButtons {...defaultProps} />);
    
    fireEvent.click(screen.getByLabelText('Manage Inheritance'));
    expect(defaultProps.displaySidebar).toHaveBeenCalledWith('inheritanceSettings');
  });

  test('calls deleteNode when delete button is clicked', () => {
    render(<ManageNodeButtons {...defaultProps} />);
    
    fireEvent.click(screen.getByLabelText('Delete Node'));
    expect(defaultProps.deleteNode).toHaveBeenCalled();
  });

  test('calls handleLockNode when lock button is clicked', () => {
    render(<ManageNodeButtons {...defaultProps} />);
    
    fireEvent.click(screen.getByLabelText('Lock this node'));
    expect(defaultProps.handleLockNode).toHaveBeenCalled();
  });

  test('highlights active sidebar button', () => {
    render(<ManageNodeButtons {...defaultProps} activeSidebar="chat" />);
    
    // The chat button should have primary color when active
    const chatButton = screen.getByLabelText('Open Node Comments');
    expect(chatButton.querySelector('svg')).toHaveClass('MuiSvgIcon-colorPrimary');
  });
});