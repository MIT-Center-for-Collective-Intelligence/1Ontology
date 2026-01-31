import { TreeData } from "@components/types/INode";

export const updateNodeInTree = (
  treeData: TreeData[],
  nodeId: string,
  updates: Partial<TreeData>
): TreeData[] => {
  return treeData.map(node => {
    // Check if this is the node to update (by nodeId, not path-based id)
    if (node.nodeId === nodeId) {
      return { ...node, ...updates };
    }
    // Recursively update children
    if (node.children) {
      return { ...node, children: updateNodeInTree(node.children, nodeId, updates) };
    }
    return node;
  });
};


export const reorderChildrenInTree = (
  treeData: TreeData[],
  parentNodeId: string,
  fromIndex: number,
  toIndex: number
): TreeData[] => {
  return treeData.map(node => {
    if (node.nodeId === parentNodeId && node.children) {
      const newChildren = [...node.children];
      const [movedNode] = newChildren.splice(fromIndex, 1);
      newChildren.splice(toIndex, 0, movedNode);
      return { ...node, children: newChildren };
    }
    if (node.children) {
      return {
        ...node,
        children: reorderChildrenInTree(node.children, parentNodeId, fromIndex, toIndex)
      };
    }
    return node;
  });
};


export const moveNodeInTree = (
  treeData: TreeData[],
  nodeId: string,
  fromParentId: string,
  toParentId: string,
  toIndex: number
): TreeData[] => {
  let movedNode: TreeData | null = null;

  // First pass: remove from old parent
  const removeNode = (nodes: TreeData[]): TreeData[] => {
    return nodes.map(node => {
      if (node.nodeId === fromParentId && node.children) {
        const childIndex = node.children.findIndex(c => c.nodeId === nodeId);
        if (childIndex !== -1) {
          movedNode = node.children[childIndex];
          const newChildren = [...node.children];
          newChildren.splice(childIndex, 1);
          return { ...node, children: newChildren };
        }
      }
      if (node.children) {
        return { ...node, children: removeNode(node.children) };
      }
      return node;
    });
  };

  let result = removeNode(treeData);

  if (!movedNode) {
    console.warn(`[INSTANT UPDATE] Node ${nodeId} not found in parent ${fromParentId}`);
    return treeData; // Node not found, return original
  }

  // Second pass: add to new parent
  const addNode = (nodes: TreeData[]): TreeData[] => {
    return nodes.map(node => {
      if (node.nodeId === toParentId && node.children) {
        const newChildren = [...node.children];
        newChildren.splice(toIndex, 0, movedNode!);
        return { ...node, children: newChildren };
      }
      if (node.children) {
        return { ...node, children: addNode(node.children) };
      }
      return node;
    });
  };

  return addNode(result);
};


export const addNodeToTree = (
  treeData: TreeData[],
  parentNodeId: string,
  newNode: TreeData,
  index?: number
): TreeData[] => {
  return treeData.map(node => {
    if (node.nodeId === parentNodeId) {
      const newChildren = [...(node.children || [])];
      if (index !== undefined) {
        newChildren.splice(index, 0, newNode);
      } else {
        newChildren.push(newNode);
      }
      return { ...node, children: newChildren };
    }
    if (node.children) {
      return { ...node, children: addNodeToTree(node.children, parentNodeId, newNode, index) };
    }
    return node;
  });
};


export const removeNodeFromTree = (
  treeData: TreeData[],
  nodeId: string
): TreeData[] => {
  return treeData
    .filter(node => node.nodeId !== nodeId)
    .map(node => {
      if (node.children) {
        return { ...node, children: removeNodeFromTree(node.children, nodeId) };
      }
      return node;
    });
};


export const batchUpdateNodesInTree = (
  treeData: TreeData[],
  updates: { [nodeId: string]: Partial<TreeData> }
): TreeData[] => {
  return treeData.map(node => {
    const nodeUpdates = updates[node.nodeId!];
    const updatedNode = nodeUpdates ? { ...node, ...nodeUpdates } : node;

    if (updatedNode.children) {
      return { ...updatedNode, children: batchUpdateNodesInTree(updatedNode.children, updates) };
    }
    return updatedNode;
  });
};
