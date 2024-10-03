import React, { useEffect, useState } from "react";
import { TreeView, TreeItem } from "@mui/lab";
import { Box, Typography, Checkbox, Button } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { TreeVisual } from " @components/types/INode";
import LockIcon from "@mui/icons-material/Lock";

type ITreeViewSimplifiedProps = {
  onOpenNodesTree: (nodeId: string) => void;
  treeVisualization: TreeVisual | any;
  expandedNodes: any;
  currentVisibleNode?: any;
  markItemAsChecked?: any;
  checkedItems?: any;
  handleCloning?: any;
  clone?: boolean;
  sx?: any;
  stopPropagation?: string;
  searchValue?: string;
  sendNode?: (nodeId: string, title: string) => void;
  manageLock?: boolean;
};

const TreeViewSimplified = ({
  treeVisualization,
  onOpenNodesTree,
  expandedNodes,
  currentVisibleNode,
  markItemAsChecked,
  checkedItems,
  handleCloning,
  clone,
  sx,
  stopPropagation,
  searchValue,
  sendNode,
  manageLock,
}: ITreeViewSimplifiedProps) => {
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    setExpanded(Array.from(expandedNodes));
  }, [expandedNodes]);

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
      {Object.keys(treeVisualization)
        .sort()
        .map((category) => (
          <TreeItem
            key={treeVisualization[category]?.id || category}
            nodeId={treeVisualization[category]?.id || category}
            label={
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  height: "auto",
                  overflow: "hidden",
                  minHeight: "fit-content",
                  p: "10px",
                  pl: "9px",
                  borderRadius: "5px",
                  backgroundColor:
                    currentVisibleNode?.id === treeVisualization[category].id
                      ? "#87D37C"
                      : "",
                  justifyContent: sendNode ? "space-between" : undefined,
                }}
                onClick={(e) => {
                  if (sendNode || clone) return;
                  onOpenNodesTree(treeVisualization[category].id);
                }}
                id={`node-${treeVisualization[category]?.id}`}
              >
                {!treeVisualization[category].isCategory && clone && (
                  <>
                    {manageLock || !treeVisualization[category].locked ? (
                      <Checkbox
                        checked={checkedItems.has(
                          treeVisualization[category]?.id
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        onChange={(e) => {
                          markItemAsChecked(treeVisualization[category].id);
                        }}
                        name={treeVisualization[category].id}
                      />
                    ) : (
                      <LockIcon
                        sx={{
                          color: "orange",
                          mx: "15px",
                        }}
                      />
                    )}
                  </>
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

                {clone &&
                  !treeVisualization[category].isCategory &&
                  !treeVisualization[category].locked && (
                    <Button
                      variant="outlined"
                      sx={{ m: "9px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloning(treeVisualization[category]);
                      }}
                    >
                      <span style={{ color: "green", paddingInline: "10px" }}>
                        Add Specialization
                      </span>
                    </Button>
                  )}
                {sendNode && !treeVisualization[category].isCategory && (
                  <Button
                    variant="outlined"
                    onClick={() =>
                      sendNode(treeVisualization[category]?.id || "", category)
                    }
                  >
                    Send
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
                  treeVisualization={
                    treeVisualization[category].specializations
                  }
                  onOpenNodesTree={onOpenNodesTree}
                  expandedNodes={expandedNodes}
                  currentVisibleNode={currentVisibleNode}
                  markItemAsChecked={markItemAsChecked}
                  checkedItems={checkedItems}
                  handleCloning={handleCloning}
                  clone={clone}
                  sendNode={sendNode}
                  manageLock={manageLock}
                />
              )}
          </TreeItem>
        ))}
    </TreeView>
  );
};

export default TreeViewSimplified;
