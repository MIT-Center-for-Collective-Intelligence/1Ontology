import Box from "@mui/material/Box";
import TreeView from "@mui/lab/TreeView";
import TreeItem from "@mui/lab/TreeItem"; // Fixed import - was TreeView instead of TreeItem
import AddBoxIcon from "@mui/icons-material/AddBox";
import IndeterminateCheckBoxIcon from "@mui/icons-material/IndeterminateCheckBox";
import { Typography, IconButton } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { useEffect, useState } from "react";
import Checkbox from "@mui/material/Checkbox"; // Fixed import name - was CheckBox
import { isBoolean } from "lodash";

const CollabTree = ({
  data,
  setData,
  setSelectedGroups,
  selectedGroups,
  diagramId,
}: {
  data: any;
  setData: any;
  setSelectedGroups: any;
  selectedGroups: any;
  diagramId: any;
}) => {
  const handleAddNode = (parentId: string) => {
    setData((prevData: any) => {
      const newData = JSON.parse(JSON.stringify(prevData));

      const addNode = (nodes: any) => {
        nodes.forEach((node: any) => {
          if (node.id === parentId) {
            if (!node.subgroups) node.subgroups = [];
            node.subgroups.push({
              id: Date.now().toString(),
              label: "New Node",
              subgroups: [],
            });
          } else if (node.subgroups) {
            addNode(node.subgroups);
          }
        });
      };
      addNode(newData);
      return newData;
    });
  };

  const handleDeleteNode = (nodeId: string) => {
    setData((prevData: any) => {
      const newData = JSON.parse(JSON.stringify(prevData));

      const deleteNode = (nodes: any, parent = null) => {
        return nodes.filter((node: any) => {
          if (node.id === nodeId) return false;
          if (node.subgroups) node.subgroups = deleteNode(node.subgroups, node);
          return true;
        });
      };

      return deleteNode(newData);
    });
  };

  const renderTree = (groups: any) => (
    <Box sx={{ ml: "7px" }}>
      {groups.map((group: any) => (
        <TreeItem
          key={group.id}
          nodeId={group.id}
          label={
            <Box
              sx={{ display: "flex", gap: "7px", p: 0, ml: "-30px" }}
              onClick={(e) => {
                e.stopPropagation();
                const allGroupsIds = data.map((c: any) => c.id);
                setSelectedGroups((prev: any) => {
                  const _prev = { ...prev };

                  const elementsSet = new Set(
                    !_prev[diagramId] ? allGroupsIds : _prev[diagramId],
                  );
                  if (elementsSet.has(group.id)) {
                    elementsSet.delete(group.id);
                  } else {
                    elementsSet.add(group.id);
                  }
                  _prev[diagramId] = elementsSet;
                  return _prev;
                });
              }}
            >
              <Checkbox
                checked={
                  !selectedGroups[diagramId] ||
                  selectedGroups[diagramId].has(group.id)
                }
                sx={{ p: 0 }}
              />
              <Typography>{group.label}</Typography>
              {/*   <IconButton
                size="small"
                sx={{ ml: "auto" }}
                onClick={e => {
                  e.stopPropagation();
                  handleAddNode(group.id);
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={e => {
                  e.stopPropagation();
                  handleDeleteNode(group.id);
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton> */}
            </Box>
          }
        >
          {group.subgroups && group.subgroups.length > 0
            ? renderTree(group.subgroups)
            : null}
        </TreeItem>
      ))}
    </Box>
  );

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          mb: "5px",
        }}
      >
        <Checkbox
          onClick={(e) => {
            e.stopPropagation();
            const allGroupsIds = data.map((c: any) => c.id);
            setSelectedGroups((prev: any) => {
              const _prev = { ...prev };

              const elementsSet = new Set(
                !_prev[diagramId] ? allGroupsIds : _prev[diagramId],
              );
              const allElementsSet = new Set(allGroupsIds);

              if (allElementsSet.size === elementsSet.size) {
                _prev[diagramId] = new Set();
              } else {
                _prev[diagramId] = allElementsSet;
              }
              return _prev;
            });
          }}
          checked={
            !selectedGroups[diagramId] ||
            data.length === selectedGroups[diagramId].size
          }
        />
        <Typography>Select All</Typography>
      </Box>
      <TreeView>{renderTree(data)}</TreeView>
    </Box>
  );
};

export default CollabTree;
