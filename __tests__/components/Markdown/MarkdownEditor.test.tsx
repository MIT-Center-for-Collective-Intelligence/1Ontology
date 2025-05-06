import React from 'react';
import { render, screen } from '@testing-library/react';
import MarkdownEditor from '../../../src/components/Markdown/MarkdownEditor';
import { ThemeProvider, createTheme } from '@mui/material';

// Mock the dependencies
jest.mock('../../../src/components/Markdown/MarkdownRender', () => {
  return {
    __esModule: true,
    default: ({ text }: { text: string }) => <div data-testid="markdown-render">{text}</div>
  };
});

jest.mock('../../../src/components/Markdown/MarkdownToolbar', () => {
  return {
    __esModule: true,
    default: ({ editor, selection }: { editor: any, selection: any }) => (
      <div data-testid="markdown-toolbar">Toolbar</div>
    )
  };
});

jest.mock('../../../src/components/YJSEditor/SimpleEditor', () => {
  return {
    __esModule: true,
    default: (props: any) => (
      <div data-testid="simple-editor">
        Simple Editor: {props.text}
        <button onClick={() => props.onEditorReady({ on: jest.fn() })}>Ready</button>
      </div>
    )
  };
});

jest.mock('../../../src/components/YJSEditor/YjsEditor', () => {
  return {
    __esModule: true,
    default: (props: any) => (
      <div data-testid="yjs-editor">
        YJS Editor
        <button onClick={() => props.onEditorReady({ on: jest.fn() })}>Ready</button>
      </div>
    )
  };
});

describe('MarkdownEditor Component', () => {
  const theme = createTheme();
  
  const defaultProps = {
    content: {
      text: 'Test content',
      property: 'description',
      structured: false,
      onSave: jest.fn(),
    },
    mode: {
      isPreview: false,
      useWebsocket: false,
      reference: null,
    },
    editor: {
      autoFocus: true,
      cursorPosition: null,
      onCursorChange: jest.fn(),
      checkDuplicateTitle: jest.fn(),
      saveChangeHistory: jest.fn(),
    },
    collaborationData: {
      fullName: 'Test User',
      nodeId: 'test-node-id',
      randomProminentColor: '#ff0000',
    },
  };

  it('renders in edit mode with SimpleEditor when not using websocket', () => {
    render(
      <ThemeProvider theme={theme}>
        <MarkdownEditor {...defaultProps} />
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('markdown-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('simple-editor')).toBeInTheDocument();
    expect(screen.getByText('Simple Editor: Test content')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-render')).toBeInTheDocument();
  });

  it('renders in edit mode with YjsEditor when using websocket', () => {
    const props = {
      ...defaultProps,
      mode: {
        ...defaultProps.mode,
        useWebsocket: true,
      },
    };
    
    render(
      <ThemeProvider theme={theme}>
        <MarkdownEditor {...props} />
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('markdown-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('yjs-editor')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-render')).toBeInTheDocument();
  });

  it('renders only preview when in preview mode', () => {
    const props = {
      ...defaultProps,
      mode: {
        ...defaultProps.mode,
        isPreview: true,
      },
    };
    
    render(
      <ThemeProvider theme={theme}>
        <MarkdownEditor {...props} />
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('markdown-render')).toBeInTheDocument();
    expect(screen.queryByTestId('markdown-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('simple-editor')).not.toBeInTheDocument();
    expect(screen.queryByTestId('yjs-editor')).not.toBeInTheDocument();
  });

  it('does not show toolbar for title property', () => {
    const props = {
      ...defaultProps,
      content: {
        ...defaultProps.content,
        property: 'title',
      },
    };
    
    render(
      <ThemeProvider theme={theme}>
        <MarkdownEditor {...props} />
      </ThemeProvider>
    );
    
    expect(screen.queryByTestId('markdown-toolbar')).not.toBeInTheDocument();
    expect(screen.getByTestId('simple-editor')).toBeInTheDocument();
  });
});