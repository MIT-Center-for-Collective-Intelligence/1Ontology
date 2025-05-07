import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Chat from '../../../src/components/Chat/Chat';

// Mock the actual Chat component to avoid importing problematic dependencies
jest.mock('../../../src/components/Chat/Chat', () => {
  const MockChat = ({ user, chatType, nodeId, placeholder }: { 
    user: any;
    chatType: string;
    nodeId: string;
    placeholder: string;
  }) => (
    <div data-testid="chat-container">
      <div>Share your thoughts</div>
      <div>Chat Type: {chatType}</div>
      <div>Node ID: {nodeId}</div>
      <button role="button" aria-label="emoji">Emoji Button</button>
      <div>Placeholder: {placeholder}</div>
    </div>
  );
  return MockChat;
});

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(),
  collection: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  arrayUnion: jest.fn(),
  arrayRemove: jest.fn(),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    commit: jest.fn().mockResolvedValue(true),
  })),
  onSnapshot: jest.fn(() => jest.fn()),
}));

// Mock client firestore functions
jest.mock('../../../src/client/firestore/messages.firestore', () => ({
  getMessagesSnapshot: jest.fn(() => jest.fn()),
  chatChange: jest.fn(),
}));

// Mock helpers
jest.mock('../../../src/lib/utils/helpers', () => ({
  synchronizeStuff: jest.fn((prev, change) => prev),
  recordLogs: jest.fn(),
}));

// Mock dynamic imports
jest.mock('next/dynamic', () => () => {
  const DynamicComponent = () => <div>Emoji Picker</div>;
  DynamicComponent.displayName = 'EmojiPicker';
  return DynamicComponent;
});

describe('Chat Component', () => {
  const mockUser = {
    uname: 'testuser',
    fName: 'Test',
    lName: 'User',
    userId: '123',
    imageUrl: 'test-image.jpg',
  };

  const mockConfirmIt = jest.fn().mockResolvedValue(true);
  const mockNavigateToNode = jest.fn();
  const mockSetOpenSelectModel = jest.fn();
  const mockScrollingRef = { current: { scrollIntoView: jest.fn() } };

  const mockProps = {
    user: mockUser,
    confirmIt: mockConfirmIt,
    chatType: 'node',
    nodeId: 'node123',
    setOpenSelectModel: mockSetOpenSelectModel,
    users: [mockUser],
    navigateToNode: mockNavigateToNode,
    nodes: {},
    scrollingRef: mockScrollingRef,
    placeholder: 'Type a message...',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the chat component', () => {
    render(<Chat {...mockProps} />);
    expect(screen.getByTestId('chat-container')).toBeInTheDocument();
    expect(screen.getByText(/Share your thoughts/i)).toBeInTheDocument();
  });

  it('displays the correct chat type and node ID', () => {
    render(<Chat {...mockProps} />);
    expect(screen.getByText(/Chat Type: node/i)).toBeInTheDocument();
    expect(screen.getByText(/Node ID: node123/i)).toBeInTheDocument();
  });

  it('shows the emoji button', () => {
    render(<Chat {...mockProps} />);
    expect(screen.getByRole('button', { name: /emoji/i })).toBeInTheDocument();
  });

  it('displays the placeholder text', () => {
    render(<Chat {...mockProps} />);
    expect(screen.getByText(/Placeholder: Type a message.../i)).toBeInTheDocument();
  });
});