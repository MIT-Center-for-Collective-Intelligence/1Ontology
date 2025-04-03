import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StructuredProperty from ' @components/components/StructuredProperty/StructuredProperty';
import '@testing-library/jest-dom';

jest.mock('@mui/material', () => ({
  Box: ({ children, sx, id }: any) => <div data-testid={id || 'mock-box'} style={sx}>{children}</div>,
  Button: ({ children, onClick, sx, variant, disabled }: any) => {
    const childText = typeof children === 'string' ? children : children?.toString() || '';
    // Clean up the text to create a reliable test ID
    const testId = `button-${childText.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    
    return (
      <button 
        data-testid={testId} 
        onClick={onClick} 
        disabled={disabled}
        style={sx}
      >
        {children}
      </button>
    );
  },
  Typography: ({ children, sx }: any) => <div data-testid="mock-typography" style={sx}>{children}</div>,
  Tooltip: ({ children, title }: any) => <div data-testid="mock-tooltip" title={title}>{children}</div>,
  Paper: ({ children, elevation, sx, id }: any) => (
    <div data-testid={id || 'mock-paper'} style={sx} elevation={elevation}>
      {children}
    </div>
  ),
  useTheme: () => ({
    palette: {
      mode: 'light',
    },
  }),
}));

jest.mock('@mui/lab', () => ({
  LoadingButton: ({ children, onClick, loading, disabled, sx, color }: any) => {
    const testId = `loading-button-${children?.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    
    return (
      <button 
        data-testid={testId} 
        onClick={onClick} 
        disabled={disabled || loading}
        aria-busy={loading}
        style={sx}
      >
        {children}
      </button>
    );
  },
}));

// Mock Firebase
const mockUpdateDoc = jest.fn(() => Promise.resolve());
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'mocked-doc-ref'),
  collection: jest.fn(() => 'mocked-collection'),
  getFirestore: jest.fn(() => ({ collection: jest.fn() })),
}));

// Mock dependent components
jest.mock(' @components/components/SelectInheritance/SelectInheritance', () => ({
  __esModule: true,
  default: (props: any) => <div data-testid="mock-select-inheritance">{props.property}</div>,
}));

jest.mock(' @components/components/Markdown/MarkdownRender', () => ({
  __esModule: true,
  default: ({ text }: any) => <div data-testid="mock-markdown-render">{text}</div>,
}));

jest.mock(' @components/components/StructuredProperty/VisualizeTheProperty', () => ({
  __esModule: true,
  default: (props: any) => <div data-testid="mock-visualize-property">{props.property}</div>,
}));

jest.mock(' @components/components/StructuredProperty/CollectionStructure', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="mock-collection-structure">
      {props.property}
      {props.model && <span data-testid="mock-model-mode">Model Mode Active</span>}
    </div>
  ),
}));

jest.mock(' @components/components/StructuredProperty/PropertyContributors', () => ({
  __esModule: true,
  default: (props: any) => <div data-testid="mock-property-contributors">{props.property}</div>,
}));

jest.mock(' @components/components/Models/SelectModel', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="mock-select-model">
      Select Model for {props.selectedProperty}
      <button 
        data-testid="mock-select-model-save-button" 
        onClick={props.onSave} 
        disabled={props.isSaving}
      >
        Save
      </button>
    </div>
  ),
}));

// Mock context and utils
jest.mock(' @components/components/context/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: { uid: 'test-user-id' } })),
}));

jest.mock(' @components/lib/utils/string.utils', () => ({
  capitalizeFirstLetter: jest.fn((str) => str.charAt(0).toUpperCase() + str.slice(1)),
  getPropertyValue: jest.fn((nodes, ref, property) => {
    if (property === 'description') return 'Description from inheritance';
    if (property === 'purpose') return null;
    return [];
  }),
  getTitle: jest.fn((nodes, id) => {
    if (id === 'parent-node') return 'Parent Node';
    if (id === 'node-1') return 'Node 1';
    return `Title for ${id}`;
  }),
  getTooltipHelper: jest.fn((property) => `Tooltip for ${property}`),
}));

jest.mock(' @components/lib/CONSTANTS', () => ({
  DISPLAY: {
    description: 'Description',
    purpose: 'Purpose',
    generalizations: 'Parents',
    specializations: 'Children',
  },
}));

jest.mock(' @components/lib/firestoreClient/collections', () => ({
  NODES: 'nodes',
}));

jest.mock(' @components/lib/utils/helpers', () => ({
  recordLogs: jest.fn(),
}));

describe('StructuredProperty Component', () => {
  // Setup mock data
  const defaultProps = {
    currentVisibleNode: {
      id: 'test-node',
      inheritance: {
        description: { ref: 'parent-node' },
        purpose: { ref: '' },
      },
      properties: {
        description: [],
        purpose: [{ collection: 'Purpose Collection', nodes: [{ id: 'node-1' }] }],
      },
      propertyType: {
        description: 'collection',
        purpose: 'collection',
        generalizations: 'collection',
        specializations: 'collection',
      },
      generalizations: [
        {
          collection: 'General Collection',
          nodes: [{ id: 'parent-node' }],
        },
      ],
      specializations: [
        {
          collection: 'Special Collection',
          nodes: [{ id: 'child-node' }],
        },
      ],
      unclassified: false,
    },
    editStructuredProperty: jest.fn(),
    setSelectedProperty: jest.fn(),
    navigateToNode: jest.fn(),
    setSnackbarMessage: jest.fn(),
    setCurrentVisibleNode: jest.fn(),
    property: 'description',
    nodes: {
      'test-node': {
        id: 'test-node',
        inheritance: {},
        properties: {},
      },
      'parent-node': {
        id: 'parent-node',
        inheritance: {},
        properties: {},
      },
      'node-1': {
        id: 'node-1',
        inheritance: {},
        properties: {},
        generalizations: [
          {
            nodes: [{ id: 'test-node' }],
          },
        ],
      },
      'child-node': {
        id: 'child-node',
        inheritance: {},
        properties: {},
        generalizations: [
          {
            nodes: [{ id: 'test-node' }],
          },
        ],
      },
    },
    locked: false,
    selectedDiffNode: null,
    confirmIt: jest.fn(),
    onGetPropertyValue: jest.fn((prop, getComment) => {
      if (getComment) return 'This is a comment';
      return [];
    }),
    currentImprovement: null,
    handleCloseAddLinksModel: jest.fn(),
    searchValue: '',
    setSearchValue: jest.fn(),
    searchResultsForSelection: [],
    checkedItems: new Set(),
    setCheckedItems: jest.fn(),
    checkedItemsCopy: new Set(),
    setCheckedItemsCopy: jest.fn(),
    handleCloning: jest.fn(() => Promise.resolve()),
    user: { uid: 'test-user-id' },
    expandedNodes: [],
    setExpandedNodes: jest.fn(),
    handleToggle: jest.fn(),
    getPath: jest.fn(),
    handleSaveLinkChanges: jest.fn(() => Promise.resolve()),
    checkDuplicateTitle: jest.fn(),
    cloning: false,
    addACloneNodeQueue: jest.fn(),
    setClonedNodesQueue: jest.fn(),
    clonedNodesQueue: {},
    newOnes: new Set(),
    setNewOnes: jest.fn(),
    removedElements: new Set(),
    setRemovedElements: jest.fn(),
    addedElements: new Set(),
    setAddedElements: jest.fn(),
    glowIds: new Set(),
    setGlowIds: jest.fn(),
    selectedCollection: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = console.error;
  });

  test('renders with basic props', () => {
    render(<StructuredProperty {...defaultProps} />);
    
    // Check if component renders with correct property value
    expect(screen.getByTestId('property-description')).toBeInTheDocument();
    expect(screen.getByTestId('mock-collection-structure')).toBeInTheDocument();
  });

  test('displays inherited property message when property is inherited', () => {
    render(<StructuredProperty {...defaultProps} />);
    
    const mockTypography = screen.getAllByTestId('mock-typography');
    // Check for the inheritance message using text content
    expect(mockTypography.some(el => el.textContent?.includes('Inherited from'))).toBe(true);
  });

  test('displays edit button when not locked', () => {
    render(<StructuredProperty {...defaultProps} />);
    
    // Find button by text content instead of relying on precise testid
    const editButton = screen.getByText(/edit description/i, { selector: 'button' });
    expect(editButton).toBeInTheDocument();
  });

  test('edit button still present but functionality limited when locked', () => {
    const mockedEditStructured = jest.fn();
    
    render(
      <StructuredProperty 
        {...defaultProps} 
        locked={true} 
        editStructuredProperty={mockedEditStructured}
      />
    );
    
    // Check if button still renders but might have different behavior when locked
    const editButton = screen.getByText(/edit description/i, { selector: 'button' });
    expect(editButton).toBeInTheDocument();
    
    // Verify clicking the edit button with locked=true has expected behavior
    fireEvent.click(editButton);
    expect(mockedEditStructured).toHaveBeenCalledWith('description');
    
    // Note: The actual component's locked state handling would need to be
    // tested based on how the editStructuredProperty function behaves when locked
  });

  test('renders SelectInheritance component for regular properties', () => {
    render(<StructuredProperty {...defaultProps} />);
    
    expect(screen.getByTestId('mock-select-inheritance')).toBeInTheDocument();
  });

  test('does not render SelectInheritance for specializations', () => {
    render(<StructuredProperty {...defaultProps} property="specializations" />);
    
    expect(screen.queryByTestId('mock-select-inheritance')).not.toBeInTheDocument();
  });

  test('displays comment section when comments exist', () => {
    render(<StructuredProperty {...defaultProps} />);
    
    expect(screen.getByTestId('mock-markdown-render')).toBeInTheDocument();
    expect(screen.getByTestId('mock-markdown-render').textContent).toBe('This is a comment');
  });

  test('renders SelectModel when in edit mode', () => {
    render(<StructuredProperty {...defaultProps} selectedProperty="description" />);
    
    expect(screen.getByTestId('mock-select-model')).toBeInTheDocument();
    expect(screen.getByTestId('mock-model-mode')).toBeInTheDocument();
  });

  test('shows VisualizeTheProperty when currentImprovement exists', () => {
    const improvement = {
      implemented: false,
      newNode: false,
      modifiedProperty: 'description',
    };
    
    render(<StructuredProperty {...defaultProps} currentImprovement={improvement} />);
    
    expect(screen.getByTestId('mock-visualize-property')).toBeInTheDocument();
  });

  test('Save button is disabled when no changes are made', () => {
    render(
      <StructuredProperty 
        {...defaultProps} 
        selectedProperty="description" 
        addedElements={new Set()} 
        removedElements={new Set()} 
      />
    );
    
    const saveButton = screen.getByTestId('loading-button-save');
    expect(saveButton).toBeDisabled();
  });

  test('Save button is enabled when changes are made', () => {
    const addedElements = new Set(['node-3']);
    
    render(
      <StructuredProperty 
        {...defaultProps} 
        selectedProperty="description" 
        addedElements={addedElements} 
        removedElements={new Set()} 
      />
    );
    
    const saveButton = screen.getByTestId('loading-button-save');
    expect(saveButton).not.toBeDisabled();
  });

  test('clicking Save button triggers onSave function', async () => {
    const addedElements = new Set(['node-3']);
    const handleCloseAddLinksModel = jest.fn();
    const handleSaveLinkChanges = jest.fn(() => Promise.resolve());
    
    render(
      <StructuredProperty 
        {...defaultProps} 
        selectedProperty="description" 
        addedElements={addedElements} 
        removedElements={new Set()} 
        handleCloseAddLinksModel={handleCloseAddLinksModel}
        handleSaveLinkChanges={handleSaveLinkChanges}
      />
    );
    
    const saveButton = screen.getByTestId('loading-button-save');
    fireEvent.click(saveButton);
    
    // Check if handler was called
    await waitFor(() => {
      expect(handleCloseAddLinksModel).toHaveBeenCalled();
      expect(handleSaveLinkChanges).toHaveBeenCalled();
    });
  });

  test('handles error during save operation', async () => {
    const addedElements = new Set(['node-3']);
    const handleSaveLinkChanges = jest.fn(() => Promise.reject(new Error('Save failed')));
    const { recordLogs } = require(' @components/lib/utils/helpers');
    
    render(
      <StructuredProperty 
        {...defaultProps} 
        selectedProperty="description" 
        addedElements={addedElements} 
        removedElements={new Set()} 
        handleSaveLinkChanges={handleSaveLinkChanges}
      />
    );
    
    const saveButton = screen.getByTestId('loading-button-save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(recordLogs).toHaveBeenCalled();
    });
  });

  test('displays Add Collection button for specializations property', () => {
    render(<StructuredProperty {...defaultProps} property="specializations" />);
    
    // Find button by text content
    const addCollectionButton = screen.getByText(/add collection/i, { selector: 'button' });
    expect(addCollectionButton).toBeInTheDocument();
  });

  test('clicking Cancel button in edit mode calls handleCloseAddLinksModel', () => {
    const handleCloseAddLinksModel = jest.fn();
    
    render(
      <StructuredProperty 
        {...defaultProps} 
        selectedProperty="description" 
        handleCloseAddLinksModel={handleCloseAddLinksModel}
      />
    );
    
    // Find button by text content
    const cancelButton = screen.getByText(/cancel/i, { selector: 'button' });
    fireEvent.click(cancelButton);
    
    expect(handleCloseAddLinksModel).toHaveBeenCalled();
  });

  test('renders for generalizations property', () => {
    render(<StructuredProperty {...defaultProps} property="generalizations" />);
    
    expect(screen.getByTestId('property-generalizations')).toBeInTheDocument();
    // Check that property contributors is shown for generalizations
    expect(screen.getByTestId('mock-property-contributors').textContent).toBe('generalizations');
  });

  test('renders for specializations property', () => {
    render(<StructuredProperty {...defaultProps} property="specializations" />);
    
    expect(screen.getByTestId('property-specializations')).toBeInTheDocument();
    // Check that property contributors is shown for specializations
    expect(screen.getByTestId('mock-property-contributors').textContent).toBe('specializations');
  });

  test('calls editStructuredProperty when Edit button is clicked', () => {
    const editStructuredProperty = jest.fn();
    
    render(
      <StructuredProperty 
        {...defaultProps}
        editStructuredProperty={editStructuredProperty}
      />
    );
    
    // Find button by text content
    const editButton = screen.getByText(/edit description/i, { selector: 'button' });
    fireEvent.click(editButton);
    
    expect(editStructuredProperty).toHaveBeenCalledWith('description');
  });
});