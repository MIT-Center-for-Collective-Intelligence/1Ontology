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
  return (
    <YjsEditorWrapper
      fullname={fullname}
      property={property}
      nodeId={nodeId}
      color={color}
      saveChangeHistory={saveChangeHistory}
      reference={reference}
      breakInheritance={breakInheritance}
      text={text}
      structured={structured}
      checkDuplicateTitle={checkDuplicateTitle}
    />
  );
};

export default YjsEditor;
