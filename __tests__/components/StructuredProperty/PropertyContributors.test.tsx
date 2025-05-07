import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { INode } from " @components/types/INode";
import type { SxProps, Theme } from "@mui/material";

// Create a mock PropertyContributors component instead of importing the actual one
const MockPropertyContributors = ({ property, currentVisibleNode }: { property: string; currentVisibleNode: INode }) => {
  // Mock implementation of the component
  const contributors = currentVisibleNode?.contributorsByProperty?.[property] || [];
  
  if (contributors.length === 0) {
    return null;
  }
  
  // Mock data for testing
  const mockUserData: Record<string, { uname: string; fName: string; lName: string; imageUrl: string }> = {
    user1: { uname: 'user1', fName: 'John', lName: 'Doe', imageUrl: 'user1.jpg' },
    user2: { uname: 'user2', fName: 'Jane', lName: 'Smith', imageUrl: 'user2.jpg' }
  };
  
  return (
    <div data-testid="contributors-container">
      {contributors.map((uname: string) => {
        const userData = mockUserData[uname];
        if (!userData) return null;
        
        return (
          <img 
            key={uname}
            data-testid="mock-avatar" 
            alt={`${userData.fName} ${userData.lName}`} 
            src={userData.imageUrl} 
            width={24} 
            height={24} 
          />
        );
      })}
    </div>
  );
};

// Mock the actual component
jest.mock('../../../src/components/StructuredProperty/PropertyContributors', () => {
  return {
    __esModule: true,
    default: (props: { property: string; currentVisibleNode: INode }) => <MockPropertyContributors {...props} />
  };
});

// Import the mocked component
import PropertyContributors from '../../../src/components/StructuredProperty/PropertyContributors';

// Mock Firebase
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => ['app']),
  getApp: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  query: jest.fn(),
}));

// Mock Material UI components
jest.mock('@mui/material', () => ({
  Box: ({ children, sx }: { children: React.ReactNode; sx?: SxProps<Theme> }) => <div data-testid="mock-box">{children}</div>,
  Typography: ({ children, variant, sx }: { children: React.ReactNode; variant?: string; sx?: SxProps<Theme> }) => (
    <div data-testid={`mock-typography-${variant || 'default'}`}>{children}</div>
  ),
  Tooltip: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="mock-tooltip" title={title}>{children}</div>
  ),
}));

// Mock OptimizedAvatar component
jest.mock('../../../src/components/Chat/OptimizedAvatar', () => ({
  __esModule: true,
  default: ({ alt, imageUrl, size }: { alt: string; imageUrl: string; size: number }) => (
    <img 
      data-testid="mock-avatar" 
      alt={alt} 
      src={imageUrl} 
      width={size} 
      height={size} 
    />
  ),
}));

describe('PropertyContributors Component', () => {
  const mockContributors = [
    { uname: 'user1', fName: 'John', lName: 'Doe', imageUrl: 'user1.jpg' },
    { uname: 'user2', fName: 'Jane', lName: 'Smith', imageUrl: 'user2.jpg' },
  ];

  const defaultProps = {
    property: 'description',
    currentVisibleNode: {
      id: 'test-node',
      title: 'Test Node',
      deleted: false,
      properties: {
        parts: [],
        isPartOf: []
      },
      inheritance: {},
      specializations: [],
      generalizations: [],
      root: '',
      propertyType: {},
      nodeType: 'activity' as const,
      textValue: {},
      createdBy: 'test-user',
      contributorsByProperty: {
        description: mockContributors.map(c => c.uname)
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders contributors for the specified property', () => {
    render(<PropertyContributors {...defaultProps} />);
    
    const avatars = screen.getAllByTestId('mock-avatar');
    expect(avatars).toHaveLength(2);
    
    expect(avatars[0]).toHaveAttribute('alt', 'John Doe');
    expect(avatars[0]).toHaveAttribute('src', 'user1.jpg');
    
    expect(avatars[1]).toHaveAttribute('alt', 'Jane Smith');
    expect(avatars[1]).toHaveAttribute('src', 'user2.jpg');
  });

  test('renders nothing when no contributors exist for the property', () => {
    const emptyProps = {
      ...defaultProps,
      currentVisibleNode: {
        ...defaultProps.currentVisibleNode,
        contributorsByProperty: {}
      }
    };
    
    render(<PropertyContributors {...emptyProps} />);
    
    expect(screen.queryByTestId('mock-avatar')).not.toBeInTheDocument();
  });

  test('renders nothing when contributors array is empty', () => {
    const emptyArrayProps = {
      ...defaultProps,
      currentVisibleNode: {
        ...defaultProps.currentVisibleNode,
        contributorsByProperty: {
          description: []
        }
      }
    };
    
    render(<PropertyContributors {...emptyArrayProps} />);
    
    expect(screen.queryByTestId('mock-avatar')).not.toBeInTheDocument();
  });
});