// Import statements
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import QuillEditor from ' @components/components/YJSEditor/QuillEditor';
import '@testing-library/jest-dom';

// Mock Quill
jest.mock('quill', () => {
  return jest.fn().mockImplementation(() => {
    return {
      setText: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      getSelection: jest.fn().mockReturnValue({ index: 0 }),
      getText: jest.fn().mockReturnValue('Test text'),
      focus: jest.fn(),
      setSelection: jest.fn()
    };
  });
});

// Mock Material UI components
jest.mock('@mui/material', () => ({
  Box: ({ children, sx, ref }: any) => (
    <div data-testid="mock-box" ref={ref}>
      {children}
    </div>
  ),
}));

// Mock DISPLAY constant
jest.mock(' @components/lib/CONSTANTS', () => ({
  DISPLAY: {
    title: 'Title',
    description: 'Description',
  },
}));

// Mock string utils
jest.mock(' @components/lib/utils/string.utils', () => ({
  capitalizeFirstLetter: jest.fn((str) => str.charAt(0).toUpperCase() + str.slice(1)),
}));

describe('QuillEditor Component', () => {
  const mockProps = {
    property: 'title',
    text: 'Test text',
    breakInheritance: jest.fn(),
    nodeId: 'test-node-id',
    setCursorPosition: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the editor container', () => {
    render(<QuillEditor {...mockProps} />);
    expect(screen.getByTestId('mock-box')).toBeInTheDocument();
  });
  // Note: Most of the functionality is in useEffect hooks which are harder to test
});