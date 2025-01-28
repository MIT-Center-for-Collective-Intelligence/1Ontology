import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ForgotPage from ' @components/pages/forgot-password';
import { useAuth } from ' @components/components/context/AuthContext';
import { useSnackbar } from 'notistack';
import { sendPasswordResetEmail } from 'firebase/auth';

jest.mock(' @components/components/context/AuthContext');
jest.mock('notistack');
jest.mock('firebase/auth');

describe('ForgotPage', () => {
  const mockHandleError = jest.fn();
  const mockEnqueueSnackbar = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue([null, { handleError: mockHandleError }]);
    (useSnackbar as jest.Mock).mockReturnValue({ enqueueSnackbar: mockEnqueueSnackbar });
  });

  it('should render forgot password form', () => {
    render(<ForgotPage />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send email/i })).toBeInTheDocument();
  });

  it('should handle successful password reset request', async () => {
    (sendPasswordResetEmail as jest.Mock).mockResolvedValueOnce(undefined);
    
    render(<ForgotPage />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send email/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com'
      );
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        expect.stringContaining('sent an email'),
        expect.any(Object)
      );
    });
  });

  it('should handle password reset error', async () => {
    const mockError = new Error('User not found');
    (sendPasswordResetEmail as jest.Mock).mockRejectedValueOnce(mockError);
    
    render(<ForgotPage />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /send email/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockHandleError).toHaveBeenCalled();
    });
  });
});