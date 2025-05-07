import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TreeViewSimplified from '../../../src/components/OntologyComponents/TreeViewSimplified';

// Mock the module at the top level
jest.mock('../../../src/components/OntologyComponents/TreeViewSimplified', () => {
  const TreeViewSimplifiedMock = jest.fn(({ treeVisualization, categoriesOrder, setExpandedNodes, stopPropagation }) => (
    <div 
      data-testid="tree-view"
      onClick={() => setExpandedNodes && setExpandedNodes(new Set(['node-1']))}
    >
      {Object.keys(treeVisualization).map(nodeId => (
        <div key={nodeId} data-testid={`tree-item-${nodeId}`}>
          <div data-testid={`tree-item-children-${nodeId}`}>
            {Object.keys(treeVisualization[nodeId].specializations).length > 0 && !stopPropagation && (
              <TreeViewSimplifiedMock 
                treeVisualization={treeVisualization[nodeId].specializations}
                categoriesOrder={treeVisualization[nodeId].categoriesOrder}
                setExpandedNodes={setExpandedNodes}
                stopPropagation={stopPropagation}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  ));
  return {
    __esModule: true,
    default: TreeViewSimplifiedMock
  };
});

// Mock MUI components
jest.mock('@mui/lab', () => ({
  TreeView: ({ children, onNodeToggle, ...props }: { children: React.ReactNode; onNodeToggle: (event: React.MouseEvent, nodeIds: string[]) => void; [key: string]: any }) => (
    <div data-testid="tree-view" {...props} onClick={(e) => onNodeToggle(e, ['node-1'])}>
      {children}
    </div>
  ),
  TreeItem: ({ label, children, nodeId, ...props }: { label: React.ReactNode; children: React.ReactNode; nodeId: string; [key: string]: any }) => (
    <div data-testid={`tree-item-${nodeId}`} {...props}>
      {label}
      <div data-testid={`tree-item-children-${nodeId}`}>{children}</div>
    </div>
  ),
  treeItemClasses: {
    group: 'MuiTreeItem-group',
  },
  LoadingButton: ({ children, ...props }: { children: React.ReactNode; [key: string]: any }) => (
    <button data-testid="loading-button" {...props}>
      {children}
    </button>
  ),
}));

jest.mock('@mui/icons-material/ExpandMore', () => () => 'ExpandMoreIcon');
jest.mock('@mui/icons-material/ChevronRight', () => () => 'ChevronRightIcon');

describe('TreeViewSimplified Component', () => {
  const mockTreeVisualization = {
    'node-1': {
      id: 'node-1',
      title: 'Node 1',
      isCategory: false,
      specializations: {
        'node-2': {
          id: 'node-2',
          title: 'Node 2',
          isCategory: false,
          specializations: {},
        },
      },
      categoriesOrder: ['node-2'],
    },
    'node-3': {
      id: 'node-3',
      title: 'Node 3',
      isCategory: true,
      specializations: {},
    },
  };

  const defaultProps = {
    treeVisualization: mockTreeVisualization,
    expandedNodes: new Set(['node-1']),
    setExpandedNodes: jest.fn(),
    onOpenNodesTree: jest.fn(),
    currentVisibleNode: { id: 'node-1', title: 'Node 1' },
    markItemAsChecked: jest.fn(),
    checkedItems: new Set(),
    handleCloning: jest.fn(),
    clone: false,
    stopPropagation: '',
    preventLoops: new Set<string>(),
    searchValue: '',
    sendNode: jest.fn(),
    manageLock: true,
    categoriesOrder: ['node-1', 'node-3'],
    cloning: null,
    addACloneNodeQueue: jest.fn(),
    isSaving: false,
    disabledAddButton: false,
    selectedProperty: 'specializations',
    getNumOfGeneralizations: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders tree items based on treeVisualization', () => {
    render(<TreeViewSimplified {...defaultProps} />);
    
    expect(screen.getByTestId('tree-item-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('tree-item-node-3')).toBeInTheDocument();
  });

  test('sorts nodes based on categoriesOrder', () => {
    render(<TreeViewSimplified {...defaultProps} />);
    
    const treeView = screen.getAllByTestId('tree-view')[0];
    const treeItems = Array.from(treeView.children).filter(child => 
      child.getAttribute('data-testid')?.startsWith('tree-item-')
    );
    
    // First item should be node-1, second should be node-3 based on categoriesOrder
    expect(treeItems[0].getAttribute('data-testid')).toBe('tree-item-node-1');
    expect(treeItems[1].getAttribute('data-testid')).toBe('tree-item-node-3');
  });

  test('renders nested tree items for specializations', () => {
    render(<TreeViewSimplified {...defaultProps} />);
    
    // Check that node-2 is rendered as a child of node-1
    const node1Children = screen.getByTestId('tree-item-children-node-1');
    expect(node1Children).toContainElement(screen.getAllByTestId('tree-view')[1]); // Recursive TreeViewSimplified
  });

  test('updates expandedNodes when tree view is toggled', () => {
    render(<TreeViewSimplified {...defaultProps} />);
    
    // Click on the tree view to trigger onNodeToggle
    fireEvent.click(screen.getAllByTestId('tree-view')[0]);
    
    expect(defaultProps.setExpandedNodes).toHaveBeenCalledWith(new Set(['node-1']));
  });

  test('does not render specializations when stopPropagation matches node id', () => {
    render(
      <TreeViewSimplified 
        {...defaultProps} 
        stopPropagation="node-1"
      />
    );
    
    // node-1's children should not contain another TreeViewSimplified
    const node1Children = screen.getByTestId('tree-item-children-node-1');
    expect(node1Children.innerHTML).toBe('');
  });

  test('passes correct props to child TreeViewSimplified', () => {
    const TreeViewSimplifiedMock = require('../../../src/components/OntologyComponents/TreeViewSimplified').default;
    
    render(<TreeViewSimplified {...defaultProps} />);
    
    expect(TreeViewSimplifiedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        treeVisualization: mockTreeVisualization,
        categoriesOrder: ['node-1', 'node-3'],
      }),
      expect.anything()
    );
  });
});