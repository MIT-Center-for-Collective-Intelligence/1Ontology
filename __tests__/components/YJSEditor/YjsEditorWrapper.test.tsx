import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock dependencies before importing the component
// Mock Quill
const mockQuillInstance = {
  focus: jest.fn(),
  setSelection: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  root: document.createElement('div'),
};

jest.mock('quill', () => {
  return {
    register: jest.fn(),
    default: jest.fn(() => mockQuillInstance),
  };
});

jest.mock('quill-cursors', () => ({}));

// Mock Y.js
const mockYText = {
  observe: jest.fn(),
  delete: jest.fn(),
  insert: jest.fn(),
  toString: jest.fn(() => 'Sample text'),
};

const mockYDoc = {
  getText: jest.fn(() => mockYText),
};

jest.mock('yjs', () => ({
  Doc: jest.fn(() => mockYDoc),
}));

// Mock WebsocketProvider
const mockProvider = {
  on: jest.fn((event, callback) => {
    if (event === 'sync') {
      // Simulate sync event after a short delay
      setTimeout(() => callback(true), 50);
    }
  }),
  disconnect: jest.fn(),
  destroy: jest.fn(),
  awareness: {
    setLocalStateField: jest.fn(),
  },
};

jest.mock('y-websocket', () => ({
  WebsocketProvider: jest.fn(() => mockProvider),
}));

// Mock QuillBinding
const mockBinding = {
  destroy: jest.fn(),
};

jest.mock('y-quill', () => ({
  QuillBinding: jest.fn(() => mockBinding),
}));

// Mock Material-UI components properly
jest.mock('@mui/material', () => {
  const React = require('react');
  return {
    Box: React.forwardRef(({ children, sx }, ref) => (
      <div ref={ref} data-testid="editor-container">{children}</div>
    )),
    Typography: ({ children, color, sx }) => (
      <p data-testid="error-message" data-color={color}>
        {children}
      </p>
    ),
  };
});

// Mock helpers
jest.mock(' @components/lib/utils/helpers', () => ({
  recordLogs: jest.fn(),
}));

jest.mock(' @components/lib/utils/string.utils', () => ({
  capitalizeFirstLetter: jest.fn((str) => str.charAt(0).toUpperCase() + str.slice(1)),
}));

jest.mock(' @components/lib/CONSTANTS', () => ({
  DISPLAY: { 
    title: 'Title', 
    description: 'Description' 
  },
  WS_URL: 'wss://test-websocket-url.com',
}));

// Now import the component after mocking dependencies
import YjsEditorWrapper from ' @components/components/YJSEditor/YjsEditorWrapper';

describe('YjsEditorWrapper Component', () => {
  // Default props
  const defaultProps = {
    fullname: 'Test User',
    property: 'title',
    nodeId: 'node-123',
    color: '#FF0000',
    saveChangeHistory: jest.fn(),
    structured: false,
    checkDuplicateTitle: jest.fn(() => false),
    autoFocus: false,
    cursorPosition: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
    };
    
    // Mock Element.getBoundingClientRect()
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 500,
      height: 500,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));
    
    // Mock document.execCommand
    document.execCommand = jest.fn();
    
    // Reset all mock instances
    mockQuillInstance.focus.mockReset();
    mockQuillInstance.setSelection.mockReset();
    mockQuillInstance.on.mockReset();
    mockQuillInstance.off.mockReset();
    mockProvider.on.mockReset();
    mockProvider.on.mockImplementation((event, callback) => {
      if (event === 'sync') {
        setTimeout(() => callback(true), 50);
      }
      return mockProvider;
    });
  });

  test('renders the editor container', () => {
    render(<YjsEditorWrapper {...defaultProps} />);
    expect(screen.getByTestId('editor-container')).toBeInTheDocument();
  });

  test('initializes Quill editor and Y.js document', async () => {
    const { rerender } = render(<YjsEditorWrapper {...defaultProps} />);
    
    // Wait for initialization to complete and verify mocks were called
    await waitFor(() => {
      expect(require('yjs').Doc).toHaveBeenCalled();
      expect(require('y-websocket').WebsocketProvider).toHaveBeenCalledWith(
        'wss://test-websocket-url.com',
        'node-123-title',
        expect.any(Object),
        expect.objectContaining({
          connect: true,
          params: {
            type: 'non-structured',
          },
        })
      );
      expect(require('quill').default).toHaveBeenCalled();
      expect(require('y-quill').QuillBinding).toHaveBeenCalled();
    });
  });

  test('shows error message when duplicate title is detected', async () => {
    // Mock implementation that returns true for duplicate check
    const checkDuplicateTitleMock = jest.fn(() => true);
    
    render(
      <YjsEditorWrapper 
        {...defaultProps} 
        checkDuplicateTitle={checkDuplicateTitleMock}
      />
    );
    
    // Verify Quill is initialized and event listener is attached
    await waitFor(() => {
      expect(mockQuillInstance.on).toHaveBeenCalledWith('text-change', expect.any(Function));
    });
    
    // Get text-change callback and simulate text change event
    const textChangeCallback = mockQuillInstance.on.mock.calls.find(
      call => call[0] === 'text-change'
    )[1];
    
    // Manually call the callback with simulated event data
    act(() => {
      textChangeCallback(
        { ops: [{ insert: 'New ' }] }, // delta
        { ops: [{ insert: 'Title' }] }, // oldDelta
        'user' // source
      );
    });
    
    // Error message should appear since checkDuplicateTitle returns true
    expect(screen.getByTestId('error-message')).toBeInTheDocument();
  });

  test('saves change history on selection change (blur)', async () => {
    render(<YjsEditorWrapper {...defaultProps} />);
    
    // Verify Quill is initialized and event listeners are attached
    await waitFor(() => {
      expect(mockQuillInstance.on).toHaveBeenCalledWith('selection-change', expect.any(Function));
      expect(mockQuillInstance.on).toHaveBeenCalledWith('text-change', expect.any(Function));
    });
    
    // Get callbacks
    const textChangeCallback = mockQuillInstance.on.mock.calls.find(
      call => call[0] === 'text-change'
    )[1];
    
    const selectionChangeCallback = mockQuillInstance.on.mock.calls.find(
      call => call[0] === 'selection-change'
    )[1];
    
    // Simulate text change to record a change
    act(() => {
      textChangeCallback(
        { ops: [{ insert: 'New ' }] }, // delta
        { ops: [{ insert: 'Title' }] }, // oldDelta
        'user' // source
      );
    });
    
    // Simulate blur (selection becoming null)
    act(() => {
      selectionChangeCallback(null, { index: 0, length: 0 }, 'user');
    });
    
    // Verify saveChangeHistory was called
    expect(defaultProps.saveChangeHistory).toHaveBeenCalled();
  });

  test('autofocuses the editor when autoFocus is true', async () => {
    // Use fake timers to control setTimeout
    jest.useFakeTimers();
    
    render(<YjsEditorWrapper {...defaultProps} autoFocus={true} cursorPosition={5} />);
    
    // Verify provider.on('sync') was called
    expect(mockProvider.on).toHaveBeenCalledWith('sync', expect.any(Function));
    
    // Fast-forward timers to trigger the sync callback
    act(() => {
      jest.advanceTimersByTime(100);
    });
    
    // Fast-forward more to trigger the focus setTimeout
    act(() => {
      jest.advanceTimersByTime(1100);
    });
    
    // Verify focus was called
    expect(mockQuillInstance.focus).toHaveBeenCalled();
    expect(mockQuillInstance.setSelection).toHaveBeenCalledWith(5);
    
    // Restore real timers
    jest.useRealTimers();
  });

  test('calls onEditorReady callback when editor is initialized', async () => {
    const onEditorReady = jest.fn();
    render(<YjsEditorWrapper {...defaultProps} onEditorReady={onEditorReady} />);
    
    // Verify callback was called with quill instance
    await waitFor(() => {
      expect(onEditorReady).toHaveBeenCalledWith(mockQuillInstance);
    });
  });

  test('properly cleans up resources on unmount', async () => {
    // Spy on window.removeEventListener
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    
    const { unmount } = render(<YjsEditorWrapper {...defaultProps} />);
    
    // Wait for initialization to complete
    await waitFor(() => {
      expect(mockQuillInstance.on).toHaveBeenCalled();
    });
    
    // Unmount the component
    unmount();
    
    // Verify cleanup functions were called
    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(mockProvider.disconnect).toHaveBeenCalled();
    expect(mockProvider.destroy).toHaveBeenCalled();
    expect(mockBinding.destroy).toHaveBeenCalled();
  });
});