import { useAuth } from " @components/components/context/AuthContext";
import { NODES } from " @components/lib/firestoreClient/collections";
import { collection, doc, getFirestore } from "firebase/firestore";
import { useCallback, useState } from "react";

export const useCreateActionTrack = () => {
  const [{ user }] = useAuth();
  const db = getFirestore();
  const [lastRecordedMinute, setLastRecordedMinute] = useState<number>(-1);
  const createActionTrack = useCallback(
    async (data: any) => {
      const nreVersionRef = doc(collection(db, NODES));
    },
    [db, user]
  );

  return createActionTrack;
};
