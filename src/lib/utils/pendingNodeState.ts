import { doc, setDoc, getDoc, Timestamp, collection as firestoreCollection } from 'firebase/firestore';
import { ICollection, INode } from '@components/types/INode';
import { NODES, TREE_PENDING_CHANGES } from '../firestoreClient/collections';

/**
 * Save the current state of a node's tree-relevant properties to pending changes.
 * This allows other users to sync the latest state of the node.
 */
export const savePendingNodeState = async (
  nodeId: string,
  node: INode | null,
  appName: string,
  db: any
) => {
  // If node not provided, fetch from Firestore
  let nodeData = node;
  if (!nodeData) {
    const nodeRef = doc(firestoreCollection(db, NODES), nodeId);
    const nodeSnap = await getDoc(nodeRef);
    if (!nodeSnap.exists()) {
      return;
    }
    nodeData = { id: nodeSnap.id, ...nodeSnap.data() } as INode;
  }

  // Use nodeId as document ID for easy lookup and updates
  const nodeStateRef = doc(db, TREE_PENDING_CHANGES, nodeId);

  // Match subcollection structure exactly
  const stateData = {
    title: nodeData.title,
    nodeType: nodeData.nodeType,
    specializations: nodeData.specializations || [],
    lastUpdated: Timestamp.now(),
    appName,
  };

  await setDoc(nodeStateRef, stateData);
};

export interface PendingNodeState {
  title: string;
  nodeType: string;
  specializations: ICollection[];
  lastUpdated: any;
  appName: string;
}
