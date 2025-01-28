import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignInPage from ' @components/pages/signin';
import { useAuth } from ' @components/components/context/AuthContext';
import { signIn } from ' @components/lib/firestoreClient/auth';
import { useSnackbar } from 'notistack';
import { useRouter } from 'next/router';

jest.mock(' @components/components/context/AuthContext');
jest.mock(' @components/lib/firestoreClient/auth');
jest.mock('notistack');
jest.mock('next/router');

describe('SignInPage', () => {
  const mockHandleError = jest.fn();
  const mockEnqueueSnackbar = jest.fn();
  const mockCloseSnackbar = jest.fn();
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue([null, { handleError: mockHandleError }]);
    (useSnackbar as jest.Mock).mockReturnValue({ 
      enqueueSnackbar: mockEnqueueSnackbar,
      closeSnackbar: mockCloseSnackbar 
    });
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  it('should render signin form', () => {
    render(<SignInPage />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('should handle successful login with verified email', async () => {
    const mockUser = { emailVerified: true };
    (signIn as jest.Mock).mockResolvedValueOnce(mockUser);

    render(<SignInPage />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockPush).toHaveBeenCalledWith('/editor');
    });
  });

  it('should show error for unverified email', async () => {
    const mockUser = { emailVerified: false };
    (signIn as jest.Mock).mockResolvedValueOnce(mockUser);

    render(<SignInPage />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        'Please verify your email first.',
        expect.any(Object)
      );
    });
  });
});