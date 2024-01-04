import { TreeVisual } from " @components/types/IOntology";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { TreeItem, TreeView } from "@mui/lab";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import React, { useEffect, useState } from "react";

type ITreeViewSimplifiedProps = {
  onOpenOntologyTree: (ontologyId: string, path: string[]) => void;
  treeVisualisation: TreeVisual;
};
const TreeViewSimplified = ({
  treeVisualisation,
  onOpenOntologyTree,
}: ITreeViewSimplifiedProps) => {
  const [expandedNodes, setExpandedNodes] = useState<any>([]);

  useEffect(() => {
    const updatedExpandedNodes = calculateExpandedNodes(treeVisualisation);
    setExpandedNodes(updatedExpandedNodes);
  }, [treeVisualisation]);

  const calculateExpandedNodes = (specializations: any) => {
    const updatedExpandedNodes: any = [];

    Object.keys(specializations).forEach((category) => {
      updatedExpandedNodes.push(specializations[category]?.id || category);

      if (Object.keys(specializations[category].specializations).length > 0) {
        const childExpandedNodes = calculateExpandedNodes(
          specializations[category].specializations
        );
        updatedExpandedNodes.push(...childExpandedNodes);
      }
    });

    return updatedExpandedNodes;
  };

  return (
    <TreeView
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpandIcon={<ChevronRightIcon />}
      defaultExpanded={expandedNodes}
      disabledItemsFocusable={false}
      defaultEndIcon={<div style={{ width: 24 }} />}
      multiSelect
      sx={{ flexGrow: 1 }}
    >
      {Object.keys(treeVisualisation).map((category) => (
        <TreeItem
          key={treeVisualisation[category]?.id || category}
          nodeId={treeVisualisation[category]?.id || category}
          label={
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                height: "30px",
                p: "17px",
                pl: "0px",
                mt: "9px",
              }}
              onClick={() => {
                onOpenOntologyTree(
                  treeVisualisation[category].id,
                  treeVisualisation[category]?.path || []
                );
              }}
            >
              <Typography
                sx={{
                  fontWeight: treeVisualisation[category].isCategory
                    ? "bold"
                    : "",
                  color: treeVisualisation[category].isCategory ? "orange" : "",
                }}
              >
                {!treeVisualisation[category].isCategory
                  ? category.split(" ").splice(0, 3).join(" ") +
                    (category.split(" ").length > 3 ? "..." : "")
                  : category}
              </Typography>
            </Box>
          }
          sx={{
            borderRadius: "8px",
            // border: "1px solid #ccc",
            backgroundColor: "transparent",
            mt: "8px",
            mb: "8px",
            mr: "7px",
          }}
        >
          {Object.keys(treeVisualisation[category].specializations).length >
            0 && (
            <TreeViewSimplified
              treeVisualisation={treeVisualisation[category].specializations}
              onOpenOntologyTree={onOpenOntologyTree}
            />
          )}
        </TreeItem>
      ))}
    </TreeView>
  );
};

export default TreeViewSimplified;
