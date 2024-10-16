import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { QuillBinding } from "y-quill";
import Quill from "quill";
import QuillCursors from "quill-cursors";
import { Box, Typography } from "@mui/material";
import "quill/dist/quill.snow.css";
import { getFirestore } from "firebase/firestore";
import { recordLogs } from " @components/lib/utils/helpers";
import { capitalizeFirstLetter } from " @components/lib/utils/string.utils";
import { DISPLAY } from " @components/lib/CONSTANTS";

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
  reference,
  breakInheritance,
  text,
  structured,
  checkDuplicateTitle,
}: {
  fullname: string;
  property: string;
  nodeId: string;
  color: string;
  saveChangeHistory: Function;
  reference: string | null;
  breakInheritance: Function;
  text: string;
  structured: boolean;
  checkDuplicateTitle: Function;
}) => {
  const editorContainerRef = useRef(null);
  const editorRef = useRef<Quill | null>(null);
  const yTextRef = useRef<any>(null);
  const referenceRef = useRef(reference);

  const db = getFirestore();
  const TIMEOUT = 15000 + Math.floor(Math.random() * 300);
  const changeHistoryRef = useRef<any[]>([]);

  const [errorDuplicate, setErrorDuplicate] = useState(false);

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

  useEffect(() => {
    referenceRef.current = reference;
  }, [reference]);

  useEffect(() => {
    if (editorContainerRef.current) {
      if (!editorRef.current || !reference) {
        editorRef.current = new Quill(editorContainerRef.current, {
          modules: {
            cursors: true,
            toolbar: false,
            history: {
              userOnly: true,
            },
            clipboard: {
              matchVisual: true,

              matchers: [
                [
                  "span[style], div[style], p[style]",
                  (node: any, delta: any) => {
                    const sanitizedDelta = delta;
                    sanitizedDelta.ops.forEach((op: any) => {
                      if (op.attributes) {
                        delete op.attributes.color;
                        delete op.attributes.background;
                        delete op.attributes.bold;
                        delete op.attributes.italic;
                        delete op.attributes.underline;
                        delete op.attributes.strike;
                        delete op.attributes.font;
                        delete op.attributes.size;
                        delete op.attributes.align;
                        delete op.attributes.indent;
                        delete op.attributes.direction;
                        delete op.attributes.border;
                      }
                    });
                    return sanitizedDelta;
                  },
                ],
              ],
            },
          },
          placeholder: `${capitalizeFirstLetter(
            DISPLAY[property] ? DISPLAY[property] : property
          )}...`,
          theme: "snow",
        });
      }

      if (reference && editorRef.current) {
        editorRef.current.setText(text);
        editorRef.current.on("text-change", (delta, oldDelta, source) => {
          if (referenceRef.current && source === "user") {
            setTimeout(() => {
              if (editorRef.current) {
                const text = editorRef.current?.getText();
                breakInheritance(text);
              }
            }, 100);
          }
        });
        return;
      }
      if (checkDuplicateTitle) {
        setErrorDuplicate(checkDuplicateTitle(text));
      }
    }
  }, [reference, text, breakInheritance, nodeId]);

  useEffect(() => {
    if (!property || !fullname || !nodeId || reference) return;
    const ydoc = new Y.Doc();
    const WS_URL =
      process.env.NODE_ENV === "development"
        ? `ws://${process.env.NEXT_PUBLIC_DEV_WS_SERVER}/ws`
        : `wss://${process.env.NEXT_PUBLIC_WS_SERVER}/ws`;

    const provider = new WebsocketProvider(
      WS_URL,
      `${nodeId}-${property}`,
      ydoc,
      { connect: true, params: { type: structured ? "structured" : "" } }
    );

    const yText = ydoc.getText("quill");
    yTextRef.current = yText;

    if (editorRef.current) {
      const binding = new QuillBinding(
        yText,
        editorRef.current,
        provider.awareness
      );

      const userInfo = {
        name: fullname,
        color: color,
      };
      provider.awareness.setLocalStateField("user", userInfo);
      editorRef.current.on("text-change", (delta, oldDelta, source) => {
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
        }
      });
      const intervalId = setInterval(() => {
        saveChangeLog(changeHistoryRef.current);
        changeHistoryRef.current = [];
      }, TIMEOUT);

      return () => {
        saveChangeLog(changeHistoryRef.current);
        provider.disconnect();
        provider.destroy();
        binding.destroy();

        if (editorRef.current) {
          editorRef.current.off("selection-change");
          editorRef.current.off("text-change");
        }
        clearInterval(intervalId);
      };
    }
  }, [fullname, property, nodeId, reference]);
  return (
    <>
      {errorDuplicate && (
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
          "& .ql-editor.ql-blank::before": {
            color: "gray !important",
          },
        }}
      />
    </>
  );
};

export default YjsEditorWrapper;
