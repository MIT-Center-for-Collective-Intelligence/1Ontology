import React, { useEffect, useRef, useState } from "react";
import { Box, Divider, Typography, useTheme } from "@mui/material";
import MarkdownRender from "./MarkdownRender";
import SimpleEditor from "../YJSEditor/SimpleEditor";
import YjsEditor from "../YJSEditor/YjsEditor";
import MarkdownToolbar from "./MarkdownToolbar";
import Quill from "quill";

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
  setEditorContent: any;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  content,
  mode,
  editor,
  collaborationData,
  setEditorContent,
}) => {
  const theme = useTheme();
  const editorRef = useRef<Quill | null>(null);
  const previousModeRef = useRef(mode.isPreview);
  const [selection, setSelection] = useState<{
    index: number;
    length: number;
  } | null>(null);

  const handleEditorReady = (textEditor: Quill) => {
    editorRef.current = textEditor;

    // Add selection change handler
    textEditor.on("selection-change", (range) => {
      if (range) {
        setSelection(range);
      }
    });

    if (previousModeRef.current && !mode.isPreview) {
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus();

          // Restore previous selection if it exists, otherwise select end of content
          if (selection) {
            editorRef.current.setSelection(selection.index, selection.length);
          } else {
            const length = editorRef.current.getText().length;
            editorRef.current.setSelection(length, 0);
          }

          // Update selection after a brief delay
          setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.focus();
              const currentLength = editorRef.current.getText().length;
              editorRef.current.setSelection(currentLength, 0);
            }
          }, 0);
        }
      }, 100);
    }
  };

  // Track mode changes
  useEffect(() => {
    // Store current selection before mode change
    if (editorRef.current && mode.isPreview) {
      const currentSelection = editorRef.current.getSelection();
      if (currentSelection) {
        setSelection(currentSelection);
      }
    }
    previousModeRef.current = mode.isPreview;
  }, [mode.isPreview]);

  return (
    <Box sx={{ width: "100%" }}>
      {mode.isPreview && content.property !== "title" ? (
        <Box
          sx={{
            p: 3,
            userSelect: "text",
            WebkitUserSelect: "text",
            MozUserSelect: "text",
          }}
        >
          <MarkdownRender text={content.text} />
        </Box>
      ) : (
        <>
          {content.property !== "title" && (
            <MarkdownToolbar editor={editorRef.current} selection={selection} />
          )}

          <Box
            sx={{
              p: 0.5,
              bgcolor:
                theme.palette.mode === "dark"
                  ? "rgba(18, 18, 18, 0.2)"
                  : "rgba(0, 0, 0, 0.02)",
            }}
          >
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
                setEditorContent={setEditorContent}
                fallbackContent={content.text}
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

          {content.property !== "title" && !!content.text.trim() && (
            <>
              <Box>
                <Divider
                  sx={{
                    borderColor:
                      theme.palette.mode === "dark"
                        ? "rgba(255, 255, 255, 0.12)"
                        : "rgba(0, 0, 0, 0.12)",
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    ml: 3,
                    mt: 1,
                    mb: 1,
                    color: theme.palette.text.secondary,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    userSelect: "none",
                  }}
                >
                  Preview
                </Typography>
              </Box>

              <Box sx={{ pt: 0 }}>
                <Box
                  sx={{
                    p: 3,
                    bgcolor:
                      theme.palette.mode === "dark"
                        ? "rgba(18, 18, 18, 0.4)"
                        : "rgba(0, 0, 0, 0.03)",
                  }}
                >
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
