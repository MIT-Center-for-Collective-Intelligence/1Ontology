import { MESSAGES } from " @components/lib/firestoreClient/collections";
import { IChat } from " @components/types/IChat";
import {
  collection,
  Firestore,
  //limit,
  onSnapshot,
  //orderBy,
  query,
  //startAfter,
  Unsubscribe,
  where,
} from "firebase/firestore";

export type SnapshotChangesTypes = "added" | "modified" | "removed";

export type chatChange = {
  data: IChat & { id: string };
  type: SnapshotChangesTypes;
};

export const getMessagesSnapshot = (
  db: Firestore,
  data: {
    lastVisible: any;
    nodeId?: string;
    type: string;
  },
  callback: (changes: chatChange[]) => void
): Unsubscribe => {
  const { nodeId, type } = data;
  //const pageSize = 15;

  const messagesRef = collection(db, MESSAGES);

  let q = query(
    messagesRef,
    where("type", "==", type),
    where("deleted", "==", false)
  );

  if (type === "node") {
    q = query(
      messagesRef,
      where("nodeId", "==", nodeId),
      where("deleted", "==", false)
    );
  }

  //   if (lastVisible) {
  //     q = query(
  //         messagesRef,
  //       where("refId", "==", refId),
  //       where("deleted", "==", false),
  //       orderBy("createdAt", "desc"),
  //       startAfter(lastVisible),
  //       limit(pageSize)
  //     );
  //   }

  const killSnapshot = onSnapshot(q, (snapshot) => {
    const docChanges = snapshot.docChanges();

    const actionTrackDocuments: chatChange[] = docChanges.map((change) => {
      const document = change.doc.data() as IChat;
      return {
        type: change.type,
        data: { ...document, id: change.doc.id },
        doc: change.doc,
      };
    });
    callback(actionTrackDocuments);
  });
  return killSnapshot;
};
