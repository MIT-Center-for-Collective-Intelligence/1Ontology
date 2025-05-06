import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SelectModelModal from '../../../src/components/Models/SelectModel';
import '@testing-library/jest-dom';
import { INode, INodeTypes } from ' @components/types/INode';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mocked-collection'),
  query: jest.fn(() => 'mocked-query'),
  where: jest.fn(() => 'mocked-where'),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  getFirestore: jest.fn(() => ({})),
}));

// Mock Material UI components
jest.mock('@mui/material', () => ({
  Modal: ({ children, open, onClose }: { children: React.ReactNode; open: boolean; onClose: () => void }) => open ? (
    <div data-testid="mock-modal">
      {children}
      <button data-testid="close-modal" onClick={onClose}>Close Modal</button>
    </div>
  ) : null,
  Box: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-box">{children}</div>,
  Paper: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-paper">{children}</div>,
  Typography: ({ children, variant }: { children: React.ReactNode; variant?: string }) => <div data-testid={`mock-typography-${variant || 'default'}`}>{children}</div>,
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) => (
    <button data-testid="mock-button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Tooltip: ({ children, title }: { children: React.ReactNode; title: string }) => <div data-testid="mock-tooltip" title={title}>{children}</div>,
  Divider: () => <div data-testid="mock-divider" />,
}));

// Mock LoadingButton
jest.mock('@mui/lab', () => ({
  LoadingButton: ({ children, onClick, loading }: { children: React.ReactNode; onClick: () => void; loading?: boolean }) => (
    <button data-testid="mock-loading-button" onClick={onClick} disabled={loading}>
      {children}
      {loading && <span>Loading...</span>}
    </button>
  ),
}));

// Mock other components
jest.mock('../../../src/components/OntologyComponents/ExpandSearchResult', () => ({
  __esModule: true,
  default: (props: { [key: string]: any }) => <div data-testid="mock-expand-search-result">ExpandSearchResult Component</div>,
}));

jest.mock('../../../src/components/OntologyComponents/TreeViewSimplified', () => ({
  __esModule: true,
  default: (props: { [key: string]: any }) => <div data-testid="mock-tree-view-simplified">TreeViewSimplified Component</div>,
}));

jest.mock('../../../src/components/SearchBox/SearchBox', () => ({
  SearchBox: (props: { [key: string]: any }) => (
    <div data-testid="mock-search-box">
      <input 
        data-testid="mock-search-input" 
        onChange={(e) => props.setSearchValue(e.target.value)}
        value={props.searchValue}
      />
    </div>
  ),
}));

jest.mock('../../../src/components/OntologyComponents/Text', () => ({
  __esModule: true,
  default: (props: { text: string }) => <div data-testid="mock-text">{props.text}</div>,
}));

// Mock constants and utils
jest.mock(' @components/lib/CONSTANTS', () => ({
  SCROLL_BAR_STYLE: {},
  DISPLAY: {},
  UNCLASSIFIED: {
    concept: 'New Concept',
    activity: 'New Activity',
    actor: 'New Actor',
    evaluationDimension: 'New Evaluation Dimension',
  },
}));

jest.mock(' @components/lib/utils/string.utils', () => ({
  capitalizeFirstLetter: jest.fn((str) => str.charAt(0).toUpperCase() + str.slice(1)),
}));

describe('SelectModelModal Component', () => {
  const mockNode = {
    id: 'node-1',
    title: 'Test Node',
    deleted: false,
    nodeType: 'concept' as INodeTypes,
    propertyType: {
      specializations: 'concept',
      generalizations: 'concept',
      parts: 'concept',
      isPartOf: 'concept',
    },
    properties: {
      parts: [],
      isPartOf: []
    },
    inheritance: {},
    specializations: [],
    generalizations: [],
    root: 'root-node',
    textValue: {},
    createdBy: 'test-user'
  } as INode;

  const mockNodes = {
    'node-1': mockNode,
    'node-2': {
      id: 'node-2',
      nodeType: 'concept' as INodeTypes,
      properties: {},
      inheritance: {},
    } as INode,
  };

  const defaultProps = {
    handleCloseAddLinksModel: jest.fn(),
    onSave: jest.fn(),
    selectedProperty: 'specializations',
    currentVisibleNode: mockNode,
    setSearchValue: jest.fn(),
    searchValue: '',
    searchResultsForSelection: [],
    checkedItems: new Set<string>(),
    setCheckedItems: jest.fn(),
    checkedItemsCopy: new Set<string>(),
    handleCloning: jest.fn(),
    user: { uname: 'testuser' },
    nodes: mockNodes,
    selectFromTree: jest.fn(),
    expandedNodes: [],
    setExpandedNodes: jest.fn(),
    handleToggle: jest.fn(),
    getPath: jest.fn(),
    locked: false,
    selectedDiffNode: null,
    confirmIt: jest.fn(),
    currentImprovement: null,
    onGetPropertyValue: jest.fn(),
    setCurrentVisibleNode: jest.fn(),
    cloning: null,
    addACloneNodeQueue: jest.fn(),
    newOnes: new Set<string>(),
    setNewOnes: jest.fn(),
    setEditableProperty: jest.fn(),
    removedElements: new Set<string>(),
    addedElements: new Set<string>(),
    setRemovedElements: jest.fn(),
    setAddedElements: jest.fn(),
    isSaving: false,
    scrollToElement: jest.fn(),
    selectedCollection: 'main',
    setCheckedItemsCopy: jest.fn(),
    handleSaveLinkChanges: jest.fn(),
    checkDuplicateTitle: jest.fn(),
    setClonedNodesQueue: jest.fn(),
    setSearchResultsForSelection: jest.fn(),
    clonedNodesQueue: {},
    editableProperty: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders modal when open', () => {
    render(<SelectModelModal {...defaultProps} />);
    
    expect(screen.getByTestId('mock-paper')).toBeInTheDocument();
  });

  test('displays correct title based on property type', () => {
    render(<SelectModelModal {...defaultProps} />);
    
    expect(screen.getByTestId('mock-text')).toBeInTheDocument();
    expect(screen.getByText(/Select the/)).toBeInTheDocument();
    const specializationElements = screen.getAllByText(/Specialization/);
    expect(specializationElements[0]).toHaveStyle({ color: 'orange' });
  });

  test('renders search box and tree view components', () => {
    render(<SelectModelModal {...defaultProps} />);
    
    expect(screen.getByTestId('mock-search-box')).toBeInTheDocument();
    expect(screen.getByTestId('mock-tree-view-simplified')).toBeInTheDocument();
  });

  test('renders search results when available', () => {
    const propsWithResults = {
      ...defaultProps,
      searchValue: 'test',
      searchResultsForSelection: [
        { id: '1', title: 'Test Result' }
      ]
    };
    
    render(<SelectModelModal {...propsWithResults} />);
    
    expect(screen.getByTestId('mock-expand-search-result')).toBeInTheDocument();
  });

  test('handles save button click', async () => {
    render(<SelectModelModal {...defaultProps} />);
    
    const saveButton = screen.getByTestId('mock-loading-button');
    fireEvent.click(saveButton);
    
    expect(defaultProps.onSave).toHaveBeenCalled();
  });

  test('handles close button click', () => {
    render(<SelectModelModal {...defaultProps} />);
    
    const closeButton = screen.getByText('Cancel');
    fireEvent.click(closeButton);
    
    expect(defaultProps.handleCloseAddLinksModel).toHaveBeenCalled();
  });

  test('disables save button when appropriate', () => {
    const propsWithSaving = {
      ...defaultProps,
      isSaving: true,
    };
    
    render(<SelectModelModal {...propsWithSaving} />);
    
    const saveButton = screen.getByTestId('mock-loading-button');
    expect(saveButton).toBeDisabled();
  });

  test('displays correct button text for creating new items', () => {
    render(<SelectModelModal {...defaultProps} />);
    
    expect(screen.getByText('Create')).toBeInTheDocument();
  });
});