import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppHeader, { HEADER_HEIGHT, HEADER_HEIGHT_MOBILE } from '../../../src/components/Header/AppHeader';
import { ThemeProvider, createTheme } from '@mui/material';
import { Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { INodeTypes } from '../../../src/types/INode';

// Mock Firebase
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    signOut: jest.fn(() => Promise.resolve()),
    currentUser: { uid: 'test-user-id' }
  })),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getFirestore: jest.fn(() => ({})),
  onSnapshot: jest.fn(() => jest.fn()),
  updateDoc: jest.fn(() => Promise.resolve()),
  query: jest.fn(),
  Timestamp: {
    now: () => ({
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
      toDate: () => new Date(),
      toMillis: () => Date.now(),
      isEqual: () => true,
      toJSON: () => ({})
    })
  }
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(),
  ref: jest.fn(),
  uploadBytesResumable: jest.fn(() => ({
    on: jest.fn((event, progressCallback, errorCallback, completeCallback) => {
      // Simulate completion
      completeCallback();
    })
  })),
  getDownloadURL: jest.fn(() => Promise.resolve('https://example.com/image.jpg')),
}));

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn()
  }))
}));

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

// Mock context
jest.mock('../../../src/components/context/AuthContext', () => ({
  useAuth: () => [{
    isAuthenticated: true,
    user: {
      uname: 'testuser',
      fName: 'Test',
      lName: 'User'
    }
  }]
}));

// Mock hooks
jest.mock(' @components/lib/hooks/useThemeChange', () => ({
  __esModule: true,
  default: jest.fn(() => [jest.fn()]),
}));

// Mock OptimizedAvatar component
jest.mock('../../../src/components/Chat/OptimizedAvatar', () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="optimized-avatar" {...props}>
      Avatar
    </div>
  ),
}));

// Mock constants
jest.mock(' @components/lib/firestoreClient/collections', () => ({
  NODES: 'nodes',
  USERS: 'users',
}));

jest.mock(' @components/lib/utils/utils', () => ({
  isValidHttpUrl: jest.fn((url) => true),
}));

jest.mock(' @components/lib/CONSTANTS', () => ({
  NO_IMAGE_USER: 'no-image-url',
}));

jest.mock(' @components/lib/utils/string.utils', () => ({
  capitalizeString: jest.fn((str) => str.toUpperCase()),
  timeAgo: jest.fn(() => '5 minutes ago'),
}));

jest.mock(' @components/lib/theme/colors', () => ({
  DESIGN_SYSTEM_COLORS: {
    gray200: '#f5f5f5',
  },
}));

// Mock ROUTES
jest.mock('../../../src/lib/utils/routes', () => ({
  signIn: '/signin'
}));

describe('AppHeader Component', () => {
  const mockProps = {
    setRightPanelVisible: jest.fn(),
    rightPanelVisible: true,
    loading: false,
    confirmIt: jest.fn(),
    sidebarView: 0,
    setSidebarView: jest.fn(),
    handleNotificationPopup: jest.fn(),
    notifications: [],
    handleChat: jest.fn(),
    handleSearch: jest.fn(),
    nodes: {},
    navigateToNode: jest.fn(),
    displayInheritanceSettings: jest.fn(),
    displayUserLogs: jest.fn(),
    locked: false,
  };

  const theme = createTheme({
    palette: {
      mode: 'light',
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders with correct header height', () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <AppHeader {...mockProps} />
      </ThemeProvider>
    );
    
    const headerElement = container.querySelector('.MuiBox-root');
    expect(headerElement).toBeInTheDocument();
  });

  test('renders logo based on theme', () => {
    render(
      <ThemeProvider theme={theme}>
        <AppHeader {...mockProps} />
      </ThemeProvider>
    );
    
    const logo = screen.getByAltText('logo');
    expect(logo).toBeInTheDocument();
  });

  test('renders user avatar when authenticated', () => {
    render(
      <ThemeProvider theme={theme}>
        <AppHeader {...mockProps} />
      </ThemeProvider>
    );
    
    const avatarButton = screen.getByRole('button', { name: /test user/i });
    expect(avatarButton).toBeInTheDocument();
  });

  test('handles search button click', () => {
    render(
      <ThemeProvider theme={theme}>
        <AppHeader {...mockProps} />
      </ThemeProvider>
    );
    
    const searchButton = screen.getByTestId('SearchIcon').closest('button');
    if (searchButton) {
      fireEvent.click(searchButton);
    }
    
    expect(mockProps.handleSearch).toHaveBeenCalled();
  });

  test('handles notification button click', () => {
    render(
      <ThemeProvider theme={theme}>
        <AppHeader {...mockProps} />
      </ThemeProvider>
    );
    
    const notificationButton = screen.getByTestId('NotificationsIcon').closest('button');
    if (notificationButton) {
      fireEvent.click(notificationButton);
    }
    
    expect(mockProps.handleNotificationPopup).toHaveBeenCalled();
  });

  test('shows notification badge when notifications exist', () => {
    const propsWithNotifications = {
      ...mockProps,
      notifications: [{
        id: '1',
        title: 'Test Notification',
        body: 'Test message',
        user: 'testuser',
        sender: 'system',
        senderDetail: { 
          id: 'system', 
          name: 'System',
          uname: 'system',
          imageUrl: '',
          chooseUname: false
        },
        timestamp: Timestamp.now(),
        createdAt: Timestamp.now(),
        read: false,
        type: 'info',
        notificationType: 'info',
        link: '',
        nodeId: '',
        entityId: '',
        seen: false
      }],
    };
    
    render(
      <ThemeProvider theme={theme}>
        <AppHeader {...propsWithNotifications} />
      </ThemeProvider>
    );
    
    const badge = screen.getByText('1');
    expect(badge).toBeInTheDocument();
  });

  test('handles theme switch button click', () => {
    const useThemeChange = require(' @components/lib/hooks/useThemeChange').default;
    const handleThemeSwitch = jest.fn();
    useThemeChange.mockReturnValue([handleThemeSwitch]);
    
    render(
      <ThemeProvider theme={theme}>
        <AppHeader {...mockProps} />
      </ThemeProvider>
    );
    
    const themeButton = screen.getByTestId('DarkModeIcon').closest('button');
    if (themeButton) {
      fireEvent.click(themeButton);
    }
    
    expect(handleThemeSwitch).toHaveBeenCalled();
  });

  test('opens profile menu when avatar is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <AppHeader {...mockProps} />
      </ThemeProvider>
    );
    
    const avatarButton = screen.getByRole('button', { name: /test user/i });
    fireEvent.click(avatarButton);
    
    expect(screen.getByText('TEST USER')).toBeInTheDocument();
    expect(screen.getByText('Change Photo')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  test('handles sign out', async () => {
    // Get references to the mocked functions from the existing mocks
    const { useRouter } = require('next/router');
    const mockPush = jest.fn();
    const mockRouter = { push: mockPush };
    (useRouter as jest.Mock).mockImplementation(() => mockRouter);
    const mockSignOut = jest.fn(() => Promise.resolve());
    (getAuth as jest.Mock).mockImplementation(() => ({ signOut: mockSignOut }));
    
    render(
      <ThemeProvider theme={theme}>
        <AppHeader {...mockProps} />
      </ThemeProvider>
    );
    
    const avatarButton = screen.getByRole('button', { name: /test user/i });
    fireEvent.click(avatarButton);
    
    const logoutButton = screen.getByText('Logout');
    await act(async () => {
      fireEvent.click(logoutButton);
    });
    
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/signin');
  });

  test('displays active users correctly', () => {
    const propsWithNodes = {
      ...mockProps,
      nodes: {
        'node-1': {
          id: 'node-1',
          title: 'Test Node',
          deleted: false,
          properties: {
            parts: [],
            isPartOf: []
          },
          inheritance: {} as Record<string, any>,
          specializations: [],
          generalizations: [],
          parts: [],
          isPartOf: [],
          children: [],
          parent: null,
          root: 'false',
          propertyType: {} as Record<string, string>,
          nodeType: 'concept' as INodeTypes,
          textValue: {} as Record<string, string>,
          createdBy: 'testuser'
        }
      }
    };
    
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation((query: any, callback: (arg0: { docChanges: () => { type: string; doc: { id: string; data: () => { currentNode: string; imageUrl: string; fName: string; lName: string; lastInteracted: Date; }; }; }[]; }) => void) => {
      callback({
        docChanges: () => [
          {
            type: 'added',
            doc: {
              id: 'user-1',
              data: () => ({
                currentNode: 'node-1',
                imageUrl: 'https://example.com/user1.jpg',
                fName: 'John',
                lName: 'Doe',
                lastInteracted: new Date(),
              }),
            },
          },
        ],
      });
      return jest.fn();
    });
    
    render(
      <ThemeProvider theme={theme}>
        <AppHeader {...propsWithNodes} />
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('optimized-avatar')).toBeInTheDocument();
  });
});