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

export type notificationChange = {
  data: IChat & { id: string };
  type: SnapshotChangesTypes;
};

export const getNotificationsSnapshot = (
  db: Firestore,
  data: {
    lastVisible: any;
    uname: string;
  },
  callback: (changes: notificationChange[]) => void
): Unsubscribe => {
  const { uname } = data;
  //const pageSize = 15;

  const messagesRef = collection(db, "notifications");

  const q = query(
    messagesRef,
    where("user", "==", uname),
    where("seen", "==", false)
  );

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

    const actionTrackDocuments: notificationChange[] = docChanges.map(
      (change) => {
        const document = change.doc.data() as IChat;
        return {
          type: change.type,
          data: { ...document, id: change.doc.id },
          doc: change.doc,
        };
      }
    );
    callback(actionTrackDocuments);
  });
  return killSnapshot;
};
