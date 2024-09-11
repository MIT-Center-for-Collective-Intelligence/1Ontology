import {
  Firestore,
  collection,
  doc,
  getFirestore,
  updateDoc,
} from "firebase/firestore";

export const NODES = "nodes";
export const LOGS = "logs";
export const CLIENT_ERRORS = "clientErrors";
export const USERS = "users";
export const LOCKS = "locks";

export const updateDocSimple = (
  db: Firestore,
  id: string,
  data: { [key: string]: any }
) => {
  updateDoc(doc(collection(db, NODES), id), data);
};
