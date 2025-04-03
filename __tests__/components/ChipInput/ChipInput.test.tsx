import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChipInput from '../../../src/components/ChipInput/ChipInput';
import '@testing-library/jest-dom';


jest.mock('@mui/styles', () => ({
  makeStyles: () => () => ({
    inputChip: {},
    innerChip: {}
  })
}));


jest.mock('@mui/material/Chip', () => ({ 
  __esModule: true,
  default: (props: any) => <div data-testid="mock-chip" onClick={props.onDelete}>{props.label}</div>
}));

jest.mock('@mui/material/TextField', () => ({
  __esModule: true,
  default: (props: any) => {
    const inputId = "mock-input-field";
    return (
      <div>
        {props.label && <label htmlFor={inputId}>{props.label}</label>}
        <input
          id={inputId}
          data-testid="mock-input"
          placeholder={props.InputProps?.placeholder || props.placeholder}
          disabled={props.disabled}
          onKeyDown={props.InputProps?.onKeyDown}
          onChange={props.InputProps?.onChange}
          aria-label={props.label}
          {...props}
        />
        {props.InputProps?.startAdornment}
      </div>
    );
  }
}));

describe('ChipInput Component', () => {
  const mockSelectedTags = jest.fn();
  const mockUpdateTags = jest.fn();
  
  const defaultProps = {
    tags: ['React', 'TypeScript'],
    selectedTags: mockSelectedTags,
    updateTags: mockUpdateTags,
    placeholder: 'Add tags',
  };
  
  beforeEach(() => {
    mockSelectedTags.mockClear();
    mockUpdateTags.mockClear();
  });
  
  test('renders existing tags correctly', () => {
    render(<ChipInput {...defaultProps} />);
    
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByTestId('mock-input')).toHaveAttribute('placeholder', 'Add tags');
  });
  
  test('adds a new tag when pressing Enter', () => {
    render(<ChipInput {...defaultProps} />);
    
    const input = screen.getByTestId('mock-input');
    fireEvent.change(input, { target: { value: 'JavaScript' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockUpdateTags).toHaveBeenCalledWith(
      ['React', 'TypeScript', 'JavaScript'],
      ['JavaScript'],
      []
    );
    expect(mockSelectedTags).toHaveBeenCalledWith(
      ['React', 'TypeScript', 'JavaScript'],
      undefined
    );
  });
  
  test('adds multiple tags when comma-separated values are entered', () => {
    render(<ChipInput {...defaultProps} />);
    
    const input = screen.getByTestId('mock-input');
    fireEvent.change(input, { target: { value: 'JavaScript, CSS, HTML' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockUpdateTags).toHaveBeenCalledWith(
      ['React', 'TypeScript', 'JavaScript', 'CSS', 'HTML'],
      ['JavaScript', 'CSS', 'HTML'],
      []
    );
  });
  
  test('does not add empty tags', () => {
    render(<ChipInput {...defaultProps} />);
    
    const input = screen.getByTestId('mock-input');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockUpdateTags).not.toHaveBeenCalled();
    expect(mockSelectedTags).not.toHaveBeenCalled();
  });
  
  test('does not add duplicate tags', () => {
    render(<ChipInput {...defaultProps} />);
    
    const input = screen.getByTestId('mock-input');
    fireEvent.change(input, { target: { value: 'React' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockUpdateTags).not.toHaveBeenCalled();
    expect(mockSelectedTags).not.toHaveBeenCalled();
  });
  
  test('removes a tag when delete button is clicked', () => {
    render(<ChipInput {...defaultProps} />);
    
    const chips = screen.getAllByTestId('mock-chip');
    fireEvent.click(chips[0]); 
    
    expect(mockUpdateTags).toHaveBeenCalledWith(
      ['TypeScript'],
      [],
      ['React']
    );
    expect(mockSelectedTags).toHaveBeenCalledWith(
      ['TypeScript'],
      undefined
    );
  });
  
  test('removes last tag when Backspace is pressed on empty input', () => {
    render(<ChipInput {...defaultProps} />);
    
    const input = screen.getByTestId('mock-input');
    fireEvent.keyDown(input, { key: 'Backspace' });
    
    expect(mockUpdateTags).toHaveBeenCalledWith(
      ['React'],
      [],
      ['TypeScript']
    );
    expect(mockSelectedTags).toHaveBeenCalledWith(
      ['React'],
      undefined
    );
  });
  
  test('does not remove tag with Backspace if input has value', () => {
    render(<ChipInput {...defaultProps} />);
    
    const input = screen.getByTestId('mock-input');
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.keyDown(input, { key: 'Backspace' });
    
    expect(mockUpdateTags).not.toHaveBeenCalled();
    expect(mockSelectedTags).not.toHaveBeenCalled();
  });
  
  test('renders in read-only mode correctly', () => {
    render(<ChipInput {...defaultProps} readOnly={true} />);
    
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    
    const input = screen.getByTestId('mock-input');
    expect(input).toHaveAttribute('disabled', '');
  });
  
  test('handles itemId correctly', () => {
    render(<ChipInput {...defaultProps} itemId="test-id" />);
    
    const input = screen.getByTestId('mock-input');
    fireEvent.change(input, { target: { value: 'JavaScript' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockSelectedTags).toHaveBeenCalledWith(
      ['React', 'TypeScript', 'JavaScript'],
      'test-id'
    );
  });
  
  test('renders with custom label', () => {
    render(<ChipInput {...defaultProps} label="Custom Label" />);
    
    
    expect(screen.getByText('Custom Label')).toBeInTheDocument();
  });
  
  test('accepts custom props', () => {
    render(
      <ChipInput 
        {...defaultProps} 
        data-testid="custom-chip-input"
      />
    );
    
    
    expect(screen.getByTestId('custom-chip-input')).toBeInTheDocument();
  });
});