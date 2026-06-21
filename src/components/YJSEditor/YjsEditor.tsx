import dynamic from "next/dynamic";
import React from "react";

const YjsEditorWrapper = dynamic(() => import(".//YjsEditorWrapper"), {
  ssr: false,
});

const YjsEditor = ({
  fullname,
  username,
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
  fallbackContent,
  placeholder,
}: {
  fullname: string;
  username: string;
  property: string;
  nodeId: string;
  color: string;
  saveChangeHistory: Function;
  structured: boolean;
  checkDuplicateTitle: Function;
  autoFocus: boolean;
  cursorPosition: number | null;
  onEditorReady?: (editor: any) => void;
  setEditorContent: any;
  pendingInheritanceMessage?: any;
  fallbackContent?: string;
  placeholder?: string;
}) => {
  return (
    <YjsEditorWrapper
      fullname={fullname}
      username={username}
      property={property}
      nodeId={nodeId}
      color={color}
      saveChangeHistory={saveChangeHistory}
      structured={structured}
      checkDuplicateTitle={checkDuplicateTitle}
      autoFocus={autoFocus}
      cursorPosition={cursorPosition}
      onEditorReady={onEditorReady}
      setEditorContent={setEditorContent}
      pendingInheritanceMessage={pendingInheritanceMessage}
      fallbackContent={fallbackContent}
      placeholder={placeholder}
    />
  );
};

export default YjsEditor;
