import React from "react";
import { Box, Typography } from "@mui/material";

const HighlightedText = ({
  text,
  highlights,
}: {
  text: string;
  highlights: any;
}) => {
  if (!text) return null;
  text = text.replaceAll("\n", " ");

  let highlightedText = text;

  for (let highlight of highlights) {
    highlightedText = highlightedText.replace(
      highlight.trim(),
      `<span style="color: orange; font-weight: bold;">${highlight}</span>`,
    );
  }

  return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
};

const DocumentViewer = ({
  documentDetails,
  sentences,
}: {
  documentDetails: any;
  sentences: any;
}) => {
  return (
    <Box sx={{ height: "100%", overflow: "auto", width: "100%" }}>
      <Typography sx={{ padding: "4px" }}>
        <HighlightedText text={documentDetails} highlights={sentences} />
      </Typography>
    </Box>
  );
};

export default DocumentViewer;
