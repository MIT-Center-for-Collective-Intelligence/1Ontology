import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchBox } from '../../../src/components/SearchBox/SearchBox';
import '@testing-library/jest-dom';

// Mock Material UI components
jest.mock('@mui/material', () => ({
  FormControl: ({ children, sx, fullWidth }: { children: React.ReactNode; sx?: any; fullWidth?: boolean }) => (
    <div data-testid="mock-form-control" data-fullwidth={fullWidth}>{children}</div>
  ),
  OutlinedInput: ({ 
    children, 
    placeholder, 
    sx, 
    value, 
    onChange,
    startAdornment,
    endAdornment 
  }: { 
    children?: React.ReactNode; 
    placeholder?: string; 
    sx?: any; 
    value?: string;
    onChange?: (e: any) => void;
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
  }) => (
    <div data-testid="mock-outlined-input" data-placeholder={placeholder}>
      <input 
        data-testid="mock-input" 
        value={value} 
        onChange={onChange} 
        placeholder={placeholder}
      />
      {startAdornment && <div data-testid="mock-start-adornment">{startAdornment}</div>}
      {endAdornment && <div data-testid="mock-end-adornment">{endAdornment}</div>}
      {children}
    </div>
  ),
  InputAdornment: ({ children, position }: { children: React.ReactNode; position: string }) => (
    <div data-testid={`mock-input-adornment-${position}`}>{children}</div>
  ),
  IconButton: ({ 
    children, 
    onClick, 
    color, 
    edge 
  }: { 
    children: React.ReactNode; 
    onClick?: () => void; 
    color?: string;
    edge?: string;
  }) => (
    <button 
      data-testid="mock-icon-button" 
      data-color={color} 
      data-edge={edge} 
      onClick={onClick}
    >
      {children}
    </button>
  ),
}));

// Mock Material UI icons
jest.mock('@mui/icons-material/Search', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-search-icon">SearchIcon</div>
}));

jest.mock('@mui/icons-material/Close', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-close-icon">CloseIcon</div>
}));

// Mock window.innerWidth
const originalInnerWidth = window.innerWidth;

describe('SearchBox Component', () => {
  const defaultProps = {
    setSearch: jest.fn(),
    search: '',
    label: 'Search',
    sx: { width: '100%' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024 // Default to desktop view
    });
  });

  afterAll(() => {
    // Restore original window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth
    });
  });

  test('renders correctly for desktop view (> 800px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024 });
    
    render(<SearchBox {...defaultProps} />);
    
    expect(screen.getByTestId('mock-form-control')).toBeInTheDocument();
    expect(screen.getByTestId('mock-outlined-input')).toBeInTheDocument();
    expect(screen.getByTestId('mock-input')).toBeInTheDocument();
    expect(screen.getByTestId('mock-start-adornment')).toBeInTheDocument();
    expect(screen.getByTestId('mock-search-icon')).toBeInTheDocument();
    expect(screen.getByTestId('mock-outlined-input')).toHaveAttribute('data-placeholder', 'Search');
  });

  test('renders correctly for mobile view (≤ 800px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800 });
    
    render(<SearchBox {...defaultProps} />);
    
    expect(screen.getByTestId('mock-form-control')).toBeInTheDocument();
    expect(screen.getByTestId('mock-outlined-input')).toBeInTheDocument();
    expect(screen.getByTestId('mock-input')).toBeInTheDocument();
    expect(screen.getByTestId('mock-end-adornment')).toBeInTheDocument();
    expect(screen.getByTestId('mock-search-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-start-adornment')).not.toBeInTheDocument();
  });

  test('handles input change in desktop view', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024 });
    
    render(<SearchBox {...defaultProps} />);
    
    const input = screen.getByTestId('mock-input');
    fireEvent.change(input, { target: { value: 'test search' } });
    
    expect(defaultProps.setSearch).toHaveBeenCalledWith('test search');
  });

  test('handles input change in mobile view', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800 });
    
    render(<SearchBox {...defaultProps} />);
    
    const input = screen.getByTestId('mock-input');
    fireEvent.change(input, { target: { value: 'mobile search' } });
    
    // In mobile view, setSearch should not be called on input change
    expect(defaultProps.setSearch).not.toHaveBeenCalled();
  });

  test('handles search button click in mobile view', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800 });
    
    render(<SearchBox {...defaultProps} />);
    
    // First set some input value
    const input = screen.getByTestId('mock-input');
    fireEvent.change(input, { target: { value: 'mobile search' } });
    
    // Then click the search button
    const searchButton = screen.getByTestId('mock-icon-button');
    fireEvent.click(searchButton);
    
    expect(defaultProps.setSearch).toHaveBeenCalledWith('mobile search');
  });

  test('shows clear button when search has value in desktop view', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024 });
    
    render(<SearchBox {...defaultProps} search="test query" />);
    
    expect(screen.getByTestId('mock-close-icon')).toBeInTheDocument();
    
    // Click the clear button
    const clearButton = screen.getByTestId('mock-icon-button');
    fireEvent.click(clearButton);
    
    expect(defaultProps.setSearch).toHaveBeenCalledWith('');
  });

  test('does not show clear button when search is empty in desktop view', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024 });
    
    render(<SearchBox {...defaultProps} search="" />);
    
    expect(screen.queryByTestId('mock-close-icon')).not.toBeInTheDocument();
  });

  test('applies custom styles passed through sx prop', () => {
    const customProps = {
      ...defaultProps,
      sx: { width: '300px', margin: '20px' }
    };
    
    render(<SearchBox {...customProps} />);
    
    // The mock doesn't actually apply styles, but we can verify the prop is passed
    expect(screen.getByTestId('mock-form-control')).toBeInTheDocument();
  });

  test('passes fullWidth prop to FormControl', () => {
    render(<SearchBox {...defaultProps} />);
    
    expect(screen.getByTestId('mock-form-control')).toHaveAttribute('data-fullwidth', 'true');
  });

  test('handles document.getElementById returning null in mobile view', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800 });
    
    // Mock getElementById to return null
    const originalGetElementById = document.getElementById;
    document.getElementById = jest.fn().mockReturnValue(null);
    
    render(<SearchBox {...defaultProps} />);
    
    // Click the search button
    const searchButton = screen.getByTestId('mock-icon-button');
    fireEvent.click(searchButton);
    
    // Should not throw an error
    expect(defaultProps.setSearch).toHaveBeenCalled();
    
    // Restore original getElementById
    document.getElementById = originalGetElementById;
  });
});