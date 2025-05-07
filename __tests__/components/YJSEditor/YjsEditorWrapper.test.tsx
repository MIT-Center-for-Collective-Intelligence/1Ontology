// Import statements
import React from 'react';
import { render, screen } from '@testing-library/react';
import YjsEditorWrapper from ' @components/components/YJSEditor/YjsEditorWrapper';
import '@testing-library/jest-dom';
import { act } from 'react-dom/test-utils';

// Mock Yjs
jest.mock('yjs', () => ({
  Doc: jest.fn().mockImplementation(() => ({
    getText: jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue('Test text'),
    }),
  })),
}));

// Mock y-websocket
jest.mock('y-websocket', () => ({
  WebsocketProvider: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    awareness: {
      setLocalStateField: jest.fn(),
    },
    disconnect: jest.fn(),
    destroy: jest.fn(),
  })),
}));

// Mock y-quill
jest.mock('y-quill', () => ({
  QuillBinding: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
  })),
}));

// Mock Quill
jest.mock('quill', () => {
  const mockQuill = jest.fn().mockImplementation(() => ({
    setText: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    getSelection: jest.fn().mockReturnValue({ index: 0 }),
    getText: jest.fn().mockReturnValue('Test text'),
    focus: jest.fn(),
    setSelection: jest.fn()
  })) as any;
  
  // Add static register method
  mockQuill.register = jest.fn();
  
  return mockQuill;
});

// Mock QuillCursors
jest.mock('quill-cursors', () => ({}));

// Mock Material UI components
jest.mock('@mui/material', () => ({
  Box: ({ children, sx, ref }: any) => (
    <div data-testid="mock-box" ref={ref}>
      {children}
    </div>
  ),
  Typography: ({ children, color, sx }: any) => (
    <div data-testid="mock-typography" style={{ color }}>
      {children}
    </div>
  ),
}));

// Mock CONSTANTS
jest.mock(' @components/lib/CONSTANTS', () => ({
  DISPLAY: {
    title: 'Title',
    description: 'Description',
  },
  WS_URL: 'wss://test-websocket-url',
}));

// Mock string utils
jest.mock(' @components/lib/utils/string.utils', () => ({
  capitalizeFirstLetter: jest.fn((str) => str.charAt(0).toUpperCase() + str.slice(1)),
}));

// Mock helpers
jest.mock(' @components/lib/utils/helpers', () => ({
  recordLogs: jest.fn(),
}));

describe('YjsEditorWrapper Component', () => {
  const mockProps = {
    fullname: 'Test User',
    property: 'title',
    nodeId: 'test-node-id',
    color: '#ff0000',
    saveChangeHistory: jest.fn(),
    structured: true,
    checkDuplicateTitle: jest.fn(),
    autoFocus: true,
    cursorPosition: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the editor container', () => {
    render(<YjsEditorWrapper {...mockProps} />);
    expect(screen.getByTestId('mock-box')).toBeInTheDocument();
  });
});