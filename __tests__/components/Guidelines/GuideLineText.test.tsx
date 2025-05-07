import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import GuideLineText from '../../../src/components/Guidelines/GuideLineText';

// Mock Material UI components
jest.mock('@mui/material', () => ({
  TextField: ({ value, label, onChange, onBlur }: any) => (
    <div data-testid="mock-textfield">
      <label>{label}</label>
      <input 
        value={value} 
        onChange={onChange} 
        onBlur={onBlur}
        role="textbox"
      />
      {value}
    </div>
  ),
}));

describe('GuideLineText Component', () => {
  const defaultProps = {
    guideline: 'This is a guideline text',
    index: 0,
    onSaveGuideline: jest.fn(),
    catId: 'cat1'
  };

  test('renders with default props', () => {
    render(<GuideLineText {...defaultProps} />);
    
    const textField = screen.getByTestId('mock-textfield');
    expect(textField).toBeInTheDocument();
    expect(textField).toHaveTextContent('This is a guideline text');
  });

  test('renders with different guideline', () => {
    render(<GuideLineText {...defaultProps} guideline="New guideline" />);
    
    const textField = screen.getByTestId('mock-textfield');
    expect(textField).toBeInTheDocument();
    expect(textField).toHaveTextContent('New guideline');
  });

  test('calls onSaveGuideline on blur', () => {
    render(<GuideLineText {...defaultProps} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.blur(input);
    expect(defaultProps.onSaveGuideline).toHaveBeenCalledWith(
      defaultProps.guideline,
      defaultProps.catId,
      defaultProps.index
    );
  });

  test('renders empty when no guideline is provided', () => {
    render(<GuideLineText {...defaultProps} guideline="" />);
    
    const textField = screen.getByTestId('mock-textfield');
    expect(textField).toBeInTheDocument();
    expect(textField.querySelector('input')).toHaveValue('');
  });
});