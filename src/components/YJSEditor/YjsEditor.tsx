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
}: {
  fullname: string;
  property: string;
  nodeId: string;
  color: string;
  saveChangeHistory: Function;
}) => {
  return (
    <YjsEditorWrapper
      fullname={fullname}
      property={property}
      nodeId={nodeId}
      color={color}
      saveChangeHistory={saveChangeHistory}
    />
  );
};

export default YjsEditor;
