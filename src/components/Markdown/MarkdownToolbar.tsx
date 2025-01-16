import React from 'react';
import { Box, IconButton, Tooltip, Divider, useTheme } from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import CodeIcon from '@mui/icons-material/Code';
import TitleIcon from '@mui/icons-material/Title';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import LinkIcon from '@mui/icons-material/Link';
import type Quill from 'quill';

interface MarkdownToolbarProps {
  editor: Quill | null;
  selection: { index: number; length: number } | null;
}

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ editor, selection }) => {
  const theme = useTheme();

  const insertMarkdown = (type: string) => {
    if (!editor) return;

    // Try to get a valid selection using multiple fallbacks
    let currentSelection = selection;
    
    if (!currentSelection) {
      editor.focus();
      currentSelection = editor.getSelection();
    }

    if (!currentSelection) {
      // If still no selection, place cursor at end
      const length = editor.getText().length;
      editor.setSelection(length, 0);
      currentSelection = editor.getSelection();
    }

    if (!currentSelection) return; // Final safety check

    const selectedText = editor.getText(currentSelection.index, currentSelection.length);
    let formattedText = '';

    // Helper function to check if text has specific formatting
    const hasFormatting = (text: string, format: string) => {
      const patterns = {
        bold: /^\*\*(.*)\*\*$/,
        italic: /^\*(.*)\*$/,
        heading: /^### (.*)$/,
        bullet: /^- (.*)$/,
        number: /^\d+\. (.*)$/,
        quote: /^> (.*)$/,
        code: /^`(.*)`$/,
        link: /^\[(.*)\]\(.*\)$/
      };
      return patterns[format as keyof typeof patterns]?.test(text);
    };

    // Helper function to remove formatting
    const removeFormatting = (text: string, format: string) => {
      const patterns = {
        bold: /^\*\*(.*)\*\*$/,
        italic: /^\*(.*)\*$/,
        heading: /^### (.*)$/,
        bullet: /^- (.*)$/,
        number: /^\d+\. (.*)$/,
        quote: /^> (.*)$/,
        code: /^`(.*)`$/,
        link: /^\[(.*)\]\(.*\)$/
      };
      const match = text.match(patterns[format as keyof typeof patterns]);
      return match ? match[1] : text;
    };

    const applyFormatting = (text: string, format: string) => {
      switch (format) {
        case 'bullet':
          return `- ${text}`;
        case 'number':
          return `1. ${text}`;
        case 'bold':
          return `**${text}**`;
        case 'italic':
          return `*${text}*`;
        case 'heading':
          return `### ${text}`;
        case 'quote':
          return `> ${text}`;
        case 'code':
          return `\`${text}\``;
        case 'link':
          return `[${text}](url)`;
        default:
          return text;
      }
    };

    switch (type) {
      case 'bullet':
      case 'number': {
        const lines = selectedText.split('\n');
        formattedText = lines.map((line, index) => {
          if (!line.trim()) return line;
          
          const hasCurrentFormat = type === 'bullet' 
            ? hasFormatting(line, 'bullet')
            : hasFormatting(line, 'number');

          if (hasCurrentFormat) {
            return removeFormatting(line, type);
          } else {
            return type === 'bullet' 
              ? `- ${line}`
              : `${index + 1}. ${line}`;
          }
        }).join('\n');
        break;
      }
      case 'bold':
      case 'italic':
      case 'heading':
      case 'quote':
      case 'code':
      case 'link': {
        if (hasFormatting(selectedText, type)) {
          formattedText = removeFormatting(selectedText, type);
        } else {
          formattedText = applyFormatting(selectedText, type);
        }
        break;
      }
    }

    // Apply the formatting
    editor.deleteText(currentSelection.index, currentSelection.length);
    editor.insertText(currentSelection.index, formattedText);
    
    // Set selection after formatting
    const newPosition = currentSelection.index + formattedText.length;
    editor.setSelection(newPosition, 0);
    
    // Update selection immediately after formatting
    setTimeout(() => {
      editor.focus();
      editor.setSelection(newPosition, 0);
    }, 0);
  };

  interface DividerItem {
    type: 'divider';
    format: string;
  }
  
  interface ButtonItem {
    type?: never;
    icon: React.ReactNode;
    tooltip: string;
    format: string;
  }
  
  type ToolbarItem = DividerItem | ButtonItem;
  
  const toolbarItems: ToolbarItem[] = [
    { icon: <FormatBoldIcon />, tooltip: 'Bold', format: 'bold' },
    { icon: <FormatItalicIcon />, tooltip: 'Italic', format: 'italic' },
    { icon: <TitleIcon />, tooltip: 'Heading', format: 'heading' },
    { type: 'divider', format: 'divider' },
    { icon: <FormatListBulletedIcon />, tooltip: 'Bullet List', format: 'bullet' },
    { icon: <FormatListNumberedIcon />, tooltip: 'Numbered List', format: 'number' },
    { icon: <FormatQuoteIcon />, tooltip: 'Quote', format: 'quote' },
    { type: 'divider', format: 'divider' },
    { icon: <CodeIcon />, tooltip: 'Code', format: 'code' },
    { icon: <LinkIcon />, tooltip: 'Link', format: 'link' },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        borderBottom: `1px solid ${theme.palette.mode === 'dark' 
          ? 'rgba(255, 255, 255, 0.05)'
          : 'rgba(0, 0, 0, 0.05)'}`,
        bgcolor: theme.palette.mode === 'dark' 
          ? 'rgba(18, 18, 18, 0.2)'
          : 'rgba(0, 0, 0, 0.02)',
      }}
    >
      {toolbarItems.map((item, index) => (
        item.type === 'divider' ? (
          <Divider 
            orientation="vertical" 
            flexItem 
            key={`divider-${index}`}
            sx={{
              borderColor: theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(0, 0, 0, 0.05)',
              mx: 0.5
            }}
          />
        ) : (
          <Tooltip title={item.tooltip} key={item.format}>
            <IconButton
              size="small"
              onClick={() => insertMarkdown(item.format)}
              sx={{
                padding: '2px',
                color: theme.palette.text.secondary,
                '& .MuiSvgIcon-root': {
                  fontSize: '1.3rem',
                },
                '&:hover': {
                  color: theme.palette.text.primary,
                  bgcolor: theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              {item.icon}
            </IconButton>
          </Tooltip>
        )
      ))}
    </Box>
  );
};

export default MarkdownToolbar;