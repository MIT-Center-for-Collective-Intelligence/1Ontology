import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExpandSearchResult from '../../../src/components/OntologyComponents/ExpandSearchResult';

// Mock MUI components
jest.mock('@mui/lab', () => ({
  TreeView: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="tree-view" {...props}>
      {children}
    </div>
  ),
  TreeItem: ({ label, children, ...props }: { label: React.ReactNode; children: React.ReactNode }) => (
    <div data-testid="tree-item" {...props}>
      {label}
      {children}
    </div>
  ),
  treeItemClasses: {
    group: 'MuiTreeItem-group',
  },
}));

jest.mock('@mui/icons-material/ExpandMore', () => () => 'ExpandMoreIcon');
jest.mock('@mui/icons-material/ChevronRight', () => () => 'ChevronRightIcon');

describe('ExpandSearchResult Component', () => {
  const mockNodes = {
    'node-1': { id: 'node-1', title: 'Node 1' },
    'node-2': { id: 'node-2', title: 'Node 2' },
    'sub-1': { id: 'sub-1', title: 'Sub Node 1' },
  };

  const mockSearchResults = [
    {
      id: 'node-1',
      title: 'Node 1',
      specializations: [
        {
          nodes: [{ id: 'sub-1' }],
        },
      ],
    },
    {
      id: 'node-2',
      title: 'Node 2',
      specializations: [],
    },
  ];

  const defaultProps = {
    searchResultsForSelection: mockSearchResults,
    markItemAsChecked: jest.fn(),
    handleCloning: jest.fn(),
    checkedItems: new Set(),
    user: { manageLock: true },
    nodes: mockNodes,
    cloning: null,
    isSaving: false,
    disabledAddButton: false,
    getNumOfGeneralizations: jest.fn(),
    selectedProperty: 'specializations',
    addACloneNodeQueue: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders search results as tree items', () => {
    render(<ExpandSearchResult {...defaultProps} />);
    
    const treeItems = screen.getAllByTestId('tree-item');
    expect(treeItems.length).toBe(3); // 2 main nodes + 1 sub-node
  });

  test('renders node labels with correct titles', () => {
    render(<ExpandSearchResult {...defaultProps} />);
    
    expect(screen.getByText('Node 1')).toBeInTheDocument();
    expect(screen.getByText('Node 2')).toBeInTheDocument();
    expect(screen.getByText('Sub Node 1')).toBeInTheDocument();
  });

  test('calls markItemAsChecked when link button is clicked', () => {
    render(<ExpandSearchResult {...defaultProps} />);
    
    // Find all link buttons and click the first one
    const linkButtons = screen.getAllByTestId('InsertLinkIcon');
    fireEvent.click(linkButtons[0]);
    
    expect(defaultProps.markItemAsChecked).toHaveBeenCalledWith('node-1');
  });

  test('shows "Unlink" tooltip when item is checked', () => {
    const checkedItems = new Set(['node-1']);
    render(<ExpandSearchResult {...defaultProps} checkedItems={checkedItems} />);
    
    expect(screen.getByTestId('LinkOffIcon')).toBeInTheDocument();
  });

  test('shows "Link" tooltip when item is not checked', () => {
    render(<ExpandSearchResult {...defaultProps} />);
    
    // All items should have "Link" tooltip since none are checked
    const linkButtons = screen.getAllByTestId('InsertLinkIcon');
    expect(linkButtons.length).toBe(3); // One for each node
  });

  test('calls addACloneNodeQueue when clone button is clicked', () => {
    render(<ExpandSearchResult {...defaultProps} />);
    
    const cloneButtons = screen.getAllByLabelText('Add Specialization');
    fireEvent.click(cloneButtons[0]);
    
    expect(defaultProps.addACloneNodeQueue).toHaveBeenCalledWith('node-1');
  });

  test('disables link button when conditions are met', () => {
    const checkedItems = new Set(['node-1']);
    const getNumOfGeneralizations = jest.fn().mockReturnValue(1);
    
    render(
      <ExpandSearchResult 
        {...defaultProps} 
        checkedItems={checkedItems}
        getNumOfGeneralizations={getNumOfGeneralizations}
        disabledAddButton={true}
      />
    );
    
    // The button for node-1 should be disabled
    const unlinkButton = screen.getByTestId('LinkOffIcon');
    expect(unlinkButton.closest('button')).toBeDisabled();
  });
});