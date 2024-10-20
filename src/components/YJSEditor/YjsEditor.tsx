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
    />
  );
};

export default YjsEditor;
