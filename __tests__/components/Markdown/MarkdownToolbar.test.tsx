import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MarkdownToolbar from '../../../src/components/Markdown/MarkdownToolbar';
import { ThemeProvider, createTheme } from '@mui/material';

// Mock Quill
class MockQuill {
  focus = jest.fn();
  getSelection = jest.fn();
  getText = jest.fn();
  deleteText = jest.fn();
  insertText = jest.fn();
  setSelection = jest.fn();
}

describe('MarkdownToolbar Component', () => {
  const theme = createTheme();
  let mockEditor: any;
  let mockSelection: { index: number; length: number };

  beforeEach(() => {
    mockEditor = new MockQuill();
    mockSelection = { index: 0, length: 5 };
    
    // Setup mock implementations
    mockEditor.getSelection.mockReturnValue(mockSelection);
    mockEditor.getText.mockReturnValue('test text');
  });

  it('renders all toolbar buttons', () => {
    render(
      <ThemeProvider theme={theme}>
        <MarkdownToolbar editor={mockEditor} selection={mockSelection} />
      </ThemeProvider>
    );
    
    // Check for all tooltips
    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
    expect(screen.getByLabelText('Italic')).toBeInTheDocument();
    expect(screen.getByLabelText('Heading')).toBeInTheDocument();
    expect(screen.getByLabelText('Bullet List')).toBeInTheDocument();
    expect(screen.getByLabelText('Numbered List')).toBeInTheDocument();
    expect(screen.getByLabelText('Quote')).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Link')).toBeInTheDocument();
  });

  it('applies bold formatting when bold button is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <MarkdownToolbar editor={mockEditor} selection={mockSelection} />
      </ThemeProvider>
    );
    
    fireEvent.click(screen.getByLabelText('Bold'));
    
    expect(mockEditor.deleteText).toHaveBeenCalledWith(0, 5);
    expect(mockEditor.insertText).toHaveBeenCalledWith(0, '**test text**');
    expect(mockEditor.setSelection).toHaveBeenCalled();
  });

  it('applies italic formatting when italic button is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <MarkdownToolbar editor={mockEditor} selection={mockSelection} />
      </ThemeProvider>
    );
    
    fireEvent.click(screen.getByLabelText('Italic'));
    
    expect(mockEditor.deleteText).toHaveBeenCalledWith(0, 5);
    expect(mockEditor.insertText).toHaveBeenCalledWith(0, '*test text*');
    expect(mockEditor.setSelection).toHaveBeenCalled();
  });

  it('applies heading formatting when heading button is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <MarkdownToolbar editor={mockEditor} selection={mockSelection} />
      </ThemeProvider>
    );
    
    fireEvent.click(screen.getByLabelText('Heading'));
    
    expect(mockEditor.deleteText).toHaveBeenCalledWith(0, 5);
    expect(mockEditor.insertText).toHaveBeenCalledWith(0, '### test text');
    expect(mockEditor.setSelection).toHaveBeenCalled();
  });

  it('applies bullet list formatting when bullet list button is clicked', () => {
    render(
      <ThemeProvider theme={theme}>
        <MarkdownToolbar editor={mockEditor} selection={mockSelection} />
      </ThemeProvider>
    );
    
    fireEvent.click(screen.getByLabelText('Bullet List'));
    
    expect(mockEditor.deleteText).toHaveBeenCalledWith(0, 5);
    expect(mockEditor.insertText).toHaveBeenCalledWith(0, '- test text');
    expect(mockEditor.setSelection).toHaveBeenCalled();
  });

  it('handles null editor gracefully', () => {
    render(
      <ThemeProvider theme={theme}>
        <MarkdownToolbar editor={null} selection={mockSelection} />
      </ThemeProvider>
    );
    
    // Should render without errors
    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
    
    // Clicking should not cause errors
    fireEvent.click(screen.getByLabelText('Bold'));
  });

  it('handles null selection gracefully', () => {
    render(
      <ThemeProvider theme={theme}>
        <MarkdownToolbar editor={mockEditor} selection={null} />
      </ThemeProvider>
    );
    
    fireEvent.click(screen.getByLabelText('Bold'));
    
    // Should try to get selection from editor
    expect(mockEditor.getSelection).toHaveBeenCalled();
  });
});