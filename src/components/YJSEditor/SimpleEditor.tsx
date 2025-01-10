import dynamic from "next/dynamic";
import React from "react";

const QuillEditor = dynamic(() => import(".//QuillEditor"), {
  ssr: false,
});

const SimpleEditor = ({
  property,
  text,
  breakInheritance,
  nodeId,
  setCursorPosition,
  onEditorReady
}: {
  property: string;
  text: string;
  breakInheritance: (updatedText: string) => void;
  nodeId: string;
  setCursorPosition: Function;
  onEditorReady?: (editor: any) => void;
}) => {
  return (
    <QuillEditor
      property={property}
      text={text}
      breakInheritance={breakInheritance}
      nodeId={nodeId}
      setCursorPosition={setCursorPosition}
      onEditorReady={onEditorReady}
    />
  );
};

export default SimpleEditor;
