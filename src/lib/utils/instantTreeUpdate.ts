import { TreeData, INode } from "@components/types/INode";

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


export const reorderChildInTree = (
  treeData: TreeData[],
  parentNodeId: string,
  childNodeId: string,
  fromCollectionIndex: number,
  toCollectionIndex: number,
  fromIndex: number,
  toIndex: number,
  fromCollectionName?: string,
  toCollectionName?: string
): TreeData[] => {
  return treeData.map(node => {
    if (node.nodeId === parentNodeId && node.children) {
      let newChildren = [...node.children];

      // Helper: Find actual array index of a category node
      const findCategoryNodeIndex = (categoryNode: TreeData): number => {
        return newChildren.findIndex(c => c.id === categoryNode.id);
      };

      // Same collection reorder
      if (fromCollectionIndex === toCollectionIndex) {

        // "main" collection - children are direct (but may be mixed with category nodes)
        if (fromCollectionName === 'main') {

          // Separate category nodes from regular children
          const categories: (TreeData & { originalIndex: number })[] = [];
          const regularChildren: TreeData[] = [];

          newChildren.forEach((child, index) => {
            if (child.category) {
              categories.push({ ...child, originalIndex: index });
            } else {
              regularChildren.push(child);
            }
          });


          // Find and reorder within regular children only
          const childIndex = regularChildren.findIndex(c => c.nodeId === childNodeId);

          if (childIndex !== -1) {
            const [movedChild] = regularChildren.splice(childIndex, 1);
            regularChildren.splice(toIndex, 0, movedChild);

            // Reconstruct children array with categories at their original positions
            const result: TreeData[] = [];
            let regularIndex = 0;
            let categoryIndex = 0;

            for (let i = 0; i < newChildren.length; i++) {
              if (categoryIndex < categories.length && categories[categoryIndex].originalIndex === i) {
                result.push(categories[categoryIndex]);
                categoryIndex++;
              } else {
                if (regularIndex < regularChildren.length) {
                  result.push(regularChildren[regularIndex]);
                  regularIndex++;
                }
              }
            }

            // Add any remaining items
            while (regularIndex < regularChildren.length) {
              result.push(regularChildren[regularIndex]);
              regularIndex++;
            }

            newChildren = result;
          } else {
            console.warn('[REORDER TREE] Child not found!', childNodeId);
          }
        } else {
          // Other collections - children are inside category nodes
          const categoryNode = newChildren.find(c => c.category && c.name === `[${fromCollectionName}]`);

          if (categoryNode && categoryNode.children) {
            const categoryIdx = findCategoryNodeIndex(categoryNode);
            const updatedCategory = { ...categoryNode };
            const categoryChildren = [...categoryNode.children];

            const childIndex = categoryChildren.findIndex(c => c.nodeId === childNodeId);

            if (childIndex !== -1) {
              const [movedChild] = categoryChildren.splice(childIndex, 1);
              categoryChildren.splice(toIndex, 0, movedChild);
              updatedCategory.children = categoryChildren;
              newChildren[categoryIdx] = updatedCategory;
            } else {
              console.warn('[REORDER TREE] Child not found in category!');
            }
          } else {
            console.warn('[REORDER TREE] Category node not found for:', fromCollectionName);
          }
        }
      } else {
        // Different collection move
        let movedChild: TreeData | null = null;

        // Remove from source collection
        if (fromCollectionName === 'main') {
          const childIndex = newChildren.findIndex(c => c.nodeId === childNodeId && !c.category);
          if (childIndex !== -1) {
            [movedChild] = newChildren.splice(childIndex, 1);
          }
        } else {
          const fromCategory = newChildren.find(c => c.category && c.name === `[${fromCollectionName}]`);
          if (fromCategory && fromCategory.children) {
            const fromCategoryIdx = newChildren.findIndex(c => c.id === fromCategory.id);
            const categoryChildren = [...fromCategory.children];
            const childIndex = categoryChildren.findIndex(c => c.nodeId === childNodeId);
            if (childIndex !== -1) {
              [movedChild] = categoryChildren.splice(childIndex, 1);
              newChildren[fromCategoryIdx] = { ...fromCategory, children: categoryChildren };
            } else {
              console.error('[CROSS-COLLECTION] Child not found in category children!');
            }
          } else {
            console.error('[CROSS-COLLECTION] Category not found or has no children!');
          }
        }

        // Add to destination collection
        if (movedChild) {
          if (toCollectionName === 'main') {
            newChildren.splice(toIndex, 0, movedChild);
          } else {
            const toCategory = newChildren.find(c => c.category && c.name === `[${toCollectionName}]`);
            if (toCategory && toCategory.children) {
              const toCategoryIdx = newChildren.findIndex(c => c.id === toCategory.id);
              const categoryChildren = [...toCategory.children];
              categoryChildren.splice(toIndex, 0, movedChild);
              newChildren[toCategoryIdx] = { ...toCategory, children: categoryChildren };
            } else {
              console.error('[CROSS-COLLECTION] Target category not found or has no children!');
            }
          }
        } else {
          console.error('[CROSS-COLLECTION] No child was moved!');
        }
      }

      return { ...node, children: newChildren };
    }

    if (node.children) {
      return {
        ...node,
        children: reorderChildInTree(
          node.children,
          parentNodeId,
          childNodeId,
          fromCollectionIndex,
          toCollectionIndex,
          fromIndex,
          toIndex,
          fromCollectionName,
          toCollectionName
        )
      };
    }
    return node;
  });
};


export const reorderCollectionInTree = (
  treeData: TreeData[],
  parentNodeId: string,
  fromIndex: number,
  toIndex: number,
  fromCollectionName?: string,
  toCollectionName?: string,
  newSpecializations?: any[]
): TreeData[] => {
  return treeData.map(node => {
    if (node.nodeId === parentNodeId && node.children) {
      console.log('[REORDER COLLECTION TREE] Found parent node:', parentNodeId);

      if (!newSpecializations || !fromCollectionName || !toCollectionName) {
        console.warn('[REORDER COLLECTION TREE] Missing required parameters');
        return node;
      }

      // Rebuild children based on the new Firestore order
      const newChildren: TreeData[] = [];

      // Group existing children by collection
      const childrenByCollection: { [key: string]: TreeData[] } = { main: [] };
      const categoryNodesByName: { [key: string]: TreeData } = {};

      node.children.forEach(child => {
        if (child.category) {
          // Store category node
          const collName = child.name.replace(/^\[|\]$/g, '');
          categoryNodesByName[collName] = child;
        } else {
          // These are main collection children (direct children)
          childrenByCollection.main.push(child);
        }
      });

      console.log('[REORDER COLLECTION TREE] Category nodes found:', Object.keys(categoryNodesByName));
      console.log('[REORDER COLLECTION TREE] New specializations order:', newSpecializations.map(s => s.collectionName));

      // Rebuild in Firestore order
      newSpecializations.forEach(spec => {
        const collName = spec.collectionName;

        if (collName === 'main') {
          // Add main collection children directly
          newChildren.push(...childrenByCollection.main);
        } else {
          // Add category node if it exists
          const categoryNode = categoryNodesByName[collName];
          if (categoryNode) {
            newChildren.push(categoryNode);
          }
        }
      });

      console.log('[REORDER COLLECTION TREE] New children order:', newChildren.map(c => c.name || c.nodeId));

      return { ...node, children: newChildren };
    }

    if (node.children) {
      return {
        ...node,
        children: reorderCollectionInTree(
          node.children,
          parentNodeId,
          fromIndex,
          toIndex,
          fromCollectionName,
          toCollectionName,
          newSpecializations
        )
      };
    }
    return node;
  });
};


export const addLinkToNode = (
  treeData: TreeData[],
  nodeId: string,
  linkId: string,
  property: 'specializations' | 'generalizations' | string,
  collectionName: string,
  relatedNodes?: { [id: string]: INode },
  nodeTitle?: string,
  nodeType?: string
): TreeData[] => {

  // For specializations: add as a child to the parent node
  if (property === 'specializations') {
    return treeData.map(node => {
      if (node.nodeId === nodeId) {
        // Check if child already exists (check both nodeId and id for safety)
        const childExists = node.children?.some(child =>
          child.nodeId === linkId || child.id === linkId
        );
        if (childExists) {
          return node;
        }

        // Use provided title/type, fallback to cache, then to linkId
        const linkedNode = relatedNodes?.[linkId];
        const newChild: TreeData = {
          id: linkId,
          nodeId: linkId,
          name: nodeTitle || linkedNode?.title || linkId,
          nodeType: nodeType || linkedNode?.nodeType || '',
          children: []
        };
        return {
          ...node,
          children: [...(node.children || []), newChild]
        };
      }

      if (node.children) {
        return {
          ...node,
          children: addLinkToNode(node.children, nodeId, linkId, property, collectionName, relatedNodes, nodeTitle, nodeType)
        };
      }
      return node;
    });
  }

  // For other properties (parts, etc.), just trigger refresh
  return [...treeData];
};


export const removeLinkFromNode = (
  treeData: TreeData[],
  nodeId: string,
  linkId: string,
  property: 'specializations' | 'generalizations' | string,
  collectionIndex: number
): TreeData[] => {

  // For specializations: remove child from the parent node
  if (property === 'specializations') {
    return treeData.map(node => {
      if (node.nodeId === nodeId) {
        return {
          ...node,
          children: (node.children || []).filter(child => child.nodeId !== linkId)
        };
      }

      if (node.children) {
        return {
          ...node,
          children: removeLinkFromNode(node.children, nodeId, linkId, property, collectionIndex)
        };
      }
      return node;
    });
  }

  // For other properties (parts, etc.), just trigger refresh
  return [...treeData];
};
