import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Node from ' @components/components/OntologyComponents/Node';
import '@testing-library/jest-dom';


const mockUpdateDoc = jest.fn(() => Promise.resolve());
const mockSetDoc = jest.fn(() => Promise.resolve());
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockBatch = {
  _mutations: [],
  _committed: false,
  update: jest.fn(),
  commit: jest.fn(() => Promise.resolve()),
};
const mockDocRef = { id: 'mock-doc-id' };

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => mockDocRef),
  collection: jest.fn(() => 'mocked-collection'),
  updateDoc: (...args: any) => mockUpdateDoc(...args),
  setDoc: (...args: any) => mockSetDoc(...args),
  getDoc: (...args: any) => mockGetDoc(...args),
  getDocs: (...args: any) => mockGetDocs(...args),
  getFirestore: jest.fn(() => ({ 
    collection: jest.fn(() => ({
      doc: jest.fn(() => 'mocked-doc-ref')
    }))
  })),
  writeBatch: jest.fn(() => mockBatch),
  query: jest.fn(),
  where: jest.fn(),
}));


jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({}))
}));


jest.mock('@mui/material', () => ({
  Popover: ({ children, open }) => (open ? <div data-testid="mock-popover">{children}</div> : null),
  Stack: ({ children, direction }) => <div data-testid="mock-stack" data-direction={direction}>{children}</div>,
  useMediaQuery: jest.fn(() => false),
}));

jest.mock('@mui/system', () => ({
  Box: ({ children, sx }) => <div data-testid="mock-box">{children}</div>,
}));


jest.mock(' @components/components/NodBody/NodeBody', () => ({
  __esModule: true,
  default: (props: any) => <div data-testid="mock-node-body">NodeBody Component</div>
}));

jest.mock(' @components/components/NodBody/NodeActivityFlow', () => ({
  __esModule: true,
  default: (props: any) => <div data-testid="mock-node-activity-flow">NodeActivityFlow Component</div>
}));

jest.mock(' @components/components/OntologyComponents/Text', () => ({
  __esModule: true,
  default: (props: { property: string; deleteNode: React.MouseEventHandler<HTMLButtonElement> | undefined; handleLockNode: React.MouseEventHandler<HTMLButtonElement> | undefined; text: string | number | bigint | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Promise<React.AwaitedReactNode> | null | undefined; }) => (
    <div data-testid={`mock-text-${props.property}`}>
      {props.property === 'title' && (
        <>
          <button 
            data-testid="delete-node-button" 
            onClick={props.deleteNode}
          >
            Delete Node
          </button>
          <button 
            data-testid="lock-node-button" 
            onClick={props.handleLockNode}
          >
            Lock Node
          </button>
        </>
      )}
      Text Component: {props.text}
    </div>
  )
}));

jest.mock(' @components/components/StructuredProperty/StructuredProperty', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid={`mock-structured-property-${props.property}`}>
      StructuredProperty Component: {props.property}
      <button 
        data-testid={`edit-${props.property}-button`}
        onClick={() => props.editStructuredProperty(props.property, 'main')}
      >
        Edit {props.property}
      </button>
    </div>
  )
}));


const mockConfirmIt = jest.fn();
jest.mock(' @components/lib/hooks/useConfirmDialog', () => ({
  __esModule: true,
  default: () => ({
    confirmIt: mockConfirmIt,
    ConfirmDialog: <div data-testid="mock-confirm-dialog">Confirm Dialog</div>
  })
}));


jest.mock(' @components/lib/firestoreClient/collections', () => ({
  NODES: 'nodes',
}));

jest.mock(' @components/lib/CONSTANTS', () => ({
  DESIGN_SYSTEM_COLORS: {},
  development: true
}));

jest.mock(' @components/lib/utils/string.utils', () => ({
  generateUniqueTitle: jest.fn((title) => title),
  getPropertyValue: jest.fn((nodes, ref, property, structured) => null),
  getTitle: jest.fn((nodes, nodeId) => `Title for ${nodeId}`),
}));


const mockCheckIfCanDeleteANode = jest.fn(() => false);
const mockCreateNewNode = jest.fn();
const mockGenerateInheritance = jest.fn();
const mockRecordLogs = jest.fn();
const mockUpdateLinksForInheritance = jest.fn();
const mockRemoveIsPartOf = jest.fn();
const mockSaveNewChangeLog = jest.fn();
const mockUnlinkPropertyOf = jest.fn();
const mockUpdateInheritance = jest.fn();
const mockUpdatePartsAndPartsOf = jest.fn();
const mockUpdatePropertyOf = jest.fn();
const mockUpdateSpecializations = jest.fn();
const mockUpdateLinksForInheritanceSpecializations = jest.fn();
const mockUpdateLinks = jest.fn();
const mockClearNotifications = jest.fn();

jest.mock(' @components/lib/utils/helpers', () => ({
  checkIfCanDeleteANode: (...args: any) => mockCheckIfCanDeleteANode(...args),
  createNewNode: (...args: any) => mockCreateNewNode(...args),
  generateInheritance: (...args: any) => mockGenerateInheritance(...args),
  recordLogs: (...args: any) => mockRecordLogs(...args),
  updateLinksForInheritance: (...args: any) => mockUpdateLinksForInheritance(...args),
  removeIsPartOf: (...args: any) => mockRemoveIsPartOf(...args),
  saveNewChangeLog: (...args: any) => mockSaveNewChangeLog(...args),
  unlinkPropertyOf: (...args: any) => mockUnlinkPropertyOf(...args),
  updateInheritance: (...args: any) => mockUpdateInheritance(...args),
  updatePartsAndPartsOf: (...args: any) => mockUpdatePartsAndPartsOf(...args),
  updatePropertyOf: (...args: any) => mockUpdatePropertyOf(...args),
  updateSpecializations: (...args: any) => mockUpdateSpecializations(...args),
  updateLinksForInheritanceSpecializations: (...args: any) => mockUpdateLinksForInheritanceSpecializations(...args),
  updateLinks: (...args: any) => mockUpdateLinks(...args),
  clearNotifications: (...args: any) => mockClearNotifications(...args),
}));

describe('Node Component', () => {
  
  const mockCurrentVisibleNode = {
    id: 'node-1',
    title: 'Test Node',
    description: 'This is a test node',
    nodeType: 'activity',
    inheritance: {
      description: { ref: null, inheritanceType: 'alwaysInherit' },
      actor: { ref: null, inheritanceType: 'alwaysInherit' },
      parts: { ref: null, inheritanceType: 'alwaysInherit' },
      isPartOf: { ref: null, inheritanceType: 'alwaysInherit' }
    },
    properties: {
      description: 'Test description',
      actor: [{ collectionName: 'main', nodes: [{ id: 'actor-1' }] }],
      parts: [{ collectionName: 'main', nodes: [{ id: 'part-1' }] }],
      isPartOf: [{ collectionName: 'main', nodes: [{ id: 'parent-1' }] }]
    },
    specializations: [
      { collectionName: 'main', nodes: [{ id: 'spec-1' }, { id: 'spec-2' }] }
    ],
    generalizations: [
      { collectionName: 'main', nodes: [{ id: 'gen-1' }] }
    ],
    propertyType: {
      actor: 'actor'
    },
    root: '',
    locked: false,
    textValue: {}
  };

  const mockNodes = {
    'node-1': mockCurrentVisibleNode,
    'actor-1': {
      id: 'actor-1',
      title: 'Actor 1',
      properties: { 
        description: 'Actor description',
        actor: []
      },
      inheritance: {},
      specializations: [],
      generalizations: []
    },
    'part-1': {
      id: 'part-1',
      title: 'Part 1',
      properties: { description: 'Part description' },
      specializations: [],
      generalizations: []
    },
    'spec-1': {
      id: 'spec-1',
      title: 'Specialization 1',
      properties: { description: 'Spec description' },
      specializations: [],
      generalizations: []
    },
    'spec-2': {
      id: 'spec-2',
      title: 'Specialization 2',
      properties: { description: 'Spec 2 description' },
      specializations: [],
      generalizations: []
    },
    'gen-1': {
      id: 'gen-1',
      title: 'Generalization 1',
      properties: { description: 'Gen description' },
      specializations: [],
      generalizations: []
    },
    'parent-1': {
      id: 'parent-1',
      title: 'Parent 1',
      properties: { description: 'Parent description' },
      specializations: [],
      generalizations: []
    },
    'parent-node': {
      id: 'parent-node',
      title: 'Parent Node',
      properties: { 
        actor: [{ collectionName: 'main', nodes: [{ id: 'actor-1' }] }]
      },
      specializations: [],
      generalizations: []
    }
  };

  const mockUser = {
    uname: 'testUser',
    email: 'test@example.com',
    manageLock: true,
    claims: {
      flowChart: true
    }
  };

  const mockMainSpecializations = {
    activity: {
      specializations: { main: { nodes: [{ id: 'spec-template-1' }] } }
    },
    actor: {
      specializations: { main: { nodes: [{ id: 'actor-template-1' }] } }
    }
  };

  const defaultProps = {
    currentVisibleNode: mockCurrentVisibleNode,
    setCurrentVisibleNode: jest.fn(),
    setSnackbarMessage: jest.fn(),
    user: mockUser,
    mainSpecializations: mockMainSpecializations,
    nodes: mockNodes,
    navigateToNode: jest.fn(),
    eachOntologyPath: {},
    searchWithFuse: jest.fn(() => []),
    locked: false,
    selectedDiffNode: null,
    displaySidebar: jest.fn(),
    activeSidebar: null,
    currentImprovement: null,
    setNodes: jest.fn(),
    checkedItems: new Set(),
    setCheckedItems: jest.fn(),
    checkedItemsCopy: new Set(),
    setCheckedItemsCopy: jest.fn(),
    searchValue: '',
    setSearchValue: jest.fn(),
    clonedNodesQueue: {},
    setClonedNodesQueue: jest.fn(),
    newOnes: new Set(),
    setNewOnes: jest.fn(),
    selectedProperty: '',
    setSelectedProperty: jest.fn(),
    removedElements: new Set(),
    setRemovedElements: jest.fn(),
    addedElements: new Set(),
    setAddedElements: jest.fn(),
    handleCloseAddLinksModel: jest.fn(),
    setSelectedCollection: jest.fn(),
    selectedCollection: 'main'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    
    mockConfirmIt.mockReset();
    mockConfirmIt.mockResolvedValue(true);
    
    mockCheckIfCanDeleteANode.mockReset();
    mockCheckIfCanDeleteANode.mockReturnValue(false);
    
    
    document.getElementById = jest.fn().mockImplementation(() => ({
      clientWidth: 1200
    }));
    
    
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }));
  });

  test('renders node with title and description', () => {
    render(<Node {...defaultProps} />);
    
    expect(screen.getByTestId('mock-text-title')).toBeInTheDocument();
    expect(screen.getByTestId('mock-text-description')).toBeInTheDocument();
  });

  test('renders structured properties for actor, specializations, generalizations, isPartOf, and parts', () => {
    render(<Node {...defaultProps} />);
    
    expect(screen.getByTestId('mock-structured-property-actor')).toBeInTheDocument();
    expect(screen.getByTestId('mock-structured-property-generalizations')).toBeInTheDocument();
    expect(screen.getByTestId('mock-structured-property-specializations')).toBeInTheDocument();
    expect(screen.getByTestId('mock-structured-property-isPartOf')).toBeInTheDocument();
    expect(screen.getByTestId('mock-structured-property-parts')).toBeInTheDocument();
  });

  test('renders NodeBody component', () => {
    render(<Node {...defaultProps} />);
    
    expect(screen.getByTestId('mock-node-body')).toBeInTheDocument();
  });

  test('renders NodeActivityFlow for activity node types if user has flowChart claim', () => {
    render(<Node {...defaultProps} />);
    
    expect(screen.getByTestId('mock-node-activity-flow')).toBeInTheDocument();
  });

  test('does not render NodeActivityFlow for non-activity node types', () => {
    const props = {
      ...defaultProps,
      currentVisibleNode: {
        ...mockCurrentVisibleNode,
        nodeType: 'concept'
      }
    };
    
    render(<Node {...props} />);
    
    expect(screen.queryByTestId('mock-node-activity-flow')).not.toBeInTheDocument();
  });

  test('handles property editing when edit button is clicked', () => {
    render(<Node {...defaultProps} />);
    
    fireEvent.click(screen.getByTestId('edit-specializations-button'));
    
    expect(defaultProps.setSelectedProperty).toHaveBeenCalledWith('specializations');
    expect(defaultProps.setSelectedCollection).toHaveBeenCalledWith('main');
    expect(defaultProps.setCheckedItems).toHaveBeenCalled();
    expect(defaultProps.setCheckedItemsCopy).toHaveBeenCalled();
  });

  test('handles node deletion', async () => {
    
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => mockCurrentVisibleNode,
      ref: { id: 'node-1' }
    });
    
    mockConfirmIt.mockImplementationOnce(() => Promise.resolve(true));
    
    
    render(<Node {...defaultProps} />);
    
    
    fireEvent.click(screen.getByTestId('delete-node-button'));
    
    
    await waitFor(() => {
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        mockDocRef,
        { deleted: true, deletedAt: expect.any(Date) }
      );
    });
  });

  test('prevents deletion if node has specializations that cannot be deleted', async () => {
    
    mockCheckIfCanDeleteANode.mockReturnValueOnce(true);
    
    
    mockConfirmIt.mockImplementationOnce(() => Promise.resolve(true));
    
    
    render(<Node {...defaultProps} />);
    
    
    fireEvent.click(screen.getByTestId('delete-node-button'));
    
    
    await waitFor(() => {
      expect(mockConfirmIt).toHaveBeenCalled();
    });
    
    
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  test('handles node locking when lock button is pressed', async () => {
    
    render(<Node {...defaultProps} />);
    
    
    fireEvent.click(screen.getByTestId('lock-node-button'));
    
    
    await waitFor(() => {
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        mockDocRef,
        { locked: true }
      );
    });
  });
});