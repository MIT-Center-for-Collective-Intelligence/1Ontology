import React from "react";
import {
  Paper,
  Typography,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DocumentViewer from "./DocumentViewer";

const LinkEditor = ({
  selectedLink,
  nodes,
  selectedDiagram,
  setSelectedLink,
  handleSaveLink,
  deleteLink,
  onCancel,
}: {
  selectedLink: any;
  nodes: any;
  selectedDiagram: any;
  setSelectedLink: any;
  handleSaveLink: any;
  deleteLink: any;
  onCancel: any;
}) => {
  if (!selectedLink) return null;

  return (
    <Box
      sx={{
        overflowY: "auto",
        pr: 1,
        height: "90vh",
        "&::-webkit-scrollbar": {
          display: "none",
        },
        mt: "50px",
      }}
    >
      <Box sx={{ borderRadius: "25px", border: "1px solid gray", p: 3 }}>
        <Typography sx={{ fontWeight: "bold", fontSize: "19px", my: "15px" }}>
          Editing the link:
        </Typography>
        <Box sx={{ display: "flex", my: "15px" }}>
          <Typography>
            <strong style={{ color: "orange" }}>
              {nodes[selectedLink.source]?.label}
            </strong>
          </Typography>
          <ArrowForwardIcon />
          <Typography>
            <strong style={{ color: "orange" }}>
              {nodes[selectedLink.target]?.label}
            </strong>
          </Typography>
        </Box>
        <TextField
          label="Detail"
          variant="outlined"
          value={selectedLink.detail || ""}
          onChange={(e) =>
            setSelectedLink((prev: any) => ({
              ...prev,
              detail: e.target.value,
            }))
          }
          fullWidth
          multiline
          rows={3}
          sx={{ width: "95%", m: 0.5, my: "15px" }}
        />
        <FormControl fullWidth sx={{ my: "15px" }}>
          <InputLabel>Certainty</InputLabel>
          <Select
            value={selectedLink.certainty || ""}
            label="Certainty"
            onChange={(e) =>
              setSelectedLink((prev: any) => ({
                ...prev,
                certainty: e.target.value,
              }))
            }
          >
            {["known", "hypothetical"].map((row) => (
              <MenuItem key={row} value={row}>
                {row}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth sx={{ my: "15px" }}>
          <InputLabel>Polarity</InputLabel>
          <Select
            value={selectedLink.polarity || ""}
            label="Polarity"
            onChange={(e) =>
              setSelectedLink((prev: any) => ({
                ...prev,
                polarity: e.target.value,
              }))
            }
          >
            {["positive", "negative"].map((row) => (
              <MenuItem key={row} value={row}>
                {row}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ display: "flex", gap: "15px" }}>
          <Button
            onClick={handleSaveLink}
            variant="contained"
            sx={{ borderRadius: "25px" }}
          >
            Save
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={deleteLink}
            sx={{ borderRadius: "25px" }}
          >
            Delete Link
          </Button>
          <Button onClick={onCancel} sx={{ borderRadius: "25px" }}>
            Cancel
          </Button>
        </Box>
      </Box>
      {selectedLink?.sentences?.length > 0 &&
        selectedDiagram?.documentDetailed && (
          <Box>
            <Typography sx={{ fontWeight: "bold", mt: "14px", padding: "4px" }}>
              Extracted from the document below and used the following
              sentences:
            </Typography>
            <ul>
              {selectedLink.sentences.map((sentence: string, index: number) => (
                <li key={index}>
                  <Typography sx={{ color: "orange" }}>{sentence}</Typography>
                </li>
              ))}
            </ul>

            {selectedLink.fullConversation && (
              <Paper
                elevation={3}
                sx={{
                  p: 3,
                  mb: 3,
                  borderRadius: 2,
                  backgroundColor: "background.paper",
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: "bold",
                    mb: 2,
                    color: "primary.main",
                  }}
                >
                  Thread Conversation:
                </Typography>
                <DocumentViewer
                  documentDetails={selectedLink.fullConversation}
                  sentences={selectedLink.sentences}
                />
              </Paper>
            )}
            <Paper
              elevation={3}
              sx={{
                p: 3,
                mb: 3,
                borderRadius: 2,
                backgroundColor: "background.paper",
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontWeight: "bold",
                  mb: 2,
                  color: "primary.main",
                }}
              >
                Case description:
              </Typography>
              <DocumentViewer
                documentDetails={selectedDiagram.documentDetailed}
                sentences={selectedLink.sentences}
              />
            </Paper>
            <Paper
              elevation={3}
              sx={{
                p: 3,
                borderRadius: 2,
                backgroundColor: "background.paper",
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontWeight: "bold",
                  mb: 2,
                  color: "primary.main",
                }}
              >
                Problem Statement:
              </Typography>
              <DocumentViewer
                documentDetails={selectedDiagram.problemStatement}
                sentences={selectedLink.sentences}
              />
            </Paper>
          </Box>
        )}
    </Box>
  );
};

export default LinkEditor;
