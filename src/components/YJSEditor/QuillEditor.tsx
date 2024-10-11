import { useEffect, useRef } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { Box } from "@mui/material";

const QuillEditor = ({
  property,
  text,
  breakInheritance,
}: {
  property: string;
  text: string;
  breakInheritance: (updatedText: string) => void;
}) => {
  const editorContainerRef = useRef(null);
  const editorRef = useRef<Quill | null>(null);

  useEffect(() => {
    if (editorContainerRef.current) {
      const editor = new Quill(editorContainerRef.current, {
        modules: {
          toolbar: false,
          history: {
            userOnly: true,
          },
        },
        placeholder: "",
        theme: "snow",
      });

      editorRef.current = editor;

      editor.setText(text);

      editor.on("text-change", () => {
        const updatedText = editor.getText();
        breakInheritance(updatedText);
      });

      return () => {
        if (editor) {
          editor.off("text-change");
        }
      };
    }
  }, [text, breakInheritance]);

  return (
    <>
      <Box
        ref={editorContainerRef}
        sx={{
          borderBottomRightRadius: "20px",
          borderBottomLeftRadius: "20px",
          minHeight: "70px",
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

export default QuillEditor;
