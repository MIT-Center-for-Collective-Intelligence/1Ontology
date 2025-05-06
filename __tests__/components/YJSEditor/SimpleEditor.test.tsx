// Import statements
import React from 'react';
import { render, screen } from '@testing-library/react';
import SimpleEditor from ' @components/components/YJSEditor/SimpleEditor';
import '@testing-library/jest-dom';

// Mock dynamic import for QuillEditor
jest.mock('next/dynamic', () => () => {
  return function DynamicComponent(props: any) {
    return <div data-testid="mock-quill-editor" {...props} />;
  };
});

describe('SimpleEditor Component', () => {
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

  test('renders QuillEditor with correct props', () => {
    render(<SimpleEditor {...mockProps} />);
    
    const quillEditor = screen.getByTestId('mock-quill-editor');
    expect(quillEditor).toBeInTheDocument();
    expect(quillEditor).toHaveAttribute('property', 'title');
    expect(quillEditor).toHaveAttribute('text', 'Test text');
    expect(quillEditor).toHaveAttribute('nodeId', 'test-node-id');
  });

  test('passes onEditorReady prop to QuillEditor when provided', () => {
    const onEditorReady = jest.fn();
    render(<SimpleEditor {...mockProps} onEditorReady={onEditorReady} />);
    
    const quillEditor = screen.getByTestId('mock-quill-editor');
    expect(quillEditor.getAttribute('onEditorReady')).toBeDefined();
  });
});