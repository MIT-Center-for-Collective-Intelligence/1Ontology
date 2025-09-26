import dynamic from "next/dynamic";
import React from "react";

const YjsEditorWrapper = dynamic(() => import(".//YjsEditorWrapper"), {
  ssr: false,
});

const YjsEditor = ({
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
  fallbackContent,
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
  onEditorReady?: (editor: any) => void;
  setEditorContent: any;
  fallbackContent?: string;
}) => {
  return (
    <YjsEditorWrapper
      fullname={fullname}
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
      fallbackContent={fallbackContent}
    />
  );
};

export default YjsEditor;
