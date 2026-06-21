import { capitalizeFirstLetter } from "@components/lib/utils/string.utils";
import { NodeChange } from "@components/types/INode";
import { Box, Paper, Tooltip, Typography } from "@mui/material";
import React from "react";

export const DisplayAddedRemovedProperty = ({
  selectedDiffNode,
}: {
  selectedDiffNode: NodeChange;
}) => {
  return (
    <Paper
      id={`property-${selectedDiffNode.modifiedProperty}`}
      elevation={9}
      sx={{
        borderRadius: "20px",
        /*         minWidth: "500px", */
        width: "100%",
        /*         border: structured ? "1px solid white" : "", */
        border: "3px solid rgb(224, 8, 11)",
        pb: "14px",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          textAlign: "center",
          background: (theme) =>
            theme.palette.mode === "dark" ? "#242425" : "#d0d5dd",
          p: 3,
          pb: 1.5,
          borderTopRightRadius:
            selectedDiffNode.modifiedProperty !== "title" ? "18px" : "",
          borderTopLeftRadius:
            selectedDiffNode.modifiedProperty !== "title" ? "18px" : "",
        }}
      >
        <Typography
          sx={{
            fontSize: "20px",
            fontWeight: 500,
            fontFamily: "Roboto, sans-serif",
          }}
        >
          {capitalizeFirstLetter(selectedDiffNode.modifiedProperty || "")}
        </Typography>
      </Box>
      {/* value */}
      {typeof selectedDiffNode.previousValue === "string" && (
        <Typography>{selectedDiffNode.previousValue}</Typography>
      )}
    </Paper>
  );
};
