import React, { useEffect, useRef } from 'react';
import { Box, Divider, Typography, useTheme } from '@mui/material';
import MarkdownRender from './MarkdownRender';
import SimpleEditor from '../YJSEditor/SimpleEditor';
import YjsEditor from '../YJSEditor/YjsEditor';
import MarkdownToolbar from './MarkdownToolbar';
import Quill from 'quill';

interface MarkdownEditorProps {
  content: {
    text: string;
    property: string;
    structured: boolean;
    onSave: (content: string) => void;
  };
  mode: {
    isPreview: boolean;
    useWebsocket: boolean;
    reference: any;
  };
  editor: {
    autoFocus: boolean;
    cursorPosition: any;
    onCursorChange: Function;
    checkDuplicateTitle: Function;
    saveChangeHistory: Function;
  };
  collaborationData: {
    fullName: string;
    nodeId: string;
    randomProminentColor: string;
  };
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  content,
  mode,
  editor,
  collaborationData
}) => {
  const theme = useTheme();
  const editorRef = useRef<Quill | null>(null);

  const handleEditorReady = (textEditor: Quill) => {
    editorRef.current = textEditor;
  };

  return (
    <Box sx={{ width: '100%' }}>
      {mode.isPreview && content.property !== "title" ? (
        <Box sx={{ p: 3 }}>
          <MarkdownRender text={content.text} />
        </Box>
      ) : (
        <>
          {content.property !== "title" && (
            <MarkdownToolbar editor={editorRef.current} />
          )}

          <Box sx={{
            p: 0.5,
            bgcolor: theme.palette.mode === 'dark'
              ? 'rgba(18, 18, 18, 0.2)'
              : 'rgba(0, 0, 0, 0.02)',
          }}>
            {!mode.reference && mode.useWebsocket ? (
              <YjsEditor
                fullname={collaborationData.fullName}
                property={content.property}
                nodeId={collaborationData.nodeId}
                color={collaborationData.randomProminentColor}
                structured={content.structured}
                autoFocus={editor.autoFocus}
                cursorPosition={editor.cursorPosition}
                saveChangeHistory={editor.saveChangeHistory}
                checkDuplicateTitle={editor.checkDuplicateTitle}
                onEditorReady={handleEditorReady}
              />
            ) : (
              <SimpleEditor
                property={content.property}
                text={content.text}
                breakInheritance={content.onSave}
                nodeId={collaborationData.nodeId}
                setCursorPosition={editor.onCursorChange}
                onEditorReady={handleEditorReady}
              />
            )}
          </Box>

          {content.property !== "title" && (
            <>
              <Box>
                <Divider sx={{
                  borderColor: theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'rgba(0, 0, 0, 0.12)'
                }} />
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    ml: 3,
                    mt: 1,
                    mb: 1,
                    color: theme.palette.text.secondary,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    userSelect: 'none'
                  }}
                >
                  Preview
                </Typography>
              </Box>

              <Box sx={{ pt: 0 }}>
                <Box sx={{
                  p: 3,
                  bgcolor: theme.palette.mode === 'dark'
                    ? 'rgba(18, 18, 18, 0.4)'
                    : 'rgba(0, 0, 0, 0.03)',
                }}>
                  <MarkdownRender text={content.text} />
                </Box>
              </Box>
            </>
          )}
        </>
      )}
    </Box>
  );
};

export default MarkdownEditor;