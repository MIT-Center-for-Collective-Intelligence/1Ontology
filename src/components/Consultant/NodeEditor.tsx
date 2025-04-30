import React from "react";
import {
  Paper,
  Box,
  Typography,
  Checkbox,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from "@mui/material";
import DocumentViewer from "./DocumentViewer";

const NodeEditor = ({
  newNode,
  setNewNode,
  nodeTypes,
  nodes,
  groups,
  handleSave,
  handleClose,
  deleteNode,
  selectedDiagram,
}: {
  newNode: any;
  setNewNode: any;
  nodeTypes: any;
  nodes: any;
  groups: any;
  handleSave: any;
  handleClose: any;
  deleteNode: any;
  selectedDiagram: any;
}) => {
  if (!newNode) return null;

  return (
    <Box
      sx={{
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        borderRadius: "20px",
        height: "90vh",
        "&::-webkit-scrollbar": {
          display: "none",
        },
      }}
    >
      <Box sx={{ border: "1px solid gray", p: 1, borderRadius: "25px" }}>
        <Typography
          sx={{
            paddingBottom: "13px",
            fontWeight: "bold",
            fontSize: "18px",
            ml: "12px",
          }}
        >
          {newNode?.new ? "Add new node:" : `Modify the node `}{" "}
          {newNode.label && (
            <strong style={{ color: "orange" }}>{newNode.label}:</strong>
          )}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", mb: "9px" }}>
          <Checkbox
            checked={newNode.isLeverage}
            onChange={() =>
              setNewNode((prev: any) => ({
                ...prev,
                isLeverage: !prev.isLeverage,
              }))
            }
          />
          <Typography>Leverage node</Typography>
        </Box>
        <TextField
          label="Title"
          variant="outlined"
          value={newNode.label}
          fullWidth
          sx={{ width: "95%", m: 0.5, my: "14px" }}
          onChange={(e) =>
            setNewNode((prev: any) => ({
              ...prev,
              label: e.target?.value || "",
            }))
          }
        />
        <TextField
          label="Leverage Rationale"
          variant="outlined"
          value={newNode.leverageRationale}
          fullWidth
          sx={{ width: "95%", m: 0.5, my: "14px" }}
          onChange={(e) =>
            setNewNode((prev: any) => ({
              ...prev,
              leverageRationale: e.target?.value || "",
            }))
          }
          InputLabelProps={{ shrink: true }}
        />
        <Box sx={{ display: "flex" }}>
          <FormControl sx={{ m: 0.5, width: "25ch" }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={newNode.nodeType.toLowerCase()}
              onChange={(e) =>
                setNewNode((prev: any) => ({
                  ...prev,
                  nodeType: e.target.value,
                }))
              }
            >
              {Object.values(nodeTypes).map((row: any, index) => (
                <MenuItem key={row.type + index} value={row.type.toLowerCase()}>
                  {row.type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ m: 0.5, width: "25ch" }}>
            <InputLabel>Children</InputLabel>
            <Select
              multiple
              value={newNode.children}
              onChange={(e) =>
                setNewNode((prev: any) => ({
                  ...prev,
                  children: e.target.value,
                }))
              }
            >
              {Object.values(nodes).map((node: any) => (
                <MenuItem key={node.id} value={node.id}>
                  {node.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ m: 0.5, width: "25ch" }}>
            <InputLabel>Groups</InputLabel>
            <Select
              multiple
              value={newNode.groups.map((g: any) => g.id)}
              onChange={(e) =>
                setNewNode((prev: any) => ({
                  ...prev,
                  groups: groups.filter((g: any) =>
                    e.target.value.includes(g.id),
                  ),
                }))
              }
            >
              {groups.map((group: any) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Box
          sx={{
            mt: "14px",
            display: "flex",
            gap: "7px",
            width: "500px",
            mx: "14px",
            alignContent: "space-between",
          }}
        >
          <Button
            onClick={handleSave}
            variant="contained"
            sx={{ borderRadius: "25px" }}
            disabled={
              !newNode.label.trim() ||
              !newNode.nodeType.trim() ||
              !newNode.groups.length
            }
          >
            {newNode?.new ? "Add" : "Save"}
          </Button>
          <Button onClick={handleClose} autoFocus sx={{ borderRadius: "25px" }}>
            Cancel
          </Button>
          {!newNode?.new && (
            <Button
              color="error"
              onClick={deleteNode}
              variant="contained"
              sx={{ borderRadius: "25px" }}
            >
              Delete Node
            </Button>
          )}
        </Box>{" "}
      </Box>
      {(newNode?.sentences || []).length > 0 &&
        selectedDiagram?.documentDetailed && (
          <Box sx={{ mt: "16px" }}>
            <Typography sx={{ fontWeight: "bold", mt: "14px", padding: "4px" }}>
              Extracted from the document below and used the following
              sentences:
              <ul>
                {newNode?.sentences.map((c: any, index: number) => (
                  <li key={index}>
                    <Typography sx={{ color: "orange" }}>{c}</Typography>
                  </li>
                ))}
              </ul>
            </Typography>
            {newNode.fullConversation && (
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
                  documentDetails={newNode.fullConversation}
                  sentences={newNode.sentences}
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
                sentences={newNode.sentences}
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
                sentences={newNode.sentences}
              />
            </Paper>
          </Box>
        )}
    </Box>
  );
};

export default NodeEditor;
