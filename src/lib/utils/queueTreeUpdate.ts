import { getAuth } from "firebase/auth";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { TREE_QUEUES } from "../firestoreClient/collections";

// Queue a tree update by writing directly to Firestore.
// This function adds a change record to the queue collection,
// which will be processed by the backend scheduler.
export const queueTreeUpdate = async (
  nodeId: string,
  appName: string
): Promise<void> => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      console.error("[QUEUE] User not authenticated");
      return;
    }

    const db = getFirestore();
    const queueCollection = collection(db, TREE_QUEUES);

    await addDoc(queueCollection, {
      changedNodeId: nodeId,
      appName: appName,
      timestamp: Date.now(),
      processed: false,
    });

    console.log("[QUEUE] Tree update queued successfully:", { nodeId, appName });
  } catch (error) {
    console.error("[QUEUE] Error queuing tree update:", error);
    throw error;
  }
};
