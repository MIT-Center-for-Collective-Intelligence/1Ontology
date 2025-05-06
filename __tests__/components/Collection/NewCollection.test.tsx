import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import NewCollection from '../../../src/components/Collection/NewCollection';

// Mock Material-UI components
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  Paper: ({ children }: any) => <div data-testid="paper">{children}</div>,
  TextField: ({ label, value, onChange }: any) => (
    <input
      data-testid="text-field"
      aria-label={label}
      value={value}
      onChange={onChange}
    />
  ),
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Box: ({ children }: any) => <div>{children}</div>
}));

describe('NewCollection Component', () => {
  const mockOnAdd = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultProps = {
    onAdd: mockOnAdd,
    onCancel: mockOnCancel
  };

  const renderWithTheme = (ui: React.ReactElement) => {
    const theme = createTheme();
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the component', () => {
    renderWithTheme(<NewCollection {...defaultProps} />);
    expect(screen.getByTestId('paper')).toBeInTheDocument();
  });

  it('updates collection name when input changes', () => {
    renderWithTheme(<NewCollection {...defaultProps} />);
    const input = screen.getByTestId('text-field');
    fireEvent.change(input, { target: { value: 'New Test Collection' } });
    expect(input).toHaveValue('New Test Collection');
  });

  it('calls onAdd when form is submitted with valid data', () => {
    renderWithTheme(<NewCollection {...defaultProps} />);
    const input = screen.getByTestId('text-field');
    fireEvent.change(input, { target: { value: 'New Test Collection' } });
    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);
    expect(mockOnAdd).toHaveBeenCalledWith('New Test Collection');
  });

  it('calls onCancel when cancel button is clicked', () => {
    renderWithTheme(<NewCollection {...defaultProps} />);
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('disables add button when collection name is empty', () => {
    renderWithTheme(<NewCollection {...defaultProps} />);
    const addButton = screen.getByText('Add');
    expect(addButton).toBeDisabled();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <NewCollection
        onAdd={() => {}}
        onCancel={() => {}}
      />
    );
    expect(container).toBeTruthy();
  });
});