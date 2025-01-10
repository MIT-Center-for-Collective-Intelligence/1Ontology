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
}

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ editor }) => {
  const theme = useTheme();

  const insertMarkdown = (type: string) => {
    if (!editor) return;

    const selection = editor.getSelection();
    if (!selection) return;

    const selectedText = editor.getText(selection.index, selection.length);
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

    switch (type) {
      case 'bullet':
      case 'number': {
        const lines = selectedText.split('\n');
        formattedText = lines.map((line, index) => {
          if (!line.trim()) return line;
          
          // Check for present formats
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
        
        editor.deleteText(selection.index, selection.length);
        editor.insertText(selection.index, formattedText);
        editor.setSelection(selection.index + formattedText.length, 0);
        break;
      }
      case 'bold': {
        if (hasFormatting(selectedText, 'bold')) {
          formattedText = removeFormatting(selectedText, 'bold');
        } else {
          formattedText = `**${selectedText}**`;
        }
        editor.deleteText(selection.index, selection.length);
        editor.insertText(selection.index, formattedText);
        editor.setSelection(selection.index + formattedText.length, 0);
        break;
      }
      case 'italic': {
        if (hasFormatting(selectedText, 'italic')) {
          formattedText = removeFormatting(selectedText, 'italic');
        } else {
          formattedText = `*${selectedText}*`;
        }
        editor.deleteText(selection.index, selection.length);
        editor.insertText(selection.index, formattedText);
        editor.setSelection(selection.index + formattedText.length, 0);
        break;
      }
      case 'heading': {
        if (hasFormatting(selectedText, 'heading')) {
          formattedText = removeFormatting(selectedText, 'heading');
        } else {
          formattedText = `### ${selectedText}`;
        }
        editor.deleteText(selection.index, selection.length);
        editor.insertText(selection.index, formattedText);
        editor.setSelection(selection.index + formattedText.length, 0);
        break;
      }
      case 'quote': {
        if (hasFormatting(selectedText, 'quote')) {
          formattedText = removeFormatting(selectedText, 'quote');
        } else {
          formattedText = `> ${selectedText}`;
        }
        editor.deleteText(selection.index, selection.length);
        editor.insertText(selection.index, formattedText);
        editor.setSelection(selection.index + formattedText.length, 0);
        break;
      }
      case 'code': {
        if (hasFormatting(selectedText, 'code')) {
          formattedText = removeFormatting(selectedText, 'code');
        } else {
          formattedText = `\`${selectedText}\``;
        }
        editor.deleteText(selection.index, selection.length);
        editor.insertText(selection.index, formattedText);
        editor.setSelection(selection.index + formattedText.length, 0);
        break;
      }
      case 'link': {
        if (hasFormatting(selectedText, 'link')) {
          formattedText = removeFormatting(selectedText, 'link');
        } else {
          formattedText = `[${selectedText}](url)`;
        }
        editor.deleteText(selection.index, selection.length);
        editor.insertText(selection.index, formattedText);
        editor.setSelection(selection.index + formattedText.length, 0);
        break;
      }
    }
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