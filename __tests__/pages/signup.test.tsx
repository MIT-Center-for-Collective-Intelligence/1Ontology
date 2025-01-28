import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignUpPage from ' @components/pages/signup';
import { useAuth } from ' @components/components/context/AuthContext';
import { useSnackbar } from 'notistack';
import { useMutation } from 'react-query';

jest.mock(' @components/components/context/AuthContext');
jest.mock('notistack');
jest.mock('react-query');

jest.mock('next/router', () => ({
  useRouter() {
    return {
      pathname: '',
    };
  },
}));

describe('SignUpPage', () => {
  const mockHandleError = jest.fn();
  const mockEnqueueSnackbar = jest.fn();
  const mockMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue([null, { handleError: mockHandleError }]);
    (useSnackbar as jest.Mock).mockReturnValue({ enqueueSnackbar: mockEnqueueSnackbar });
    (useMutation as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isLoading: false
    });
  });

  it('should render signup form with all fields', () => {
    render(<SignUpPage />);
    
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    render(<SignUpPage />);
    
    const submitButton = screen.getByRole('button', { name: /sign up/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/first name.*required/i)).toBeInTheDocument();
      expect(screen.getByText(/last name.*required/i)).toBeInTheDocument();
      expect(screen.getByText(/username.*required/i)).toBeInTheDocument();
      expect(screen.getByText(/password.*required/i)).toBeInTheDocument();
    });
  });

  it('should validate password confirmation match', async () => {
    render(<SignUpPage />);
    
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);

    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmInput, { target: { value: 'different' } });
    fireEvent.blur(confirmInput);

    await waitFor(() => {
      expect(screen.getByText(/password must match/i)).toBeInTheDocument();
    });
  });
});