import dynamic from "next/dynamic";
import React from "react";
const TextEditor = dynamic(() => import("./TextEditor"), { ssr: false });
const ContentText = ({
  uname,
  editorContent,
  setEditorContent,
  fieldId,
  color,
  saveChanges,
}: any) => {
  return (
    <TextEditor
      uname={uname}
      editorContent={editorContent}
      setEditorContent={setEditorContent}
      fieldId={fieldId}
      color={color}
      saveChange={saveChanges}
    />
  );
};

export default ContentText;
