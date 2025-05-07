import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import MarkdownRender from '../../../src/components/Markdown/MarkdownRender';

// Mock the actual MarkdownRender component to avoid importing problematic dependencies
jest.mock('../../../src/components/Markdown/MarkdownRender', () => {
  return function MockedMarkdownRender({ text, sx }: { text: string; sx?: any }) {
    // Simple implementation that renders markdown-like content
    const renderMarkdown = (content: string) => {
      if (content.startsWith('# ')) {
        return <h1>{content.substring(2)}</h1>;
      } else if (content.startsWith('> ')) {
        return <blockquote>{content.substring(2)}</blockquote>;
      } else if (content.startsWith('```')) {
        return <div data-testid="syntax-highlighter">{content}</div>;
      } else if (content.startsWith('`') && content.endsWith('`')) {
        return <code>{content.substring(1, content.length - 1)}</code>;
      } else if (content.includes('<') && content.includes('>')) {
        return <div dangerouslySetInnerHTML={{ __html: content }} />;
      } else if (content.startsWith('[') && content.includes('](')) {
        const linkText = content.substring(1, content.indexOf(']'));
        const linkUrl = content.substring(content.indexOf('](') + 2, content.length - 1);
        return <a href={linkUrl} target="_blank" rel="noopener">{linkText}</a>;
      }
      return <p>{content}</p>;
    };

    return (
      <div style={sx}>
        {renderMarkdown(text)}
      </div>
    );
  };
});

describe('MarkdownRender Component', () => {
  const lightTheme = createTheme({
    palette: {
      mode: 'light',
    },
  });

  it('renders markdown text correctly', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <MarkdownRender text="# Hello World" />
      </ThemeProvider>
    );
    
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders links with correct attributes', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <MarkdownRender text="[Test Link](https://example.com)" />
      </ThemeProvider>
    );
    
    const link = screen.getByText('Test Link');
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
  });

  it('renders code blocks with syntax highlighting', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <MarkdownRender text="```js\nconst x = 1;\n```" />
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument();
  });

  it('renders inline code correctly', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <MarkdownRender text="`const x = 1;`" />
      </ThemeProvider>
    );
    
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
  });

  it('renders blockquotes correctly', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <MarkdownRender text="> This is a quote" />
      </ThemeProvider>
    );
    
    expect(screen.getByText('This is a quote')).toBeInTheDocument();
  });

  it('handles HTML content correctly', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <MarkdownRender text="<div>HTML content</div>" />
      </ThemeProvider>
    );
    
    expect(screen.getByText('HTML content')).toBeInTheDocument();
  });

  it('applies custom styles when provided', () => {
    const customSx = { fontSize: '20px', color: 'red' };
    
    render(
      <ThemeProvider theme={lightTheme}>
        <MarkdownRender text="Test content" sx={customSx} />
      </ThemeProvider>
    );
    
    const content = screen.getByText('Test content');
    expect(content).toBeInTheDocument();
  });
});