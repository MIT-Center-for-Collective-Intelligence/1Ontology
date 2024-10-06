import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { QuillBinding } from "y-quill";
import Quill from "quill";
import QuillCursors from "quill-cursors";
import { Box } from "@mui/material";
import "quill/dist/quill.snow.css";
import { getFirestore } from "firebase/firestore";

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
}: any) => {
  const editorContainerRef = useRef(null);
  const editorRef = useRef<Quill | null>(null);
  const yTextRef = useRef<any>(null);

  const db = getFirestore();
  const TIMEOUT = 15000 + Math.floor(Math.random() * 300);
  const changeHistoryRef = useRef<any[]>([]);

  const saveChangeLog = (changeHistory: any[]) => {
    try {
      if (changeHistory.length > 0) {
        const previousValue = changeHistory[0].previousText;
        const newValue = changeHistory.at(-1).newText;
        saveChangeHistory(previousValue, newValue);
      }
    } catch (error) {}
  };

  useEffect(() => {
    if (!property || !fullname || !nodeId) return;

    const ydoc = new Y.Doc();
    const WS_URL = `ws://${process.env.NEXT_PUBLIC_WS_SERVER}/ws`;

    const provider = new WebsocketProvider(
      WS_URL,
      `${nodeId}-${property}`,
      ydoc,
      { connect: true }
    );

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
        },
        placeholder: "Type something...",
        theme: "snow",
      });

      editorRef.current = editor;

      const binding = new QuillBinding(yText, editor, provider.awareness);

      const userInfo = {
        name: fullname,
        color: color,
      };
      provider.awareness.setLocalStateField("user", userInfo);
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
        }
      });
      const intervalId = setInterval(() => {
        saveChangeLog(changeHistoryRef.current);
        changeHistoryRef.current = [];
      }, TIMEOUT);

      return () => {
        provider.disconnect();
        provider.destroy();
        binding.destroy();
        editor.off("selection-change");
        editor.off("text-change");
        clearInterval(intervalId);
      };
    }
  }, [fullname, property, nodeId]);

  return (
    <>
      <Box
        ref={editorContainerRef}
        sx={{
          borderBottomRightRadius: "25px",
          borderBottomLeftRadius: "25px",
          minHeight: "70px",
          fontSize: property === "title" ? "24px" : "18px",
          marginBottom: "0px",
        }}
      />
    </>
  );
};

export default YjsEditorWrapper;
