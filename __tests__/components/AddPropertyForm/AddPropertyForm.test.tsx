import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AddPropertyForm from ' @components/components/AddPropertyForm/AddPropertyForm';
import '@testing-library/jest-dom';

jest.mock('@mui/material', () => ({
  Box: ({ children, sx }: any) => <div data-testid="mock-box">{children}</div>,
  Button: ({ children, onClick, disabled, variant }: any) => (
    <button 
      data-testid={`mock-button-${children.toString().toLowerCase()}`} 
      onClick={onClick} 
      disabled={disabled}
    >
      {children}
    </button>
  ),
  FormControl: ({ children, variant, sx }: any) => <div data-testid="mock-form-control">{children}</div>,
  InputLabel: ({ children, id }: any) => <label data-testid={id}>{children}</label>,
  Select: ({ labelId, value, onChange, label, sx, children }: any) => (
    <select 
      data-testid="mock-select" 
      value={value} 
      onChange={onChange}
      aria-labelledby={labelId}
    >
      {children}
    </select>
  ),
  MenuItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  TextField: ({ label, value, onChange, error, helperText, InputLabelProps }: any) => (
    <div data-testid="mock-text-field">
      <label>{label}</label>
      <input 
        data-testid="property-title-input" 
        value={value} 
        onChange={onChange}
      />
      {error && <div data-testid="error-text">{helperText}</div>}
    </div>
  ),
  Paper: ({ children, sx, elevation }: any) => <div data-testid="mock-paper">{children}</div>,
  Typography: ({ children, variant, sx }: any) => <div data-testid="mock-typography">{children}</div>,
}));

describe('AddPropertyForm Component', () => {
  const mockProps = {
    addNewProperty: jest.fn(),
    locked: false,
    setOpenAddProperty: jest.fn(),
    exitingProperties: ['Existing Property'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders form elements correctly', () => {
    render(<AddPropertyForm {...mockProps} />);
    
    expect(screen.getByTestId('mock-typography')).toHaveTextContent('Add New Property');
    expect(screen.getByTestId('property-type-label')).toHaveTextContent('Type');
    expect(screen.getByTestId('mock-select')).toBeInTheDocument();
    expect(screen.getByTestId('property-title-input')).toBeInTheDocument();
    expect(screen.getByTestId('mock-button-add')).toBeInTheDocument();
    expect(screen.getByTestId('mock-button-cancel')).toBeInTheDocument();
  });

  test('initializes with default values', () => {
    render(<AddPropertyForm {...mockProps} />);
    
    expect(screen.getByTestId('mock-select')).toHaveValue('String');
    expect(screen.getByTestId('property-title-input')).toHaveValue('');
  });

  test('updates property type on selection change', () => {
    render(<AddPropertyForm {...mockProps} />);
    
    const select = screen.getByTestId('mock-select');
    fireEvent.change(select, { target: { value: 'Activity' } });
    
    expect(select).toHaveValue('Activity');
  });

  test('updates property title on input change', () => {
    render(<AddPropertyForm {...mockProps} />);
    
    const input = screen.getByTestId('property-title-input');
    fireEvent.change(input, { target: { value: 'New Property' } });
    
    expect(input).toHaveValue('New Property');
  });

  test('validates input - shows error for special characters', () => {
    render(<AddPropertyForm {...mockProps} />);
    
    const input = screen.getByTestId('property-title-input');
    fireEvent.change(input, { target: { value: 'Invalid@Property!' } });
    
    expect(screen.getByTestId('error-text')).toHaveTextContent('Max 30 characters, no special characters allowed.');
  });

  test('validates input - shows error for length > 30 characters', () => {
    render(<AddPropertyForm {...mockProps} />);
    
    const input = screen.getByTestId('property-title-input');
    fireEvent.change(input, { target: { value: 'This is a very long property title that exceeds the maximum length limit' } });
    
    expect(screen.getByTestId('error-text')).toHaveTextContent('Max 30 characters, no special characters allowed.');
  });

  test('validates input - detects duplicate property', () => {
    render(<AddPropertyForm {...mockProps} />);
    
    const input = screen.getByTestId('property-title-input');
    fireEvent.change(input, { target: { value: 'Existing Property' } });
    
    const addButton = screen.getByTestId('mock-button-add');
    fireEvent.click(addButton);
    
    expect(screen.getByTestId('error-text')).toHaveTextContent('This property already exists.');
  });

  test('detects duplicate property case-insensitive and ignoring spaces', () => {
    render(<AddPropertyForm {...mockProps} />);
    
    const input = screen.getByTestId('property-title-input');
    fireEvent.change(input, { target: { value: 'existing  property' } });
    
    const addButton = screen.getByTestId('mock-button-add');
    fireEvent.click(addButton);
    
    expect(screen.getByTestId('error-text')).toHaveTextContent('This property already exists.');
  });

  test('disables add button when input has errors', () => {
    render(<AddPropertyForm {...mockProps} />);
    
    const input = screen.getByTestId('property-title-input');
    fireEvent.change(input, { target: { value: 'Invalid@Property!' } });
    
    const addButton = screen.getByTestId('mock-button-add');
    expect(addButton).toBeDisabled();
  });

  test('disables add button when property title is empty', () => {
    render(<AddPropertyForm {...mockProps} />);
    
    const addButton = screen.getByTestId('mock-button-add');
    expect(addButton).toBeDisabled();
  });

  test('disables add button when form is locked', () => {
    render(<AddPropertyForm {...mockProps} locked={true} />);
    
    const input = screen.getByTestId('property-title-input');
    fireEvent.change(input, { target: { value: 'Valid Property' } });
    
    const addButton = screen.getByTestId('mock-button-add');
    expect(addButton).toBeDisabled();
  });

  test('adds new property when form is valid and add button is clicked', () => {
    render(<AddPropertyForm {...mockProps} />);
    
    const select = screen.getByTestId('mock-select');
    fireEvent.change(select, { target: { value: 'Activity' } });
    
    const input = screen.getByTestId('property-title-input');
    fireEvent.change(input, { target: { value: 'Valid Property' } });
    
    const addButton = screen.getByTestId('mock-button-add');
    fireEvent.click(addButton);
    
    expect(mockProps.addNewProperty).toHaveBeenCalledWith('Valid Property', 'Activity');
    expect(input).toHaveValue('');
    expect(select).toHaveValue('String');
  });

  test('closes form when cancel button is clicked', () => {
    render(<AddPropertyForm {...mockProps} />);
    
    const input = screen.getByTestId('property-title-input');
    fireEvent.change(input, { target: { value: 'Some Input' } });
    
    const cancelButton = screen.getByTestId('mock-button-cancel');
    fireEvent.click(cancelButton);
    
    expect(mockProps.setOpenAddProperty).toHaveBeenCalledWith(false);
    expect(input).toHaveValue('');
  });
});