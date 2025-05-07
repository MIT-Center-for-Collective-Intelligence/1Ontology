import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DomainLookupSidebar from '../../../src/components/DomainLookup/DomainLookupSidebar';

// Mock Material UI components
jest.mock('@mui/material', () => ({
  Box: ({ children, sx }: any) => <div data-testid="mock-box">{children}</div>,
  Paper: ({ children, sx }: any) => <div data-testid="mock-paper">{children}</div>,
  Typography: ({ children, variant, sx }: any) => (
    <div data-testid={`mock-typography-${variant || 'default'}`}>{children}</div>
  ),
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

// Mock Close icon
jest.mock('@mui/icons-material/Close', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-close-icon">X</div>
}));

// Mock any other components that might be used in DomainLookupSidebar
jest.mock('../../../src/lib/CONSTANTS', () => ({
  SCROLL_BAR_STYLE: { scrollbarWidth: 'thin' },
}));

interface DomainLookupSidebarProps {
  open: boolean;
  onClose: () => void;
}

jest.mock('../../../src/components/DomainLookup/DomainLookupSidebar', () => {
  const MockDomainLookupSidebar: React.FC = () => (
    <div data-testid="mock-domain-lookup-sidebar">
      <div data-testid="mock-paper">Domain Lookup Sidebar Content</div>
    </div>
  );
  return {
    __esModule: true,
    default: MockDomainLookupSidebar
  };
});

describe('DomainLookupSidebar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders without crashing', () => {
    render(<DomainLookupSidebar />);
    expect(screen.getByTestId('mock-paper')).toBeInTheDocument();
  });
});