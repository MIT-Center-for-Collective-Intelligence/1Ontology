import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { QuillBinding } from "y-quill";
import Quill from "quill";
import QuillCursors from "quill-cursors";
import "quill/dist/quill.snow.css"; // Import Quill's CSS
import { Box } from "@mui/material";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
import { NODES } from " @components/lib/firestoreClient/collections";

Quill.register("modules/cursors", QuillCursors);

const YjsEditorWrapper = ({
  uname,
  property,
  nodeId,
  color,
  saveChanges,
}: {
  uname: string;
  property: string;
  nodeId: string;
  color: string;
  saveChanges: Function;
}) => {
  const editorContainerRef = useRef(null);
  const editorRef = useRef<Quill | null>(null);
  const yTextRef = useRef<any>(null);

  // Fetch initial text content from Firestore
  const loadTextFromFirestore = async (ydoc: Y.Doc) => {
    const db = getFirestore();
    const docRef = doc(db, NODES, nodeId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const inheritance = data.inheritance[property];
      let content =
        property === "title" ? data[property] : data.properties[property];
      if (inheritance?.ref) {
        const _docRef = doc(db, NODES, inheritance.ref);
        const docSnap = await getDoc(_docRef);
        content = docSnap.data()?.properties[property];
        updateDoc(docRef, {
          [`inheritance.${property}.ref`]: null,
          [`properties.${property}`]: content,
        });
      }

      if (content.trim()) {
        console.log(content, "content==>");
        ydoc.getText("quill").insert(0, content);
      }
    } else {
      console.log(
        "No such document in Firestore, initializing a new document."
      );
    }
  };

  useEffect(() => {
    if (!property || !uname || !nodeId) return;
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(
      "ws://websocket-server-163479774214.us-central1.run.app/ws",
      `${nodeId}-${property}`,
      ydoc,
      { connect: true }
    );
    console.log("provider", provider);

    const yText = ydoc.getText("quill");
    yTextRef.current = yText;

    provider.on("sync", async (isSynced: any) => {
      if (isSynced && provider.awareness.getStates().size === 1) {
        console.log(
          "This is the first client, loading initial content from Firestore..."
        );
        await loadTextFromFirestore(ydoc);
      }
    });

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
        name: uname,
        color: color,
      };
      provider.awareness.setLocalStateField("user", userInfo);

      editor.on("text-change", (delta, oldDelta, source) => {
        console.log("editor.getText()", editor.getText(), saveChanges);
        if (saveChanges) {
          saveChanges(editor.getText());
        }
      });

      return () => {
        provider.disconnect();
        provider.destroy();
        binding.destroy();
        editor.off("selection-change");
        editor.off("text-change");
      };
    }
  }, [uname, property, nodeId]);

  return (
    <Box
      ref={editorContainerRef}
      sx={{
        borderBottomRightRadius: "25px",
        borderBottomLeftRadius: "25px",
        minHeight: "70px",
        fontSize: property === "title" ? "24px" : "18px",
      }}
    />
  );
};

export default YjsEditorWrapper;
