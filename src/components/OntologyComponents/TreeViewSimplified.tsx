import React, { useEffect, useState } from "react";
import { TreeView, TreeItem, treeItemClasses, LoadingButton } from "@mui/lab";
import {
  Box,
  Typography,
  Button,
  Tooltip,
  IconButton,
  TextField,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LockIcon from "@mui/icons-material/Lock";
import { TreeVisual } from " @components/types/INode";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import InsertLinkIcon from "@mui/icons-material/InsertLink";
import AddIcon from "@mui/icons-material/Add";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import DoneIcon from "@mui/icons-material/Done";

type ITreeViewSimplifiedProps = {
  onOpenNodesTree: (nodeId: string) => void;
  treeVisualization: TreeVisual | any;
  expandedNodes: any;
  setExpandedNodes: any;
  currentVisibleNode: any;
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
  cloning?: string | null;
  addACloneNodeQueue?: any;
  isSaving?: any;
  disabledAddButton?: boolean;
  selectedProperty?: string;
  getNumOfGeneralizations?: any;
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
  cloning,
  addACloneNodeQueue,
  isSaving,
  disabledAddButton,
  selectedProperty,
  getNumOfGeneralizations,
}: ITreeViewSimplifiedProps) => {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [addingNew, setAddingNew] = useState(false);
  const sortedKeys = categoriesOrder
    ? Object.keys(treeVisualization).sort((a, b) =>
        categoriesOrder.indexOf(a) !== -1
          ? categoriesOrder.indexOf(b) !== -1
            ? categoriesOrder.indexOf(a) - categoriesOrder.indexOf(b)
            : -1
          : categoriesOrder.indexOf(b) !== -1
            ? 1
            : 0,
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
      sx={{ flexGrow: 1, ...sx, ml: "4px" }}
    >
      {sortedKeys.map((nodeId) => (
        <TreeItem
          key={treeVisualization[nodeId]?.id || nodeId}
          nodeId={treeVisualization[nodeId]?.id || nodeId}
          className={`node-${nodeId}`}
          label={
            <NodeLabel
              currentVisibleNode={currentVisibleNode}
              nodeId={nodeId}
              onOpenNodesTree={onOpenNodesTree}
              treeVisualization={treeVisualization}
              checkedItems={checkedItems}
              markItemAsChecked={markItemAsChecked}
              selectedProperty={selectedProperty}
              clone={clone}
              disabledAddButton={disabledAddButton}
              isSaving={isSaving}
              preventLoops={preventLoops}
              sendNode={sendNode}
              manageLock={manageLock}
              getNumOfGeneralizations={getNumOfGeneralizations}
              setAddingNew={setAddingNew}
              addACloneNodeQueue={addACloneNodeQueue}
              cloning={cloning}
              addingNew={addingNew}
            />
          }
          sx={{
            "& .MuiTreeItem-content.Mui-selected": {
              backgroundColor: "transparent !important",
              "&:hover": {
                backgroundColor: "transparent !important",
              },
            },
            [`& .${treeItemClasses.group}`]: {
              marginLeft: "6px",
              paddingLeft: "6px",
              position: "relative",
              "&::before": {
                content: '""',
                position: "absolute",
                top: "-8px",
                bottom: 0,
                left: 0,
                borderLeft: (theme) => `2px solid #797575`,
              },
            },
            "& .MuiTreeItem-content.Mui-focused": {
              backgroundColor: "transparent !important",
            },

            "& .MuiTreeItem-content": {
              p: 0,
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
                cloning={cloning}
                addACloneNodeQueue={addACloneNodeQueue}
                isSaving={isSaving}
                disabledAddButton={disabledAddButton}
                selectedProperty={selectedProperty}
                getNumOfGeneralizations={getNumOfGeneralizations}
              />
            )}
        </TreeItem>
      ))}
    </TreeView>
  );
};

const NodeLabel = ({
  currentVisibleNode,
  nodeId,
  onOpenNodesTree,
  treeVisualization,
  checkedItems,
  markItemAsChecked,
  selectedProperty,
  clone,
  disabledAddButton,
  isSaving,
  preventLoops,
  sendNode,
  manageLock,
  getNumOfGeneralizations,
  setAddingNew,
  addACloneNodeQueue,
  cloning,
  addingNew,
}: {
  currentVisibleNode: any;
  nodeId: any;
  onOpenNodesTree: any;
  treeVisualization: any;
  checkedItems: any;
  markItemAsChecked: any;
  selectedProperty: any;
  clone: any;
  disabledAddButton: any;
  isSaving: any;
  preventLoops: any;
  sendNode: any;
  manageLock: any;
  getNumOfGeneralizations: any;
  setAddingNew: any;
  addACloneNodeQueue: any;
  cloning: any;
  addingNew: any;
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        py: "8px",
        pr: "8px",
        paddingLeft: "4px",
        borderRadius: "10px",
        backgroundColor:
          currentVisibleNode?.id === nodeId
            ? (theme) => (theme.palette.mode === "dark" ? "#125f07" : "#1fb509")
            : "transparent",
        transition: "background-color 0.2s ease-in-out",
      }}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();

        if (
          currentVisibleNode.id === nodeId &&
          (selectedProperty === "specializations" ||
            selectedProperty === "generalizations")
        ) {
          return;
        }
        if (
          selectedProperty &&
          (disabledAddButton ||
            (selectedProperty === "specializations" &&
              getNumOfGeneralizations(nodeId))) &&
          checkedItems.has(treeVisualization[nodeId]?.id)
        ) {
          return;
        }
        if (
          !treeVisualization[nodeId].isCategory &&
          clone &&
          !treeVisualization[nodeId].unclassified &&
          !preventLoops?.has(treeVisualization[nodeId]?.id)
        ) {
          markItemAsChecked(treeVisualization[nodeId]?.id);
        }
        if (sendNode || clone) return;
        onOpenNodesTree(treeVisualization[nodeId].id);
      }}
    >
      <Typography
        sx={{
          fontWeight: treeVisualization[nodeId].isCategory ? "600" : "400",
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
      {!isSaving &&
        !treeVisualization[nodeId].isCategory &&
        clone &&
        !treeVisualization[nodeId].unclassified &&
        !preventLoops?.has(treeVisualization[nodeId]?.id) && (
          <>
            {manageLock || !treeVisualization[nodeId].locked ? (
              <IconButton
                onClick={(e) => {
                  if (
                    currentVisibleNode.id === nodeId &&
                    (selectedProperty === "specializations" ||
                      selectedProperty === "generalizations")
                  ) {
                    return;
                  }
                  e.stopPropagation();
                  markItemAsChecked(treeVisualization[nodeId]?.id);
                }}
                sx={{
                  borderRadius: "16px",
                  textTransform: "none",
                  // marginLeft: "12px",
                  padding: "3px",
                  fontSize: "0.8rem",
                  backgroundColor:
                    currentVisibleNode?.id === nodeId &&
                    !checkedItems.has(treeVisualization[nodeId]?.id)
                      ? "#E8F5E9"
                      : "",
                  display:
                    (currentVisibleNode.id === nodeId &&
                      (selectedProperty === "specializations" ||
                        selectedProperty === "generalizations")) ||
                    ((disabledAddButton ||
                      (selectedProperty === "specializations" &&
                        getNumOfGeneralizations(nodeId))) &&
                      checkedItems.has(treeVisualization[nodeId]?.id))
                      ? "none"
                      : "",
                }}
                disabled={
                  (currentVisibleNode.id === nodeId &&
                    (selectedProperty === "specializations" ||
                      selectedProperty === "generalizations")) ||
                  ((disabledAddButton ||
                    (selectedProperty === "specializations" &&
                      getNumOfGeneralizations(nodeId))) &&
                    checkedItems.has(treeVisualization[nodeId]?.id))
                }
              >
                <Tooltip
                  title={
                    checkedItems.has(treeVisualization[nodeId]?.id)
                      ? "Unlink"
                      : "Link"
                  }
                  placement="left"
                >
                  {checkedItems.has(treeVisualization[nodeId]?.id) ? (
                    <LinkOffIcon
                      sx={{
                        color: "orange",
                      }}
                    />
                  ) : (
                    <InsertLinkIcon />
                  )}
                </Tooltip>
              </IconButton>
            ) : (
              <LockIcon sx={{ color: "#FF6F00", marginLeft: "12px" }} />
            )}
          </>
        )}

      {!isSaving &&
        clone &&
        !treeVisualization[nodeId].isCategory &&
        !treeVisualization[nodeId].locked &&
        !preventLoops?.has(treeVisualization[nodeId]?.id) && (
          <IconButton
            sx={{
              borderRadius: "16px",
              marginLeft: "3px",
              textTransform: "none",
              fontSize: "0.8rem",
              padding: "0px",
              color: currentVisibleNode?.id === nodeId ? "#251306" : "#388E3C",
              backgroundColor:
                currentVisibleNode?.id === nodeId ? "#E8F5E9" : "",
              "&:hover": {
                borderColor: "#2E7D32",
                backgroundColor:
                  currentVisibleNode?.id === nodeId ? "#388E3C" : "#E8F5E9",
              },
            }}
            onClick={(e) => {
              e.stopPropagation();
              setAddingNew(true);
              // handleCloning(treeVisualization[nodeId]);
              addACloneNodeQueue(nodeId);
              setTimeout(() => {
                setAddingNew(false);
              }, 500);
            }}
            disabled={!!cloning || addingNew}
          >
            <Tooltip title="Add Specialization">
              <AddIcon />
            </Tooltip>
          </IconButton>
        )}

      {sendNode && !treeVisualization[nodeId].isCategory && (
        <Button
          variant="outlined"
          onClick={() => sendNode(treeVisualization[nodeId]?.id || "", nodeId)}
          sx={{
            borderRadius: "16px",
            textTransform: "none",
            fontSize: "0.8rem",
            padding: "2px 12px",
            mr: "15px",
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

      {/*  <Tooltip title="Edit">
      <IconButton
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setEditTitle((prev: string | null) => {
            if (prev === nodeId) {
              setNewText('');
              return null;
            } else {
              setNewText(treeVisualization[nodeId].title);
              return nodeId;
            }
          });
        }}
      >
        {editTitle === nodeId ? (
          <DoneIcon />
        ) : (
          <DriveFileRenameOutlineIcon />
        )}
      </IconButton>
    </Tooltip> */}
    </Box>
  );
};

export default TreeViewSimplified;
