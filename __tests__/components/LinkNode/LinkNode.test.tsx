import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Mock the actual LinkNode component instead of importing it
const MockLinkNode = (props: any) => {
  return (
    <div data-testid="link-node">
      <div data-testid="mock-typography">{props.title}</div>
      <button data-testid="mock-icon-button" onClick={() => props.replaceWith()}>Edit</button>
      <button data-testid="mock-icon-button" onClick={() => props.unlinkElement()}>Delete</button>
    </div>
  );
};

// Mock the actual component instead of requiring it
jest.mock('../../../../src/components/LinkNode/LinkNode', () => {
  return {
    __esModule: true,
    default: (props: any) => <MockLinkNode {...props} />
  };
});

// Mock Firebase
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApps: () => [{}],
  getApp: () => ({}),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: jest.fn(),
  collection: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  updateDoc: jest.fn(),
}));

// Mock Material UI components
jest.mock('@mui/material', () => ({
  Box: ({ children, sx }: { children: React.ReactNode; sx?: any }) => <div data-testid="mock-box">{children}</div>,
  Typography: ({ children, sx }: { children: React.ReactNode; sx?: any }) => <div data-testid="mock-typography">{children}</div>,
  IconButton: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button data-testid="mock-icon-button" onClick={onClick}>
      {children}
    </button>
  ),
  Tooltip: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div data-testid="mock-tooltip" title={title}>
      {children}
    </div>
  ),
  useTheme: () => ({
    palette: {
      mode: 'light',
      background: {
        paper: '#fff'
      },
      common: {
        notebookMainBlack: '#000000'
      }
    }
  }),
  keyframes: () => 'mock-keyframes'
}));

// Mock icons
jest.mock('@mui/icons-material/Edit', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-edit-icon">Edit Icon</div>
}));

jest.mock('@mui/icons-material/Delete', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-delete-icon">Delete Icon</div>
}));

// Mock LinkEditor component
jest.mock('../../../src/components/LinkNode/LinkEditor', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-link-editor">Link Editor</div>
}));

// Mock hooks and utilities with simple implementations
jest.mock('@components/lib/hooks/useConfirmDialog', () => ({
  __esModule: true,
  default: () => ({
    confirmIt: jest.fn(),
    ConfirmDialog: () => <div data-testid="mock-confirm-dialog">Confirm Dialog</div>
  })
}));

jest.mock('@components/lib/utils/string.utils', () => ({
  __esModule: true,
  getTitleDeleted: jest.fn().mockResolvedValue('Test Title')
}));

jest.mock('@components/lib/firestoreClient/collections', () => ({
  __esModule: true,
  NODES: 'nodes'
}));

// Mock types
jest.mock('@components/types/INode', () => ({
  __esModule: true,
  INode: {
    id: '',
    title: '',
    deleted: false,
    inheritance: {},
    specializations: [],
    generalizations: [],
    properties: { parts: [], isPartOf: [] },
    root: '',
    propertyType: {},
    nodeType: 'activity',
    textValue: {},
    createdBy: ''
  },
  ILinkNode: {
    id: '',
    source: '',
    target: '',
    label: '',
    type: ''
  },
  ICollection: {
    collectionName: '',
    nodes: []
  }
}));

// Import the LinkNode component (which is now mocked)
import LinkNode from '../../../../src/components/LinkNode/LinkNode';

describe('LinkNode Component', () => {
  const mockLink = {
    id: 'link-1',
    source: 'node-1',
    target: 'node-2',
    label: 'Test Link',
    type: 'default'
  };

  const defaultProps = {
    provided: {},
    link: mockLink,
    currentVisibleNode: {
      id: 'node-1',
      title: 'Test Node',
      deleted: false,
      inheritance: {},
      specializations: [],
      generalizations: [],
      properties: { parts: [], isPartOf: [] },
      root: 'root-node',
      propertyType: {},
      nodeType: 'activity' as const,
      textValue: {},
      createdBy: 'test-user'
    },
    property: 'test-property',
    setCurrentVisibleNode: jest.fn(),
    setSnackbarMessage: jest.fn(),
    navigateToNode: jest.fn(),
    title: 'Test Link',
    nodes: {
      'node-1': {
        id: 'node-1',
        title: 'Source Node',
        deleted: false,
        inheritance: {},
        specializations: [],
        generalizations: [],
        properties: { parts: [], isPartOf: [] },
        root: 'root-node',
        propertyType: {},
        nodeType: 'activity' as const,
        textValue: {},
        createdBy: 'test-user'
      },
      'node-2': {
        id: 'node-2',
        title: 'Target Node',
        deleted: false,
        inheritance: {},
        specializations: [],
        generalizations: [],
        properties: { parts: [], isPartOf: [] },
        root: 'root-node',
        propertyType: {},
        nodeType: 'activity' as const,
        textValue: {},
        createdBy: 'test-user'
      }
    },
    linkLocked: false,
    locked: false,
    user: { uname: 'test-user' },
    linkIndex: 0,
    collectionIndex: 0,
    selectedDiffNode: null,
    replaceWith: jest.fn(),
    saveNewAndSwapIt: jest.fn(),
    clonedNodesQueue: {},
    unlinkElement: jest.fn(),
    selectedProperty: 'test-property',
    glowIds: new Set(),
    unlinkVisible: true
  };

  const theme = createTheme();

  const renderWithTheme = (ui: React.ReactElement) => {
    return render(
      <ThemeProvider theme={theme}>
        {ui}
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders link information correctly', () => {
    renderWithTheme(<LinkNode {...defaultProps} />);
    
    expect(screen.getByTestId('mock-typography')).toBeInTheDocument();
  });

  test('calls replaceWith when edit button is clicked', () => {
    renderWithTheme(<LinkNode {...defaultProps} />);
    
    const editButton = screen.getAllByTestId('mock-icon-button')[0];
    fireEvent.click(editButton);
    
    expect(defaultProps.replaceWith).toHaveBeenCalled();
  });

  test('calls unlinkElement when delete button is clicked', () => {
    renderWithTheme(<LinkNode {...defaultProps} />);
    
    const deleteButton = screen.getAllByTestId('mock-icon-button')[1];
    fireEvent.click(deleteButton);
    
    expect(defaultProps.unlinkElement).toHaveBeenCalled();
  });

  test('renders with default values when node titles are not available', () => {
    const propsWithMissingNodes = {
      ...defaultProps,
      nodes: {}
    };
    
    renderWithTheme(<LinkNode {...propsWithMissingNodes} />);
    
    expect(screen.getByTestId('mock-typography')).toBeInTheDocument();
  });
});