import React, { useEffect, useState } from "react";
import { TreeView, TreeItem, treeItemClasses } from "@mui/lab";
import { Box, Typography, Checkbox, Button } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { TreeVisual } from " @components/types/INode";
import LockIcon from "@mui/icons-material/Lock";

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
    : Object.keys(treeVisualization).sort();

  useEffect(() => {
    setExpanded(Array.from(expandedNodes));
  }, [expandedNodes]);

  return (
    <TreeView
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpandIcon={<ChevronRightIcon />}
      expanded={expanded} // Use the local expanded state
      onNodeToggle={(event, nodeIds) => {
        setExpanded(nodeIds);
        setExpandedNodes(new Set(nodeIds));
      }}
      disabledItemsFocusable={false}
      defaultEndIcon={<div style={{ width: 24 }} />}
      sx={{ flexGrow: 1 }}
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
                height: "auto",
                overflow: "hidden",
                minHeight: "fit-content",
                p: "10px",
                pl: "9px",
                borderRadius: "5px",
                backgroundColor:
                  currentVisibleNode?.id === treeVisualization[nodeId].id
                    ? "#87D37C"
                    : "",
                justifyContent: sendNode ? "space-between" : undefined,
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();

                if (sendNode || clone) return;
                onOpenNodesTree(treeVisualization[nodeId].id);
              }}
              id={`node-${treeVisualization[nodeId]?.id}`}
            >
              {!treeVisualization[nodeId].isCategory && clone && (
                <>
                  {manageLock || !treeVisualization[nodeId].locked ? (
                    checkedItems.has(treeVisualization[nodeId]?.id) ? (
                      <Checkbox
                        checked={true}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        onChange={(e) => {
                          markItemAsChecked(treeVisualization[nodeId].id);
                        }}
                        name={treeVisualization[nodeId].id}
                      />
                    ) : (
                      <Checkbox
                        checked={false}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        onChange={(e) => {
                          markItemAsChecked(treeVisualization[nodeId].id);
                        }}
                        name={treeVisualization[nodeId].id}
                      />
                    )
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
                  fontWeight: treeVisualization[nodeId].isCategory
                    ? "bold"
                    : "",
                  color:
                    currentVisibleNode?.id === treeVisualization[nodeId].id
                      ? "black"
                      : treeVisualization[nodeId].isCategory
                      ? "orange"
                      : "",

                  ...sx,
                }}
              >
                {nodeId}
              </Typography>

              {clone &&
                !treeVisualization[nodeId].isCategory &&
                !treeVisualization[nodeId].locked && (
                  <Button
                    variant="outlined"
                    sx={{ m: "9px" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloning(treeVisualization[nodeId]);
                    }}
                  >
                    <span style={{ color: "green", paddingInline: "10px" }}>
                      Add Specialization
                    </span>
                  </Button>
                )}
              {sendNode && !treeVisualization[nodeId].isCategory && (
                <Button
                  variant="outlined"
                  onClick={() =>
                    sendNode(treeVisualization[nodeId]?.id || "", nodeId)
                  }
                >
                  Send
                </Button>
              )}
            </Box>
          }
          sx={{
            // borderRadius: "18px",.Mui-expanded
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
              // borderRadius: "18px",
            }, */
            position: "relative",
            [`& .${treeItemClasses.group}`]: {
              borderLeft: `1px solid gray`,
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
              />
            )}
        </TreeItem>
      ))}
    </TreeView>
  );
};

export default TreeViewSimplified;
