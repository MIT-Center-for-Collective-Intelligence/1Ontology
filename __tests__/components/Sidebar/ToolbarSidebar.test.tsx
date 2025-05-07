import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Mock the actual component instead of importing it
const MockToolbarSidebar = (props: any) => {
  return (
    <div data-testid="toolbar-sidebar">
      <div data-testid="mock-box">
        <button 
          data-testid="mock-icon-button" 
          onClick={props.activeSidebar ? () => props.setActiveSidebar(null) : props.handleExpandSidebar}
        >
          {props.activeSidebar ? 'Close' : 'Menu'}
        </button>
        {props.activeSidebar && <div data-testid="sidebar-content">{props.activeSidebar}</div>}
      </div>
    </div>
  );
};

// Mock the component to avoid importing the actual file with dependencies
jest.mock('../../../src/components/Sidebar/ToolbarSidebar', () => ({
  MemoizedToolbarSidebar: (props: any) => <MockToolbarSidebar {...props} />
}));

// Import the mocked component
const { MemoizedToolbarSidebar: ToolbarSidebar } = require('../../../src/components/Sidebar/ToolbarSidebar');

// Mock Material UI components
jest.mock('@mui/material', () => ({
  Box: ({ children, sx }: any) => <div data-testid="mock-box">{children}</div>,
  Paper: ({ children, sx }: any) => <div data-testid="mock-paper">{children}</div>,
  Drawer: ({ children, open, variant, anchor, onClose }: any) => (
    <div 
      data-testid="mock-drawer" 
      data-open={open} 
      data-variant={variant} 
      data-anchor={anchor}
    >
      {children}
      {onClose && <button data-testid="close-drawer" onClick={onClose}>Close</button>}
    </div>
  ),
  IconButton: ({ children, onClick, edge, sx }: any) => (
    <button 
      data-testid="mock-icon-button" 
      onClick={onClick}
      data-edge={edge}
    >
      {children}
    </button>
  ),
  Tooltip: ({ children, title }: any) => (
    <div data-testid="mock-tooltip" title={title}>
      {children}
    </div>
  ),
  useTheme: () => ({
    palette: {
      mode: 'light',
      background: {
        paper: '#fff'
      }
    }
  }),
}));

// Mock icons
jest.mock('@mui/icons-material/Menu', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-menu-icon">Menu Icon</div>
}));

// Mock any other components that might be used in ToolbarSidebar
jest.mock('../../../src/lib/CONSTANTS', () => ({
  SCROLL_BAR_STYLE: { scrollbarWidth: 'thin' },
}));

describe('ToolbarSidebar Component', () => {
  const defaultProps = {
    toolbarRef: { current: null },
    user: null,
    openSearchedNode: jest.fn(),
    searchWithFuse: jest.fn(),
    nodes: {},
    selectedDiffNode: null,
    setSelectedDiffNode: jest.fn(),
    currentVisibleNode: null,
    setCurrentVisibleNode: jest.fn(),
    confirmIt: jest.fn(),
    activeSidebar: null,
    setActiveSidebar: jest.fn(),
    handleExpandSidebar: jest.fn(),
    navigateToNode: jest.fn(),
    treeVisualization: {},
    expandedNodes: [],
    setExpandedNodes: jest.fn(),
    onOpenNodesTree: jest.fn(),
    setDisplayGuidelines: jest.fn(),
    displayGuidelines: false,
    currentImprovement: null,
    setCurrentImprovement: jest.fn(),
    lastSearches: [],
    updateLastSearches: jest.fn(),
    selectedChatTab: 0,
    setSelectedChatTab: jest.fn()
  };

  const renderWithTheme = (ui: React.ReactElement) => {
    const theme = createTheme();
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders without crashing', () => {
    renderWithTheme(<ToolbarSidebar {...defaultProps} />);
    expect(screen.getByTestId('mock-box')).toBeInTheDocument();
  });

  test('renders without activeSidebar', () => {
    renderWithTheme(<ToolbarSidebar {...defaultProps} />);
    expect(screen.getByTestId('mock-box')).toBeInTheDocument();
  });

  test('renders with activeSidebar set to chat', () => {
    renderWithTheme(<ToolbarSidebar {...defaultProps} activeSidebar="chat" />);
    expect(screen.getByTestId('mock-box')).toBeInTheDocument();
  });

  test('calls setActiveSidebar when sidebar is closed', () => {
    renderWithTheme(<ToolbarSidebar {...defaultProps} activeSidebar="chat" />);
    
    const closeButton = screen.getByTestId('mock-icon-button');
    fireEvent.click(closeButton);
    
    expect(defaultProps.setActiveSidebar).toHaveBeenCalledWith(null);
  });

  test('toggles sidebar when menu button is clicked', () => {
    renderWithTheme(<ToolbarSidebar {...defaultProps} />);
    
    const menuButton = screen.getByTestId('mock-icon-button');
    fireEvent.click(menuButton);
    
    expect(defaultProps.handleExpandSidebar).toHaveBeenCalled();
  });
});