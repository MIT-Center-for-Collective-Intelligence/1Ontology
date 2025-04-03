import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignUpBasicInfo, SignUpBasicInformationProps } from ' @components/components/Auth/SignUpBasicInfo';
import '@testing-library/jest-dom';
import { Formik } from 'formik';
import { SignUpFormValues } from ' @components/types/IAuth';

jest.mock('react', () => {
  const originalReact = jest.requireActual('react');
  return {
    ...originalReact,
    lazy: jest.fn(),
    Suspense: ({ children }: any) => <div data-testid="mock-suspense">{children}</div>,
  };
});

jest.mock('@mui/material', () => ({
  Backdrop: () => <div>Backdrop</div>,
  Box: ({ children, 'data-testid': dataTestId }: any) => (
    <div data-testid={dataTestId || 'mock-box'}>{children}</div>
  ),
  Checkbox: (props: any) => (
    <input
      type="checkbox"
      data-testid={`mock-checkbox-${props.name || 'default'}`}
      checked={props.checked}
      onChange={props.onChange}
    />
  ),
  CircularProgress: () => <div>CircularProgress</div>,
  FormControlLabel: ({ control, label }: any) => (
    <label data-testid="mock-form-control-label">
      {control}
      <span>{label}</span>
    </label>
  ),
  FormGroup: ({ children }: any) => <div data-testid="mock-form-group">{children}</div>,
  FormHelperText: ({ children }: any) => <div data-testid="mock-form-helper-text">{children}</div>,
  Link: ({ children, onClick }: any) => (
    <a href="#" data-testid="mock-link" onClick={onClick}>
      {children}
    </a>
  ),
  Switch: ({ checked, onChange }: any) => (
    <input
      type="checkbox"
      data-testid="mock-theme-switch"
      checked={checked}
      onChange={onChange}
    />
  ),
  TextField: ({ id, name, label, value, onChange, onBlur, error, helperText }: any) => (
    <div data-testid={`mock-text-field-${name}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        data-testid={`input-${name}`}
      />
      {error && <div data-testid={`error-${name}`}>{helperText}</div>}
    </div>
  ),
  Typography: ({ children }: any) => <div data-testid="mock-typography">{children}</div>,
}));

jest.mock(' @components/components/context/AuthContext', () => ({
  useAuth: jest.fn(() => [
    {},
    { dispatch: jest.fn() },
  ]),
}));

jest.mock(' @components/lib/utils/utils', () => ({
  ToUpperCaseEveryWord: jest.fn((text) => text.toUpperCase()),
}));

describe('SignUpBasicInfo Component', () => {
  const initialValues = {
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    passwordConfirmation: '',
    theme: 'Light',
    agreeToTerms: false,
  };

  const mockFormikProps = {
    values: initialValues,
    errors: {},
    touched: {},
    handleChange: jest.fn(),
    handleBlur: jest.fn(),
    setFieldValue: jest.fn(),
    handleSubmit: jest.fn(),
    isSubmitting: false,
    isValid: true,
    dirty: false,
    validateForm: jest.fn(),
    setTouched: jest.fn(),
    setErrors: jest.fn(),
    setValues: jest.fn(),
    setSubmitting: jest.fn(),
    validateField: jest.fn(),
    setFieldError: jest.fn(),
    setFieldTouched: jest.fn(),
    setStatus: jest.fn(),
    setFormikState: jest.fn(),
    status: {},
    submitForm: jest.fn(),
    submitCount: 0,
    resetForm: jest.fn(),
  } as unknown as SignUpBasicInformationProps;

  const renderComponent = (formikProps = mockFormikProps) => {
    return render(
      <SignUpBasicInfo formikProps={formikProps} />
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders all form fields', () => {
    renderComponent();
    
    expect(screen.getByTestId('signup-form-step-1')).toBeInTheDocument();
    expect(screen.getByTestId('mock-text-field-firstName')).toBeInTheDocument();
    expect(screen.getByTestId('mock-text-field-lastName')).toBeInTheDocument();
    expect(screen.getByTestId('mock-text-field-email')).toBeInTheDocument();
    expect(screen.getByTestId('mock-text-field-username')).toBeInTheDocument();
    expect(screen.getByTestId('mock-text-field-password')).toBeInTheDocument();
    expect(screen.getByTestId('mock-text-field-passwordConfirmation')).toBeInTheDocument();
    expect(screen.getByTestId('mock-form-group')).toBeInTheDocument();
    expect(screen.getByTestId('mock-theme-switch')).toBeInTheDocument();
    expect(screen.getByText('Theme: 🌞')).toBeInTheDocument();
  });

  test('displays field values from formik', () => {
    const values = {
      ...initialValues,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      username: 'johndoe',
      password: 'password123',
      passwordConfirmation: 'password123',
    };
    
    renderComponent({
      ...mockFormikProps,
      values,
    });
    
    expect(screen.getByTestId('input-firstName')).toHaveValue('John');
    expect(screen.getByTestId('input-lastName')).toHaveValue('Doe');
    expect(screen.getByTestId('input-email')).toHaveValue('john.doe@example.com');
    expect(screen.getByTestId('input-username')).toHaveValue('johndoe');
    expect(screen.getByTestId('input-password')).toHaveValue('password123');
    expect(screen.getByTestId('input-passwordConfirmation')).toHaveValue('password123');
  });

  test('displays validation errors when fields are touched', () => {
    const errors = {
      firstName: 'First name is required',
      lastName: 'Last name is required',
      email: 'Invalid email',
      username: 'Username must be at least 3 characters',
      password: 'Password must be at least 8 characters',
      passwordConfirmation: 'Passwords do not match',
    };
    
    const touched = {
      firstName: true,
      lastName: true,
      email: true,
      username: true,
      password: true,
      passwordConfirmation: true,
    };
    
    renderComponent({
      ...mockFormikProps,
      errors,
      touched,
    });
    
    expect(screen.getByTestId('error-firstName')).toHaveTextContent('First name is required');
    expect(screen.getByTestId('error-lastName')).toHaveTextContent('Last name is required');
    expect(screen.getByTestId('error-email')).toHaveTextContent('Invalid email');
    expect(screen.getByTestId('error-username')).toHaveTextContent('Username must be at least 3 characters');
    expect(screen.getByTestId('error-password')).toHaveTextContent('Password must be at least 8 characters');
    expect(screen.getByTestId('error-passwordConfirmation')).toHaveTextContent('Passwords do not match');
  });

  test('does not display errors when fields are not touched', () => {
    const errors = {
      firstName: 'First name is required',
    };
    
    const touched = {
      firstName: false,
    };
    
    renderComponent({
      ...mockFormikProps,
      errors,
      touched,
    });
    
    expect(screen.queryByTestId('error-firstName')).not.toBeInTheDocument();
  });

  test('calls handleChange when input values change', () => {
    renderComponent();
    
    const firstNameInput = screen.getByTestId('input-firstName');
    fireEvent.change(firstNameInput, { target: { value: 'Jane' } });
    
    expect(mockFormikProps.handleChange).toHaveBeenCalled();
  });

  test('calls handleBlur when input loses focus', () => {
    renderComponent();
    
    const firstNameInput = screen.getByTestId('input-firstName');
    fireEvent.blur(firstNameInput);
    
    expect(mockFormikProps.handleBlur).toHaveBeenCalled();
  });

  test('toggles theme when switch is clicked', () => {
    const { useAuth } = require(' @components/components/context/AuthContext');
    const dispatchMock = jest.fn();
    useAuth.mockReturnValue([{}, { dispatch: dispatchMock }]);
    
    renderComponent();
    
    const themeSwitch = screen.getByTestId('mock-theme-switch');
    fireEvent.click(themeSwitch);
    
    expect(mockFormikProps.setFieldValue).toHaveBeenCalledWith('theme', 'Dark');
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'setTheme',
      payload: 'Dark',
    });
    
    // Render with Dark theme
    renderComponent({
      ...mockFormikProps,
      values: {
        ...initialValues,
        theme: 'Dark',
      },
    });
    
    expect(screen.getByText('Theme: 🌜')).toBeInTheDocument();
  });

  test('renders suspense for lazy-loaded modals', () => {
    renderComponent();
    
    expect(screen.getByTestId('mock-suspense')).toBeInTheDocument();
  });

  test('integrates with real Formik', () => {
    render(
      <Formik
        initialValues={initialValues}
        onSubmit={jest.fn()}
      >
        {(formikProps) => <SignUpBasicInfo formikProps={formikProps} />}
      </Formik>
    );
    
    expect(screen.getByTestId('signup-form-step-1')).toBeInTheDocument();
  });
});