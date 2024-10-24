import React, { useEffect, useState } from "react";
import { TreeView, TreeItem, treeItemClasses } from "@mui/lab";
import { Box, Typography, Button } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LockIcon from "@mui/icons-material/Lock";
import { TreeVisual } from " @components/types/INode";

type ITreeViewSimplifiedProps = {
  onOpenNodesTree: (nodeId: string) => void;
  treeVisualization: TreeVisual | any;
  expandedNodes: any;
  setExpandedNodes: any;
  currentVisibleNode?: any;
  markItemAsChecked?: any;
  checkedItems?: any;
  handleCloning?: any;
  clone?: boolean;
  sx?: any;
  stopPropagation?: string;
  preventLoops?: Set<string>;
  searchValue?: string;
  sendNode?: (nodeId: string, title: string) => void;
  manageLock?: boolean;
  categoriesOrder?: string[];
};

const TreeViewSimplified = ({
  treeVisualization,
  onOpenNodesTree,
  expandedNodes,
  setExpandedNodes,
  currentVisibleNode,
  markItemAsChecked,
  checkedItems,
  handleCloning,
  clone,
  sx,
  stopPropagation,
  preventLoops,
  searchValue,
  sendNode,
  manageLock,
  categoriesOrder,
}: ITreeViewSimplifiedProps) => {
  const [expanded, setExpanded] = useState<string[]>([]);

  const sortedKeys = categoriesOrder
    ? Object.keys(treeVisualization).sort((a, b) =>
        categoriesOrder.indexOf(a) !== -1
          ? categoriesOrder.indexOf(b) !== -1
            ? categoriesOrder.indexOf(a) - categoriesOrder.indexOf(b)
            : -1
          : categoriesOrder.indexOf(b) !== -1
          ? 1
          : 0
      )
    : Object.keys(treeVisualization);

  useEffect(() => {
    setExpanded(Array.from(expandedNodes));
  }, [expandedNodes]);

  return (
    <TreeView
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpandIcon={<ChevronRightIcon />}
      expanded={expanded}
      onNodeToggle={(event, nodeIds) => {
        setExpanded(nodeIds);
        setExpandedNodes(new Set(nodeIds));
      }}
      sx={{ flexGrow: 1, ...sx }}
    >
      {sortedKeys.map((nodeId) => (
        <TreeItem
          key={treeVisualization[nodeId]?.id || nodeId}
          nodeId={treeVisualization[nodeId]?.id || nodeId}
          label={
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: "4px",
                backgroundColor:
                  currentVisibleNode?.id === treeVisualization[nodeId].id
                    ? (theme) =>
                        theme.palette.mode === "dark" ? "#125f07" : "#1fb509"
                    : "transparent",
                "&:hover": {
                  backgroundColor: "",
                },
                transition: "background-color 0.2s ease-in-out",
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (sendNode || clone) return;
                onOpenNodesTree(treeVisualization[nodeId].id);
              }}
            >
              <Typography
                sx={{
                  fontWeight: treeVisualization[nodeId].isCategory
                    ? "600"
                    : "400",
                  color:
                    currentVisibleNode?.id === treeVisualization[nodeId].id
                      ? "white"
                      : treeVisualization[nodeId].isCategory
                      ? "orange"
                      : "",

                  flex: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {treeVisualization[nodeId].title}
              </Typography>

              {/* Action Buttons */}
              {!treeVisualization[nodeId].isCategory &&
                clone &&
                !treeVisualization[nodeId].unclassified &&
                !preventLoops?.has(treeVisualization[nodeId]?.id) && (
                  <>
                    {manageLock || !treeVisualization[nodeId].locked ? (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          markItemAsChecked(treeVisualization[nodeId]?.id);
                        }}
                        variant={
                          checkedItems.has(treeVisualization[nodeId]?.id)
                            ? "contained"
                            : "outlined"
                        }
                        sx={{
                          borderRadius: "16px",
                          textTransform: "none",
                          marginLeft: "12px",
                          padding: "2px 12px",
                          fontSize: "0.8rem",
                        }}
                      >
                        {checkedItems.has(treeVisualization[nodeId]?.id)
                          ? "Unselect"
                          : "Select"}
                      </Button>
                    ) : (
                      <LockIcon sx={{ color: "#FF6F00", marginLeft: "12px" }} />
                    )}
                  </>
                )}

              {clone &&
                !treeVisualization[nodeId].isCategory &&
                !treeVisualization[nodeId].locked &&
                !preventLoops?.has(treeVisualization[nodeId]?.id) && (
                  <Button
                    variant="outlined"
                    sx={{
                      borderRadius: "16px",
                      marginLeft: "10px",
                      textTransform: "none",
                      fontSize: "0.8rem",
                      padding: "2px 12px",
                      color: "#388E3C",
                      // borderColor: "#388E3C",
                      "&:hover": {
                        borderColor: "#2E7D32",
                        backgroundColor: "#E8F5E9",
                      },
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloning(treeVisualization[nodeId]);
                    }}
                  >
                    Add Specialization
                  </Button>
                )}

              {sendNode && !treeVisualization[nodeId].isCategory && (
                <Button
                  variant="outlined"
                  onClick={() =>
                    sendNode(treeVisualization[nodeId]?.id || "", nodeId)
                  }
                  sx={{
                    borderRadius: "16px",
                    textTransform: "none",
                    fontSize: "0.8rem",
                    padding: "2px 12px",
                    marginLeft: "10px",
                    color: "#0288D1",
                    borderColor: "#0288D1",
                    "&:hover": {
                      backgroundColor: "#E1F5FE",
                    },
                  }}
                >
                  Send
                </Button>
              )}
            </Box>
          }
          sx={{
            "& .MuiTreeItem-content.Mui-selected": {
              backgroundColor: "transparent !important",
              "&:hover": {
                backgroundColor: "transparent !important",
              },
            },
            [`& .${treeItemClasses.group}`]: {
              borderLeft: (theme) => `1px solid #797575`,
              marginLeft: "16px",
              paddingLeft: "16px",
            },
          }}
        >
          {Object.keys(treeVisualization[nodeId].specializations).length > 0 &&
            stopPropagation !== treeVisualization[nodeId].id && (
              <TreeViewSimplified
                treeVisualization={treeVisualization[nodeId].specializations}
                categoriesOrder={treeVisualization[nodeId].categoriesOrder}
                onOpenNodesTree={onOpenNodesTree}
                expandedNodes={expandedNodes}
                setExpandedNodes={setExpandedNodes}
                currentVisibleNode={currentVisibleNode}
                markItemAsChecked={markItemAsChecked}
                checkedItems={checkedItems}
                handleCloning={handleCloning}
                clone={clone}
                sendNode={sendNode}
                manageLock={manageLock}
                stopPropagation={stopPropagation}
                preventLoops={preventLoops}
              />
            )}
        </TreeItem>
      ))}
    </TreeView>
  );
};

export default TreeViewSimplified;
