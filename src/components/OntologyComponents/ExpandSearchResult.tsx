import { SimpleTreeView, TreeItem } from "@mui/x-tree-view";
import {
  ListItem,
  Typography,
  Button,
  IconButton,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LockIcon from "@mui/icons-material/Lock";
import { INode } from "@components/types/INode";
import InsertLinkIcon from "@mui/icons-material/InsertLink";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import React, { useState } from "react";

const ExpandSearchResult = ({
  searchResultsForSelection,
  markItemAsChecked,
  handleCloning,
  checkedItems,
  user,
  nodes,
  cloning,
  isSaving,
  disabledAddButton,
  getNumOfGeneralizations,
  selectedProperty,
  addACloneNodeQueue,
  currentVisibleNode,
}: {
  searchResultsForSelection: any;
  markItemAsChecked: any;
  handleCloning: any;
  checkedItems: any;
  user: any;
  nodes: any;
  cloning: any;
  isSaving: any;
  disabledAddButton: any;
  getNumOfGeneralizations: any;
  selectedProperty: any;
  addACloneNodeQueue: any;
  currentVisibleNode: any;
}) => {
  const [expanded, setExpanded] = useState<string[]>([]);

  const handleNodeToggle = (
    event: React.SyntheticEvent | null,
    nodeIds: string[],
  ) => {
    setExpanded(nodeIds);
  };

  const renderSubNodes = (subNode: any, index: number) => (
    <TreeItem
      key={`${subNode.id}-${index}`}
      itemId={`${subNode.id}-${index}`}
      label={
        <NodeLabel
          node={{ id: subNode.id, title: nodes[subNode.id]?.title }}
          markItemAsChecked={markItemAsChecked}
          checkedItems={checkedItems}
          user={user}
          handleCloning={handleCloning}
          cloning={cloning}
          isSaving={isSaving}
          disabledAddButton={disabledAddButton}
          getNumOfGeneralizations={getNumOfGeneralizations}
          selectedProperty={selectedProperty}
          addACloneNodeQueue={addACloneNodeQueue}
          currentVisibleNode={currentVisibleNode}
        />
      }
    />
  );

  if (!searchResultsForSelection || searchResultsForSelection.length === 0) {
    return (
      <Typography sx={{ p: 2, textAlign: "center", color: "white" }}>
        No results found
      </Typography>
    );
  }

  return (
    <SimpleTreeView
      slots={{ collapseIcon: ExpandMoreIcon, expandIcon: ChevronRightIcon }}
      onExpandedItemsChange={handleNodeToggle}
      expandedItems={expanded}
      sx={{ flexGrow: 1 }}
    >
      {searchResultsForSelection.map((node: INode, index: number) => (
        <TreeItem
          key={`${node.id}-${index}`}
          itemId={`${node.id}-${index}`}
          label={
            <NodeLabel
              node={node}
              markItemAsChecked={markItemAsChecked}
              checkedItems={checkedItems}
              user={user}
              handleCloning={handleCloning}
              cloning={cloning}
              isSaving={isSaving}
              disabledAddButton={disabledAddButton}
              getNumOfGeneralizations={getNumOfGeneralizations}
              selectedProperty={selectedProperty}
              addACloneNodeQueue={addACloneNodeQueue}
              currentVisibleNode={currentVisibleNode}
            />
          }
          sx={{
            "& .MuiTreeItem-content.Mui-selected": {
              backgroundColor: "transparent !important",
              "&:hover": {
                backgroundColor: "transparent !important",
              },
            },
            [`& .MuiTreeItem-group`]: {
              marginLeft: "6px",
              paddingLeft: "6px",
              position: "relative",
              "&::before": {
                content: '""',
                position: "absolute",
                top: "-12px",
                bottom: 0,
                left: 0,
                borderLeft: `2px solid #797575`,
              },
            },
            [`& .MuiTreeItem-groupTransition`]: {
              marginLeft: "10px",
              paddingLeft: "10px",
            },
            "& .MuiTreeItem-content.Mui-focused": {
              backgroundColor: "transparent !important",
            },

            "& .MuiTreeItem-content": {
              p: 0,
              px: 4,
              borderRadius: "25px",
            },
          }}
        >
          {(node.specializations[0]?.nodes || []).map(renderSubNodes)}
        </TreeItem>
      ))}
    </SimpleTreeView>
  );
};

const NodeLabel = ({
  node,
  markItemAsChecked,
  checkedItems,
  user,
  handleCloning,
  cloning,
  isSaving,
  disabledAddButton,
  getNumOfGeneralizations,
  selectedProperty,
  addACloneNodeQueue,
  currentVisibleNode,
}: {
  node: any;
  markItemAsChecked: any;
  checkedItems: any;
  user: any;
  handleCloning: any;
  cloning: any;
  isSaving: any;
  disabledAddButton: any;
  getNumOfGeneralizations: any;
  selectedProperty: any;
  addACloneNodeQueue: any;
  currentVisibleNode: any;
}) => {
  const isChecked = checkedItems.has(node.id);
  const isLocked = !user?.manageLock && node.locked;

  return (
    <ListItem
      sx={{
        display: "flex",
        alignItems: "center",
        color: "white",
        cursor: "pointer",
        // borderRadius: "4px",
        borderRadius: "25px",
        py: "0px",
        px: "0px",
        paddingLeft: "4px",
        transition: "background-color 0.3s",
        gap: "2px",
        "&:hover": {
          backgroundColor: "transparent !important",
        },
      }}
    >
      <Typography variant="body1">{node.title}</Typography>

      {!isLocked ? (
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            markItemAsChecked(node.id);
          }}
          /*           variant={isChecked ? "contained" : "outlined"} */
          sx={{ borderRadius: "25px", ml: "auto", fontSize: "0.8rem" }}
          disabled={
            isChecked &&
            (disabledAddButton ||
              (selectedProperty === "specializations" &&
                getNumOfGeneralizations(node.id)))
          }
        >
          <Tooltip title={isChecked ? "Unlink" : "Link"} placement="left">
            {isChecked ? (
              <LinkOffIcon sx={{ color: isChecked ? "orange" : "" }} />
            ) : (
              <InsertLinkIcon />
            )}
          </Tooltip>
        </IconButton>
      ) : (
        <LockIcon sx={{ color: "orange", mx: "15px" }} />
      )}

      {handleCloning && !isSaving && (
        <Tooltip title={"Add Specialization"}>
          <IconButton
            sx={{
              borderRadius: "16px",
              marginLeft: "3px",
              textTransform: "none",
              fontSize: "0.8rem",
              padding: "0px",
              color: currentVisibleNode?.id === node.id ? "#251306" : "#388E3C",
              backgroundColor:
                currentVisibleNode?.id === node.id ? "#E8F5E9" : "",
              "&:hover": {
                borderColor: "#2E7D32",
                backgroundColor:
                  currentVisibleNode?.id === node.id ? "#388E3C" : "#E8F5E9",
              },
            }}
            onClick={(e) => {
              e.stopPropagation();
              addACloneNodeQueue(node.id);
            }}
            disabled={!!cloning}
          >
            <AddIcon />
          </IconButton>
        </Tooltip>
      )}
    </ListItem>
  );
};

export default ExpandSearchResult;
