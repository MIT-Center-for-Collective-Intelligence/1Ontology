import {
  signUp,
  signIn,
  sendVerificationEmail,
  resetPassword,
  logout,
  getIdToken,
  retrieveAuthenticatedUser
} from ' @components/lib/firestoreClient/auth';
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
  limit
} from 'firebase/firestore';

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn()
}));

// Mock Firestore
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn()
}));

describe('Authentication Functions', () => {
  const mockAuth = {
    currentUser: {
      getIdToken: jest.fn()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth as jest.Mock).mockReturnValue(mockAuth);
  });

  describe('signUp', () => {
    it('should create new user and update profile', async () => {
      const mockUserCredential = {
        user: { uid: 'test-uid' }
      };
      (createUserWithEmailAndPassword as jest.Mock).mockResolvedValueOnce(mockUserCredential);
      (updateProfile as jest.Mock).mockResolvedValueOnce(undefined);

      await signUp('Test User', 'test@example.com', 'password123');

      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        'password123'
      );
      expect(updateProfile).toHaveBeenCalledWith(
        mockUserCredential.user,
        { displayName: 'Test User' }
      );
    });

    it('should handle signup error', async () => {
      const mockError = new Error('Email already in use');
      (createUserWithEmailAndPassword as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(signUp('Test User', 'test@example.com', 'password123'))
        .rejects.toThrow('Email already in use');
    });
  });

  describe('signIn', () => {
    it('should sign in user and return user credential', async () => {
      const mockUser = { uid: 'test-uid', email: 'test@example.com' };
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({ user: mockUser });

      const result = await signIn('test@example.com', 'password123');

      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        'password123'
      );
      expect(result).toEqual(mockUser);
    });

    it('should handle signin error', async () => {
      const mockError = new Error('Invalid credentials');
      (signInWithEmailAndPassword as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(signIn('test@example.com', 'wrong-password'))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('sendVerificationEmail', () => {
    it('should send verification email to current user', async () => {
      await sendVerificationEmail();

      expect(sendEmailVerification).toHaveBeenCalledWith(mockAuth.currentUser);
    });

    it('should not send verification email if no current user', async () => {
      (getAuth as jest.Mock).mockReturnValueOnce({ currentUser: null });

      await sendVerificationEmail();

      expect(sendEmailVerification).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should send password reset email', async () => {
      await resetPassword('test@example.com');

      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com'
      );
    });

    it('should handle reset password error', async () => {
      const mockError = new Error('User not found');
      (sendPasswordResetEmail as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(resetPassword('test@example.com'))
        .rejects.toThrow('User not found');
    });
  });

  describe('logout', () => {
    it('should sign out user', async () => {
      await logout();

      expect(signOut).toHaveBeenCalledWith(mockAuth);
    });
  });

  describe('getIdToken', () => {
    it('should return id token for current user', async () => {
      const mockToken = 'mock-token-123';
      mockAuth.currentUser.getIdToken.mockResolvedValueOnce(mockToken);

      const token = await getIdToken();

      expect(token).toBe(mockToken);
    });

    it('should return undefined if no current user', async () => {
      (getAuth as jest.Mock).mockReturnValueOnce({ currentUser: null });

      const token = await getIdToken();

      expect(token).toBeUndefined();
    });
  });

  describe('retrieveAuthenticatedUser', () => {
    const mockUserId = 'test-uid';
    const mockClaims = {
      manageLock: true,
      copilot: true,
      admin: false
    };

    it('should retrieve user data from Firestore', async () => {
      const mockUserData = {
        imageUrl: 'test-image.jpg',
        fName: 'Test',
        lName: 'User',
        uname: 'testuser',
        email: 'test@example.com',
        rightPanel: true,
        currentNode: 'node-1',
        theme: 'Dark'
      };

      const mockQueryDocs = {
        size: 1,
        docs: [{
          data: () => mockUserData
        }]
      };

      (query as jest.Mock).mockReturnValueOnce({});
      (getDocs as jest.Mock).mockResolvedValueOnce(mockQueryDocs);

      const result = await retrieveAuthenticatedUser(mockUserId, mockClaims);

      expect(query).toHaveBeenCalledWith(
        undefined,
        where('userId', '==', mockUserId),
        limit(1)
      );

      expect(result).toEqual({
        user: {
          userId: mockUserId,
          ...mockUserData,
          manageLock: true,
          copilot: true,
          admin: false
        },
        theme: 'Dark'
      });
    });

    it('should handle case when user document not found', async () => {
      const mockQueryDocs = {
        size: 0,
        docs: []
      };

      (query as jest.Mock).mockReturnValueOnce({});
      (getDocs as jest.Mock).mockResolvedValueOnce(mockQueryDocs);

      const result = await retrieveAuthenticatedUser(mockUserId, mockClaims);

      expect(result).toEqual({
        user: null,
        theme: 'Dark'
      });
    });
  });
});