import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ChatSideBar from ' @components/components/ChatSideBar/ChatSideBar';
import '@testing-library/jest-dom';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  query: jest.fn(),
  collection: jest.fn(),
  getDocs: jest.fn().mockResolvedValue({
    docs: [
      {
        data: () => ({
          uname: 'testuser',
          fName: 'Test',
          lName: 'User',
          imageUrl: 'test-image-url',
        }),
      },
    ],
  }),
  getFirestore: jest.fn(),
  addDoc: jest.fn().mockResolvedValue({}),
}));

// Mock Material UI components
jest.mock('@mui/material', () => ({
  Box: ({ children, sx }: any) => (
    <div data-testid="mock-box">{children}</div>
  ),
  Tabs: ({ children, value, onChange }: any) => (
    <div data-testid="mock-tabs" data-value={value}>
      {children}
      <button onClick={() => onChange({}, 1)}>Change Tab</button>
    </div>
  ),
  Tab: ({ label }: any) => <div data-testid={`mock-tab-${label}`}>{label}</div>,
  Button: ({ children, onClick, variant }: any) => (
    <button data-testid={`mock-button-${variant}`} onClick={onClick}>
      {children}
    </button>
  ),
  ListItem: ({ children, onClick, sx }: any) => (
    <div data-testid="mock-list-item" onClick={onClick}>
      {children}
    </div>
  ),
  Modal: ({ children, open, onClose }: any) => (
    open ? (
      <div data-testid="mock-modal">
        {children}
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null
  ),
  Paper: ({ children, sx }: any) => (
    <div data-testid="mock-paper">{children}</div>
  ),
  Typography: ({ children }: any) => (
    <div data-testid="mock-typography">{children}</div>
  ),
  IconButton: ({ children, onClick }: any) => (
    <button data-testid="mock-icon-button" onClick={onClick}>
      {children}
    </button>
  ),
}));

// Mock Close Icon
jest.mock('@mui/icons-material/Close', () => () => (
  <span data-testid="mock-close-icon">X</span>
));

// Mock TabPanel
jest.mock('@components/lib/utils/TabPanel', () => ({
  TabPanel: ({ children, value, index }: any) => (
    value === index ? <div data-testid={`tab-panel-${index}`}>{children}</div> : null
  ),
  a11yProps: (index: number) => ({
    id: `tab-${index}`,
    'aria-controls': `tabpanel-${index}`,
  }),
}));

// Mock Chat component
jest.mock('@components/components/Chat/Chat', () => {
  const mockSetOpenSelectModel = jest.fn();
  return {
    __esModule: true,
    default: ({ chatType, nodeId, user, users, placeholder, setOpenSelectModel }: any) => {
      mockSetOpenSelectModel.mockImplementation(setOpenSelectModel);
      return (
        <div data-testid={`mock-chat-${chatType}`}>
          <span>NodeId: {nodeId}</span>
          <span>User: {user?.uname}</span>
          <span>Placeholder: {placeholder}</span>
          <button onClick={() => mockSetOpenSelectModel()}>Open Modal</button>
        </div>
      );
    },
    mockSetOpenSelectModel,
  };
});

// Mock TreeViewSimplified
jest.mock('@components/components/OntologyComponents/TreeViewSimplified', () => ({
  __esModule: true,
  default: ({ sendNode }: any) => (
    <div data-testid="mock-tree-view">
      <button onClick={() => sendNode('test-node-id', 'Test Node')}>
        Send Test Node
      </button>
    </div>
  ),
}));

// Mock SearchBox
jest.mock('@components/components/SearchBox/SearchBox', () => ({
  SearchBox: ({ setSearch, search, label }: any) => (
    <div data-testid="mock-search-box">
      <input 
        value={search} 
        onChange={(e) => setSearch(e.target.value)} 
        placeholder={label} 
        data-testid="search-input"
      />
    </div>
  ),
}));

// Mock CONSTANTS
jest.mock('@components/lib/CONSTANTS', () => ({
  SCROLL_BAR_STYLE: {
    scrollbarWidth: 'thin',
  },
}));

// Mock DESIGN_SYSTEM_COLORS
jest.mock('@components/lib/theme/colors', () => ({
  DESIGN_SYSTEM_COLORS: {
    notebookG450: '#333',
    gray200: '#eee',
  },
}));

describe('ChatSideBar Component', () => {
  const mockProps = {
    currentVisibleNode: { id: 'test-node-id', title: 'Test Node' },
    user: {
      uname: 'testuser',
      fName: 'Test',
      lName: 'User',
      imageUrl: 'test-image-url',
      userId: 'test-user-id',
    },
    confirmIt: jest.fn(),
    searchWithFuse: jest.fn().mockReturnValue([
      { id: 'result-1', title: 'Search Result 1' },
      { id: 'result-2', title: 'Search Result 2' },
    ]),
    treeVisualization: {},
    expandedNodes: [],
    setExpandedNodes: jest.fn(),
    onOpenNodesTree: jest.fn(),
    navigateToNode: jest.fn(),
    chatTabs: [
      { title: 'Tab 1', id: 'tab1', placeholder: 'Type something...' },
      { title: 'Tab 2', id: 'tab2', placeholder: 'Type something else...' },
    ],
    selectedChatTab: 0,
    setSelectedChatTab: jest.fn(),
    nodes: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the chat sidebar with tabs', () => {
    render(<ChatSideBar {...mockProps} />);
    
    expect(screen.getAllByTestId('mock-box')).toHaveLength(2);
    expect(screen.getByTestId('mock-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('mock-tab-Tab 1')).toBeInTheDocument();
    expect(screen.getByTestId('mock-tab-Tab 2')).toBeInTheDocument();
  });

  test('changes tab when tab is clicked', () => {
    render(<ChatSideBar {...mockProps} />);
    
    fireEvent.click(screen.getByText('Change Tab'));
    
    expect(mockProps.setSelectedChatTab).toHaveBeenCalledWith(1);
  });

  test('opens node selection modal', async () => {
    render(<ChatSideBar {...mockProps} />);
    
    // First, make sure the modal is not initially rendered
    expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument();
    
    // Click the button to open the modal
    fireEvent.click(screen.getByText('Open Modal'));
    
    // Now the modal should be rendered
    expect(screen.getByTestId('mock-modal')).toBeInTheDocument();
  });

  test('searches for nodes when search input changes', async () => {
    render(<ChatSideBar {...mockProps} />);
    
    // Open the modal first
    fireEvent.click(screen.getByText('Open Modal'));
    
    // Find the search input
    const searchInput = screen.getByTestId('search-input');
    
    // Change the search value
    fireEvent.change(searchInput, { target: { value: 'test search' } });
    
    // Check if search results are displayed
    expect(mockProps.searchWithFuse).toHaveBeenCalledWith('test search');
    
    // The search results should be visible
    expect(screen.getAllByTestId('mock-list-item').length).toBe(2);
  });

  test('sends a node when send button is clicked', async () => {
    const addDoc = require('firebase/firestore').addDoc;
    
    render(<ChatSideBar {...mockProps} />);
    
    // Open the modal first
    fireEvent.click(screen.getByText('Open Modal'));
    
    // Change the search value to show search results
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'test search' } });
    
    // Find the send button in the first search result
    const sendButtons = screen.getAllByTestId('mock-button-outlined');
    fireEvent.click(sendButtons[0]);
    
    // Check if addDoc was called with the correct data
    expect(addDoc).toHaveBeenCalled();
  });

  test('closes the modal when close button is clicked', () => {
    render(<ChatSideBar {...mockProps} />);
    
    // Open the modal first
    fireEvent.click(screen.getByText('Open Modal'));
    
    // The modal should be open
    expect(screen.getByTestId('mock-modal')).toBeInTheDocument();
    
    // Click the close button
    fireEvent.click(screen.getByText('Close Modal'));
    
    // The modal should be closed
    expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument();
  });
});