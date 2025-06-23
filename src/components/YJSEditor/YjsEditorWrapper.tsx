import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { QuillBinding } from "y-quill";
import Quill from "quill";
import QuillCursors from "quill-cursors";
import { Box, Typography } from "@mui/material";
import "quill/dist/quill.snow.css";
import { recordLogs } from "@components/lib/utils/helpers";
import { capitalizeFirstLetter } from "@components/lib/utils/string.utils";
import { DISPLAY, WS_URL } from "@components/lib/CONSTANTS";

Quill.register("modules/cursors", QuillCursors);

const applyDeltaToText = (text: string, delta: any) => {
  const ops = delta.ops;
  let result = text;
  let index = 0;

  for (const op of ops) {
    if (op.retain) {
      index += op.retain;
    }
    if (op.insert) {
      result = result.slice(0, index) + op.insert + result.slice(index);
      index += op.insert.length;
    }
    if (op.delete) {
      result = result.slice(0, index) + result.slice(index + op.delete);
    }
  }
  return result;
};

const YjsEditorWrapper = ({
  fullname,
  property,
  nodeId,
  color,
  saveChangeHistory,
  structured,
  checkDuplicateTitle,
  autoFocus,
  cursorPosition,
  onEditorReady,
  setEditorContent,
  pendingInheritanceMessage,
}: {
  fullname: string;
  property: string;
  nodeId: string;
  color: string;
  saveChangeHistory: Function;
  structured: boolean;
  checkDuplicateTitle: Function;
  autoFocus: boolean;
  cursorPosition: number | null;
  onEditorReady?: (editor: Quill) => void;
  setEditorContent: any;
  pendingInheritanceMessage?: any;
}) => {
  const editorContainerRef = useRef(null);
  const editorRef = useRef<Quill | null>(null);
  const yTextRef = useRef<any>(null);
  // const TIMEOUT = 15000 + Math.floor(Math.random() * 300);
  const changeHistoryRef = useRef<any[]>([]);
  const [errorDuplicate, setErrorDuplicate] = useState(false);
  const [synced, setSynced] = useState(false);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);

  const saveChangeLog = (changeHistory: any[]) => {
    try {
      if (changeHistory.length > 0) {
        const previousValue = changeHistory[0].previousText;
        const newValue = changeHistory.at(-1).newText;
        if (previousValue !== newValue) {
          saveChangeHistory(previousValue, newValue);
        }
      }
    } catch (error: any) {
      console.error(error);
      recordLogs({
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "saveChangeLog",
      });
    }
  };

  const focus = (cursorPosition: number | null) => {
    if (editorRef.current && cursorPosition !== null) {
      editorRef.current.focus();
      editorRef.current.setSelection(cursorPosition);
    }
  };

  // Reset error when nodeId changes (switching nodes)
  useEffect(() => {
    setErrorDuplicate(false);
  }, [nodeId]);

  useEffect(() => {
    if (!property || !fullname || !nodeId) return;
    // Create Yjs document and WebSocket provider
    const ydoc = new Y.Doc();

    const provider = new WebsocketProvider(
      WS_URL,
      `${nodeId}-${property}`,
      ydoc,
      {
        connect: true,
        params: {
          type: structured ? "structured" : "non-structured",
        },
      },
    );

    // Store provider references
    providerRef.current = provider;
    docRef.current = ydoc;

    provider.on("sync", (isSynced: boolean) => {
      if (isSynced) {
        setSynced(true);

        // Initial check for duplicates when document first loads
        if (property === "title") {
          const initialText = ydoc.getText("quill").toString();
          const isDuplicate = checkDuplicateTitle(initialText);

          setErrorDuplicate(isDuplicate);
        }
      }
    });

    const yText = ydoc.getText("quill");
    yTextRef.current = yText;

    if (editorContainerRef.current) {
      const editor = new Quill(editorContainerRef.current, {
        modules: {
          cursors: true,
          toolbar: false,
          history: {
            userOnly: true,
          },
          clipboard: {
            matchVisual: false,
            matchers: [
              [
                "span[style], div[style], p[style]",
                (node: any, delta: any) => {
                  const text = node.innerText;
                  return {
                    ops: [{ insert: text }],
                  };
                },
              ],
            ],
          },
        },
        placeholder: `${capitalizeFirstLetter(
          DISPLAY[property] ? DISPLAY[property] : property,
        )}...`,
        theme: "snow",
        formats: [],
      });

      editorRef.current = editor;

      // Notify parent when editor is ready
      if (onEditorReady) {
        onEditorReady(editor);
      }

      const binding = new QuillBinding(yText, editor, provider.awareness);

      provider.awareness.setLocalStateField("user", {
        name: fullname,
        color: color,
      });

      editor.on("text-change", (delta, oldDelta, source) => {
        if (source === "user") {
          const previousText = (oldDelta.ops[0].insert || "") as string;
          const newText = applyDeltaToText(previousText, delta);
          const newChange = {
            delta,
            timestamp: new Date().toISOString(),
            user: fullname,
            oldDelta,
            previousText,
            newText,
          };
          changeHistoryRef.current = [...changeHistoryRef.current, newChange];

          if (property === "title") {
            setErrorDuplicate(checkDuplicateTitle(newText));
          }
          setEditorContent(newText);
        }
      });

      // const intervalId = setInterval(() => {
      //   saveChangeLog(changeHistoryRef.current);
      //   changeHistoryRef.current = [];
      // }, TIMEOUT);

      const saveChanges = () => {
        saveChangeLog(changeHistoryRef.current);
        changeHistoryRef.current = [];
      };

      const handleSelectionChange = (
        range: Range | null,
        oldRange: Range | null,
        source: string,
      ) => {
        // On blur
        if (range === null && oldRange !== null) {
          saveChanges();
        }
      };

      editor.on("selection-change", handleSelectionChange);

      window.addEventListener("beforeunload", saveChanges);

      return () => {
        saveChangeLog(changeHistoryRef.current);
        provider.disconnect();
        provider.destroy();
        binding.destroy();
        editor.off("selection-change", handleSelectionChange);
        editor.off("text-change");
        window.removeEventListener("beforeunload", saveChanges);
        
        // Clear provider references
        providerRef.current = null;
        docRef.current = null;
      };
    }
    // Not adding checkDuplicateTitle to dependencies to prevent focus loss during typing
  }, [fullname, property, nodeId, structured]);

  // Effect to send inheritance change message
  useEffect(() => {
    if (pendingInheritanceMessage && providerRef.current?.awareness) {
      try {
        // Send the inheritance change message via awareness
        providerRef.current.awareness.setLocalStateField('inheritanceChange', pendingInheritanceMessage);
        
        // Clear the message after a short delay
        setTimeout(() => {
          if (providerRef.current?.awareness) {
            providerRef.current.awareness.setLocalStateField('inheritanceChange', null);
          }
        }, 1000);
        
      } catch (error) {
        console.error('[YjsEditor] Error sending inheritance message:', error);
      }
    } else if (pendingInheritanceMessage) {
      console.error(`[YjsEditor] Cannot send inheritance message - provider not ready yet`);
    }
  }, [pendingInheritanceMessage]);

  useEffect(() => {
    if (synced && autoFocus && editorRef.current) {
      setTimeout(() => {
        focus(cursorPosition);
      }, 1000);
    }
  }, [synced, autoFocus, cursorPosition]);

  return (
    <>
      {property === "title" && errorDuplicate && (
        <Typography color="red" sx={{ ml: "15px" }}>
          There is already a node with this title! Please try to create a unique
          title.
        </Typography>
      )}

      <Box
        ref={editorContainerRef}
        sx={{
          borderBottomRightRadius: "20px",
          borderBottomLeftRadius: "20px",
          minHeight: "70px",
          border: "none !important",
          fontSize:
            property === "title" ? "24px !important" : "18px !important",
        }}
      />
    </>
  );
};

export default YjsEditorWrapper;
