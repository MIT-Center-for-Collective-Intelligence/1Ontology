/*  This is a React component named `TreeViewSimplified` that is used to display a tree view of ontologies. It uses Material UI's `TreeView` and `TreeItem` components to create the tree structure.

Here's a breakdown of the code:

1. Import necessary modules and components: This includes React, Material UI components, and custom components and types.

2. Define the props for the `TreeViewSimplified` component: The component expects three props - `onOpenOntologyTree` (a function that is called when a tree item is clicked), `treeVisualisation` (an object that represents the tree structure), and `expandedOntologies` (an array that contains the ids of the expanded tree items).

3. Define the `TreeViewSimplified` component: This component returns a `TreeView` component. The `TreeView` component has several props such as `defaultCollapseIcon`, `defaultExpandIcon`, `defaultExpanded`, `disabledItemsFocusable`, `defaultEndIcon`, `multiSelect`, and `sx`.

4. Map over the `treeVisualisation` object: For each key in the `treeVisualisation` object, a `TreeItem` component is created. The `TreeItem` component has a `nodeId` prop (which is the id of the tree item), a `label` prop (which is a `Box` component that contains a `Typography` component that displays the tree item's label), and an `sx` prop (which is used to style the `TreeItem` component).

5. Handle click events: When the `Box` component is clicked, the `onOpenOntologyTree` function is called with the id of the tree item and its path.

6. Check if the tree item has children: If the tree item has children (i.e., if the `specializations` object has keys), a recursive call to `TreeViewSimplified` is made with the `specializations` object, the `onOpenOntologyTree` function, and the `expandedOntologies` array.

7. Export the `TreeViewSimplified` component: This allows the component to be used in other parts of the application.*/

import { INodePath, TreeVisual } from " @components/types/INode";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { TreeItem, TreeView } from "@mui/lab";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import React, { useEffect, useState } from "react";

type ITreeViewSimplifiedProps = {
  onOpenNodesTree: (nodeId: string) => void;
  treeVisualization: TreeVisual;
  expandedNodes: any;
  currentVisibleNode: any;
};
const TreeViewSimplified = ({
  treeVisualization,
  onOpenNodesTree,
  expandedNodes,
  currentVisibleNode,
}: ITreeViewSimplifiedProps) => {

  return (
    <TreeView
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpandIcon={<ChevronRightIcon />}
      defaultExpanded={Array.from(expandedNodes)}
      disabledItemsFocusable={false}
      defaultEndIcon={<div style={{ width: 24 }} />}
      multiSelect
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
                borderRadius: "15px",
                backgroundColor:
                  currentVisibleNode?.id === treeVisualization[category].id
                    ? "#87D37C"
                    : "",
              }}
              onClick={() => {
                onOpenNodesTree(treeVisualization[category].id);
              }}
            >
              <Typography
                sx={{
                  fontWeight: treeVisualization[category].isCategory
                    ? "bold"
                    : "",
                  color: treeVisualization[category].isCategory ? "orange" : "",
                }}
              >
                {category}
              </Typography>
            </Box>
          }
          sx={{
            borderRadius: "15px",
            // border: "1px solid #ccc",
            backgroundColor: "transparent",
            mt: "8px",
            mb: "8px",
            mr: "7px",
          }}
        >
          {Object.keys(treeVisualization[category].specializations).length >
            0 && (
            <TreeViewSimplified
              treeVisualization={treeVisualization[category].specializations}
              onOpenNodesTree={onOpenNodesTree}
              expandedNodes={expandedNodes}
              currentVisibleNode={currentVisibleNode}
            />
          )}
        </TreeItem>
      ))}
    </TreeView>
  );
};

export default TreeViewSimplified;
