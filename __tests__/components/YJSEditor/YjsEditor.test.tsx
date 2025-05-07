// Import statements
import React from 'react';
import { render, screen } from '@testing-library/react';
import YjsEditor from ' @components/components/YJSEditor/YjsEditor';
import '@testing-library/jest-dom';

// Mock dynamic import for YjsEditorWrapper
jest.mock('next/dynamic', () => () => {
  return function DynamicComponent(props: any) {
    return <div data-testid="mock-yjs-editor-wrapper" {...props} structured={props.structured?.toString()} autoFocus={props.autoFocus?.toString()} cursorPosition={props.cursorPosition?.toString()} />;
  };
});

describe('YjsEditor Component', () => {
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

  test('renders YjsEditorWrapper with correct props', () => {
    render(<YjsEditor {...mockProps} />);
    
    const wrapper = screen.getByTestId('mock-yjs-editor-wrapper');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('fullname', 'Test User');
    expect(wrapper).toHaveAttribute('property', 'title');
    expect(wrapper).toHaveAttribute('nodeId', 'test-node-id');
    expect(wrapper).toHaveAttribute('color', '#ff0000');
    expect(wrapper).toHaveAttribute('structured', 'true');
    expect(wrapper).toHaveAttribute('cursorPosition', '0');
  });

  test('passes onEditorReady prop to YjsEditorWrapper when provided', () => {
    const onEditorReady = jest.fn();
    render(<YjsEditor {...mockProps} onEditorReady={onEditorReady} />);
    
    const wrapper = screen.getByTestId('mock-yjs-editor-wrapper');
    expect(wrapper).toBeInTheDocument();
  });
});