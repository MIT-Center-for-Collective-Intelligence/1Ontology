import { useEffect, useRef } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { Box } from "@mui/material";
import { capitalizeFirstLetter } from " @components/lib/utils/string.utils";
import { DISPLAY } from " @components/lib/CONSTANTS";

const QuillEditor = ({
  property,
  text,
  breakInheritance,
  nodeId,
  setCursorPosition,
}: {
  property: string;
  text: string;
  breakInheritance: (updatedText: string) => void;
  nodeId: string;
  setCursorPosition: Function;
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
        formats: [],
      });

      editorRef.current = editor;

      editor.setText(text);

      editor.on("text-change", () => {
        const updatedText = editor.getText();
        breakInheritance(updatedText);

        const selection = editor.getSelection();
        if (selection) {
          setCursorPosition(selection.index);
        }
      });

      editor.on("selection-change", (range: any) => {
        if (range) {
          setCursorPosition(range.index);
        }
      });

      return () => {
        if (editor) {
          editor.off("text-change");
          editor.off("selection-change");
        }
      };
    }
  }, [nodeId]);

  return (
    <>
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

export default QuillEditor;
