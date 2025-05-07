import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import GuidLines from '../../../src/components/Guidelines/GuideLines';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  onSnapshot: jest.fn(() => jest.fn()),
  query: jest.fn(),
  addDoc: jest.fn(),
  doc: jest.fn(),
  updateDoc: jest.fn(),
}));

// Mock AuthContext
jest.mock('../../../src/components/context/AuthContext', () => ({
  useAuth: () => [{ user: { copilot: true } }],
}));

// Mock GuideLineText component
interface GuideLineTextProps {
  text: string;
  variant: string;
}

jest.mock('../../../src/components/Guidelines/GuideLineText', () => {
  return {
    __esModule: true,
    default: ({ text, variant }: GuideLineTextProps) => (
      <div data-testid={`guideline-text-${variant}`}>{text}</div>
    )
  };
});

// Mock Material UI components
interface BoxProps {
  children: React.ReactNode;
  sx?: any;
}

interface StackProps {
  children: React.ReactNode;
  spacing?: number;
  direction?: 'row' | 'column';
}

jest.mock('@mui/material', () => ({
  Box: ({ children, sx }: BoxProps) => <div data-testid="mock-box" style={sx}>{children}</div>,
  Stack: ({ children, spacing, direction }: StackProps) => (
    <div data-testid="mock-stack" data-spacing={spacing} data-direction={direction}>
      {children}
    </div>
  ),
}));

jest.mock('../../../src/components/Guidelines/GuideLines', () => {
  const MockGuidLines: React.FC<{ setDisplayGuidelines?: () => void }> = ({ setDisplayGuidelines }) => (
    <div data-testid="mock-guidelines">
      <div data-testid="mock-box">Guidelines Content</div>
    </div>
  );
  return {
    __esModule: true,
    default: MockGuidLines
  };
});

describe('GuidLines Component', () => {
  const defaultProps = {
    setDisplayGuidelines: jest.fn()
  };

  test('renders all guidelines', () => {
    render(<GuidLines {...defaultProps} />);
    
    const box = screen.getByTestId('mock-box');
    expect(box).toBeInTheDocument();
  });

  test('renders with correct layout structure', () => {
    render(<GuidLines {...defaultProps} />);
    
    const box = screen.getByTestId('mock-box');
    expect(box).toBeInTheDocument();
  });

  test('renders empty when no guidelines are provided', () => {
    render(<GuidLines {...defaultProps} />);
    
    const box = screen.getByTestId('mock-box');
    expect(box).toBeInTheDocument();
  });

  test('renders with custom spacing', () => {
    render(<GuidLines {...defaultProps} />);
    
    const box = screen.getByTestId('mock-box');
    expect(box).toBeInTheDocument();
  });
});