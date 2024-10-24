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
              borderLeft: (theme) => `1px solid #797575`,
              marginLeft: "16px",
              paddingLeft: "16px",
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
        padding: "8px 12px",
        transition: "background-color 0.3s",
        py: 1,
        gap: "12px",
        "&:hover": {
          backgroundColor: "rgba(255, 255, 255, 0.1)",
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
          sx={{ borderRadius: "25px", ml: "auto" }}
        >
          {isChecked ? "Unselect" : "Select"}
        </Button>
      ) : (
        <LockIcon sx={{ color: "orange", mx: "15px" }} />
      )}

      {handleCloning && (
        <Button
          variant="outlined"
          sx={{ m: "9px", borderRadius: "25px" }}
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
