import React, { useState } from "react";
import { TreeView, TreeItem, treeItemClasses } from "@mui/lab";
import { ListItem, Typography, Button } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LockIcon from "@mui/icons-material/Lock";
import { INode } from " @components/types/INode";

const ExpandSearchResult = ({
  searchResultsForSelection,
  markItemAsChecked,
  handleCloning,
  checkedItems,
  user,
  nodes,
}: any) => {
  const [expanded, setExpanded] = useState<string[]>([]);

  const handleNodeToggle = (event: React.SyntheticEvent, nodeIds: string[]) => {
    setExpanded(nodeIds);
  };

  const renderSubNodes = (subNode: any, index: number) => (
    <TreeItem
      key={`${subNode.id}-${index}`}
      nodeId={`${subNode.id}-${index}`}
      label={
        <NodeLabel
          node={{ id: subNode.id, title: nodes[subNode.id].title }}
          markItemAsChecked={markItemAsChecked}
          checkedItems={checkedItems}
          user={user}
        />
      }
    />
  );

  return (
    <TreeView
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpandIcon={<ChevronRightIcon />}
      onNodeToggle={handleNodeToggle}
      expanded={expanded}
      sx={{ flexGrow: 1 }}
    >
      {searchResultsForSelection.map((node: INode, index: number) => (
        <TreeItem
          key={`${node.id}-${index}`}
          nodeId={`${node.id}-${index}`}
          label={
            <NodeLabel
              node={node}
              markItemAsChecked={markItemAsChecked}
              checkedItems={checkedItems}
              user={user}
              handleCloning={handleCloning}
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
                top: "-12px",
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
          {(node.specializations[0]?.nodes || []).map(renderSubNodes)}
        </TreeItem>
      ))}
    </TreeView>
  );
};

const NodeLabel = ({
  node,
  markItemAsChecked,
  checkedItems,
  user,
  handleCloning,
}: any) => {
  const isChecked = checkedItems.has(node.id);
  const isLocked = !user?.manageLock && node.locked;

  return (
    <ListItem
      sx={{
        display: "flex",
        alignItems: "center",
        color: "white",
        cursor: "pointer",
        borderRadius: "4px",
        py: "2px",
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
        <Button
          onClick={(e) => {
            e.stopPropagation();
            markItemAsChecked(node.id);
          }}
          variant={isChecked ? "contained" : "outlined"}
          sx={{ borderRadius: "25px", ml: "auto", fontSize: "0.8rem" }}
        >
          {isChecked ? "Unselect" : "Select"}
        </Button>
      ) : (
        <LockIcon sx={{ color: "orange", mx: "15px" }} />
      )}

      {handleCloning && (
        <Button
          variant="outlined"
          sx={{ m: "9px", borderRadius: "25px", fontSize: "0.8rem" }}
          onClick={(e) => {
            e.stopPropagation();
            handleCloning(node);
          }}
        >
          <span style={{ color: "green", paddingInline: "10px" }}>
            Add Specialization
          </span>
        </Button>
      )}
    </ListItem>
  );
};

export default ExpandSearchResult;
