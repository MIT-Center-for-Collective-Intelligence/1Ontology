import { renderHook, act } from '@testing-library/react-hooks';
import { useUsers } from '../../../src/hooks/useUsers';

let usersCache: { [key: string]: any } | null = null;

// Mock Firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  onSnapshot: jest.fn(),
  getDocs: jest.fn(),
  getFirestore: jest.fn(() => ({})),
}));

describe('useUsers Hook', () => {
  const mockUsers = {
    user1: {
      userId: 'user1',
      imageUrl: '',
      fName: 'User',
      lName: '1',
      uname: 'user1',
      email: 'user1@example.com',
      claims: {},
      rightPanel: false,
      currentNode: '',
      manageLock: false,
      copilot: false,
      admin: false
    },
    user2: {
      userId: 'user2',
      imageUrl: '',
      fName: 'User',
      lName: '2',
      uname: 'user2',
      email: 'user2@example.com',
      claims: {},
      rightPanel: false,
      currentNode: '',
      manageLock: false,
      copilot: false,
      admin: false
    }
  };
  
  const mockSnapshot = {
    forEach: (callback: (doc: any) => void) => {
      Object.entries(mockUsers).forEach(([id, user]) => {
        callback({
          id,
          data: () => user
        });
      });
    }
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    usersCache = null; // Reset cache before each test
    
    // Setup mock implementation for getDocs
    require('firebase/firestore').getDocs.mockResolvedValue(mockSnapshot);
  });

  it('should fetch users on mount', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useUsers());
    
    await waitForNextUpdate();
    
    expect(result.current.usersData).toEqual(mockUsers);
    expect(result.current.isLoading).toBe(false);
  });
});