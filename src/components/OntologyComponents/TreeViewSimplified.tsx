import React, { useEffect, useState } from "react";
import { TreeView, TreeItem } from "@mui/lab";
import { Box, Typography, Checkbox, Button } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { TreeVisual } from " @components/types/INode";

type ITreeViewSimplifiedProps = {
  onOpenNodesTree: (nodeId: string) => void;
  treeVisualization: TreeVisual | any;
  expandedNodes: any;
  currentVisibleNode?: any;
  checkSpecialization?: any;
  checkedSpecializations?: any;
  handleCloning?: any;
  clone?: boolean;
  sx?: any;
  stopPropagation?: string;
};

const TreeViewSimplified = ({
  treeVisualization,
  onOpenNodesTree,
  expandedNodes,
  currentVisibleNode,
  checkSpecialization,
  checkedSpecializations,
  handleCloning,
  clone,
  sx,
  stopPropagation,
}: ITreeViewSimplifiedProps) => {
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    setExpanded(Array.from(expandedNodes));
  }, []);

  return (
    <TreeView
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpandIcon={<ChevronRightIcon />}
      expanded={expanded} // Use the local expanded state
      onNodeToggle={(event, nodeIds) => setExpanded(nodeIds)}
      disabledItemsFocusable={false}
      defaultEndIcon={<div style={{ width: 24 }} />}
      sx={{ flexGrow: 1 }}
    >
      {Object.keys(treeVisualization).map((category) => (
        <TreeItem
          key={treeVisualization[category]?.id || category}
          nodeId={treeVisualization[category]?.id || category}
          label={
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                height: "30px",
                p: "25px",
                pl: "9px",
                borderRadius: "25px",
                backgroundColor:
                  currentVisibleNode?.id === treeVisualization[category].id
                    ? "#87D37C"
                    : "",
              }}
              onClick={(e) => {
                onOpenNodesTree(treeVisualization[category].id);
              }}
            >
              {!treeVisualization[category].isCategory && clone && (
                <Checkbox
                  checked={checkedSpecializations.includes(
                    treeVisualization[category]?.id
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onChange={(e) => {
                    e.stopPropagation();
                    checkSpecialization(treeVisualization[category].id);
                  }}
                  name={treeVisualization[category].id}
                />
              )}
              <Typography
                sx={{
                  fontWeight: treeVisualization[category].isCategory
                    ? "bold"
                    : "",
                  color:
                    currentVisibleNode?.id === treeVisualization[category].id
                      ? "black"
                      : treeVisualization[category].isCategory
                      ? "orange"
                      : "",

                  ...sx,
                }}
              >
                {category}
              </Typography>

              {clone && !treeVisualization[category].isCategory && (
                <Button
                  variant="outlined"
                  sx={{ m: "9px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloning(treeVisualization[category]);
                  }}
                >
                  <span style={{ color: "green", paddingInline: "10px" }}>
                    New
                  </span>
                  {category.split(" ").splice(0, 3).join(" ") +
                    (category.split(" ").length > 3 ? "..." : "")}{" "}
                  <span style={{ color: "green", paddingInline: "10px" }}>
                    {"Specialization "}
                  </span>
                </Button>
              )}
            </Box>
          }
          sx={{
            // borderRadius: "25px",.Mui-expanded
            /*            backgroundColor:
              currentVisibleNode?.id === treeVisualization[category].id
                ? "#87D37C"
                : "", */
            // "& .MuiTreeItem-root": {
            //   backgroundColor: "#f0f0f0",
            // },
            "&.MuiTreeItem-content.Mui-selected": {
              backgroundColor: "red",
            },
            "&.Mui-selected": {
              backgroundColor: "red",
            },
            /*  "&.MuiTreeItem-content": {
              // borderRadius: "25px",
            }, */
          }}
        >
          {Object.keys(treeVisualization[category].specializations).length >
            0 &&
            stopPropagation !== treeVisualization[category].id && (
              <TreeViewSimplified
                treeVisualization={treeVisualization[category].specializations}
                onOpenNodesTree={onOpenNodesTree}
                expandedNodes={expandedNodes}
                currentVisibleNode={currentVisibleNode}
                checkSpecialization={checkSpecialization}
                checkedSpecializations={checkedSpecializations}
                handleCloning={handleCloning}
                clone={clone}
              />
            )}
        </TreeItem>
      ))}
    </TreeView>
  );
};

export default TreeViewSimplified;
