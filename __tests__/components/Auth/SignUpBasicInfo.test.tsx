import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SignUpBasicInfo, SignUpBasicInformationProps } from '../../../src/components/Auth/SignUpBasicInfo';
import { FormikProps } from 'formik';
import { SignUpFormValues } from ' @components/types/IAuth';

// Mock the AuthContext
const mockDispatch = jest.fn();
jest.mock('../../../src/components/context/AuthContext', () => ({
  useAuth: jest.fn(() => [
    {}, 
    { dispatch: mockDispatch }
  ]),
}));

describe('SignUpBasicInfo Component', () => {
  // Mock formik props
  const mockFormikProps: FormikProps<SignUpFormValues> = {
    values: {
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      password: '',
      passwordConfirmation: '',
      theme: 'Light',
      // Add other required fields from SignUpFormValues
    },
    errors: {},
    touched: {},
    handleChange: jest.fn(),
    handleBlur: jest.fn(),
    handleSubmit: jest.fn(),
    setFieldValue: jest.fn(),
    setFieldError: jest.fn(),
    setFieldTouched: jest.fn(),
    submitForm: jest.fn(),
    submitCount: 0,
    setStatus: jest.fn(),
    setErrors: jest.fn(),
    setValues: jest.fn(),
    setTouched: jest.fn(),
    setSubmitting: jest.fn(),
    isSubmitting: false,
    isValidating: false,
    status: '',
    validateForm: jest.fn().mockResolvedValue({}),
    validateField: jest.fn(),
    getFieldProps: jest.fn(),
    getFieldMeta: jest.fn(),
    getFieldHelpers: jest.fn(),
    dirty: false,
    isValid: false,
    initialValues: {
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      password: '',
      passwordConfirmation: '',
      theme: 'Light',
      // Add other required fields from SignUpFormValues
    },
    initialErrors: {},
    initialTouched: {},
    initialStatus: '',
    handleReset: jest.fn(),
    registerField: jest.fn(),
    unregisterField: jest.fn(),
    resetForm: jest.fn(),
    setFormikState: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders all form fields correctly', () => {
    render(<SignUpBasicInfo formikProps={mockFormikProps} />);
    
    // Check if all form fields are rendered
    expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Re-enter Password/i)).toBeInTheDocument();
    
    // Check if theme switch is rendered
    expect(screen.getByText(/Theme:/i)).toBeInTheDocument();
  });

  test('handles input changes correctly', () => {
    render(<SignUpBasicInfo formikProps={mockFormikProps} />);
    
    // Get form fields
    const firstNameInput = screen.getByLabelText(/First Name/i);
    const lastNameInput = screen.getByLabelText(/Last Name/i);
    const emailInput = screen.getByLabelText(/Email/i);
    
    // Simulate user input
    fireEvent.change(firstNameInput, { target: { value: 'John' } });
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
    fireEvent.change(emailInput, { target: { value: 'john.doe@example.com' } });
    
    // Check if handleChange was called for each input
    expect(mockFormikProps.handleChange).toHaveBeenCalledTimes(3);
  });

  test('displays validation errors when fields are touched', () => {
    const formikPropsWithErrors = {
      ...mockFormikProps,
      errors: {
        firstName: 'First name is required',
        email: 'Invalid email format',
      },
      touched: {
        firstName: true,
        email: true,
      },
    };
    
    render(<SignUpBasicInfo formikProps={formikPropsWithErrors} />);
    
    // Check if error messages are displayed
    expect(screen.getByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Invalid email format')).toBeInTheDocument();
  });

  test('toggles theme when theme switch is clicked', () => {
    const mockFormikPropsWithLightTheme = {
      ...mockFormikProps,
      values: {
        ...mockFormikProps.values,
        theme: 'Light' as const
      }
    };
    
    render(<SignUpBasicInfo formikProps={mockFormikPropsWithLightTheme} />);
    
    const themeSwitch = screen.getByRole('checkbox');
    fireEvent.click(themeSwitch);
    
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'setTheme',
      payload: 'Dark',
    });
  });

  test('renders with data-testid attribute', () => {
    render(<SignUpBasicInfo formikProps={mockFormikProps} />);
    
    // Check if the component has the correct data-testid
    expect(screen.getByTestId('signup-form-step-1')).toBeInTheDocument();
  });
});