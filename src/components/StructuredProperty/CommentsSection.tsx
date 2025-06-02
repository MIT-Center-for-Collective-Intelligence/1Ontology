import React, { useState } from "react";
import { Box, Typography, Button } from "@mui/material";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import MarkdownRender from "../Markdown/MarkdownRender";

const CommentsSection = ({
  handleCloseAddLinksModel,
  property,
  onGetPropertyValue,
}: any) => {
  const [showComments, setShowComments] = useState(false);
  const commentText = onGetPropertyValue(property, true).trim();

  if (!handleCloseAddLinksModel || !commentText) return null;

  return (
    <Box sx={{ p: 4, mt: "10px", position: "relative" }}>
      <Box
        sx={{ pb: "7px", position: "absolute", top: -16, left: 24, zIndex: 1 }}
      >
        <Button
          variant="contained"
          size="medium"
          onClick={() => setShowComments((prev) => !prev)}
          endIcon={showComments ? <ExpandLess /> : <ExpandMore />}
          sx={{
            textTransform: "none",
            fontWeight: "bold",
            fontSize: "15px",
            borderRadius: "20px",
            background: "linear-gradient(135deg, #2196F3 0%, #21CBF3 100%)",
            color: "#fff",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            transition: "all 0.3s ease",
            "&:hover": {
              background: "linear-gradient(135deg, #1E88E5 0%, #1DE9B6 100%)",
              boxShadow: "0 6px 25px rgba(0, 0, 0, 0.2)",
            },
          }}
        >
          {showComments ? "Hide Comments" : "Show Comments"}
        </Button>
      </Box>

      {showComments && (
        <Box
          sx={{
            border: "2px solid #e0e0e0",
            borderRadius: "12px",
            p: 3,
            backgroundColor: (theme) =>
              theme.palette.mode === "light" ? "#fafafa" : "",
          }}
        >
          <MarkdownRender text={commentText} />
        </Box>
      )}
    </Box>
  );
};

export default CommentsSection;
