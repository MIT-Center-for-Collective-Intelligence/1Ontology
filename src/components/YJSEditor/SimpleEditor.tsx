import dynamic from "next/dynamic";
import React from "react";

const QuillEditor = dynamic(() => import(".//QuillEditor"), {
  ssr: false,
});

const SimpleEditor = ({
  property,
  text,
  breakInheritance,
}: {
  property: string;
  text: string;
  breakInheritance: (updatedText: string) => void;
}) => {
  return (
    <QuillEditor
      property={property}
      text={text}
      breakInheritance={breakInheritance}
    />
  );
};

export default SimpleEditor;
