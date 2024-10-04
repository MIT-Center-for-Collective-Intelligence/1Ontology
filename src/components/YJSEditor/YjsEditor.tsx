import dynamic from "next/dynamic";
import React from "react";

const YjsEditorWrapper = dynamic(() => import(".//YjsEditorWrapper"), {
  ssr: false,
});

const YjsEditor = ({
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
  return (
    <YjsEditorWrapper
      uname={uname}
      property={property}
      nodeId={nodeId}
      color={color}
      saveChanges={saveChanges}
    />
  );
};

export default YjsEditor;
