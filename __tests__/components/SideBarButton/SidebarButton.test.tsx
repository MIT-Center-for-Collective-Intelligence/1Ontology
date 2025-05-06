import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SidebarButton } from '../../../src/components/SideBarButton/SidebarButton';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Mock Material UI styles
jest.mock('@mui/material/styles', () => ({
  ThemeProvider: ({ children }: any) => <>{children}</>,
  createTheme: () => ({
    palette: {
      mode: 'light',
    },
  }),
}));

// Mock Material UI components
jest.mock('@mui/material', () => ({
  Button: ({ children, onClick, id, sx }: any) => (
    <button 
      data-testid="mock-button" 
      onClick={onClick}
      id={id}
    >
      {children}
    </button>
  ),
  Typography: ({ children, className, sx }: any) => (
    <div data-testid="mock-typography" className={className}>
      {children}
    </div>
  ),
  useTheme: () => ({
    palette: {
      mode: 'light',
    }
  }),
}));

// Mock Box from MUI system
jest.mock('@mui/system', () => ({
  Box: ({ children, sx }: any) => (
    <div data-testid="mock-box">
      {children}
    </div>
  ),
  getContrastRatio: () => 1,
  lighten: () => '#ffffff',
  darken: () => '#000000',
  alpha: () => '#ffffff',
}));

// Mock Next Image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => (
    <img 
      data-testid="mock-next-image" 
      src={props.src} 
      alt={props.alt} 
      width={props.width} 
      height={props.height}
    />
  ),
}));

// Mock constants
jest.mock('../../../src/lib/theme/colors', () => ({
  DESIGN_SYSTEM_COLORS: {
    gray200: '#EAECF0',
  },
}));

describe('SidebarButton Component', () => {
  const mockIcon = <div data-testid="mock-icon">Icon</div>;
  const mockRightOption = <div data-testid="mock-right-option">Right Option</div>;
  const mockRightFloatingOption = <div data-testid="mock-right-floating-option">Right Floating Option</div>;
  
  const defaultProps = {
    id: 'test-button',
    onClick: jest.fn(),
    icon: mockIcon,
    text: 'Test Button',
    toolbarIsOpen: false,
  };

  const renderWithTheme = (ui: React.ReactElement) => {
    const theme = createTheme();
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders without crashing', () => {
    renderWithTheme(<SidebarButton {...defaultProps} />);
    expect(screen.getByTestId('mock-button')).toBeInTheDocument();
  });

  test('renders icon correctly', () => {
    renderWithTheme(<SidebarButton {...defaultProps} />);
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
  });

  test('does not render text when toolbar is closed', () => {
    renderWithTheme(<SidebarButton {...defaultProps} />);
    expect(screen.queryByTestId('mock-typography')).not.toBeInTheDocument();
  });

  test('renders text when toolbar is open', () => {
    renderWithTheme(<SidebarButton {...defaultProps} toolbarIsOpen={true} />);
    expect(screen.getByTestId('mock-typography')).toBeInTheDocument();
    expect(screen.getByTestId('mock-typography')).toHaveTextContent('Test Button');
  });

  test('calls onClick handler when button is clicked', () => {
    renderWithTheme(<SidebarButton {...defaultProps} />);
    
    const button = screen.getByTestId('mock-button');
    fireEvent.click(button);
    
    expect(defaultProps.onClick).toHaveBeenCalled();
  });

  test('renders with fill variant correctly', () => {
    renderWithTheme(<SidebarButton {...defaultProps} variant="fill" />);
    expect(screen.getByTestId('mock-button')).toBeInTheDocument();
  });

  test('renders right option when toolbar is open', () => {
    renderWithTheme(
      <SidebarButton 
        {...defaultProps} 
        toolbarIsOpen={true} 
        rightOption={mockRightOption} 
      />
    );
    
    expect(screen.getByTestId('mock-right-option')).toBeInTheDocument();
  });

  test('does not render right option when toolbar is closed', () => {
    renderWithTheme(
      <SidebarButton 
        {...defaultProps} 
        toolbarIsOpen={false} 
        rightOption={mockRightOption} 
      />
    );
    
    expect(screen.queryByTestId('mock-right-option')).not.toBeInTheDocument();
  });

  test('renders right floating option when toolbar is closed', () => {
    renderWithTheme(
      <SidebarButton 
        {...defaultProps} 
        toolbarIsOpen={false} 
        rightFloatingOption={mockRightFloatingOption} 
      />
    );
    
    expect(screen.getByTestId('mock-right-floating-option')).toBeInTheDocument();
  });

  test('does not render right floating option when toolbar is open', () => {
    renderWithTheme(
      <SidebarButton 
        {...defaultProps} 
        toolbarIsOpen={true} 
        rightFloatingOption={mockRightFloatingOption} 
      />
    );
    
    expect(screen.queryByTestId('mock-right-floating-option')).not.toBeInTheDocument();
  });
});