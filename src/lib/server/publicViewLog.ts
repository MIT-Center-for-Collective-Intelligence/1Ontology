import { db } from "@components/lib/firestoreServer/admin";
import { LOGS } from "@components/lib/firestoreClient/collections";
import {
  buildPublicViewLog,
  PublicViewLogInput,
} from "@components/lib/utils/publicViewLog";

export const savePublicViewLog = async (input: PublicViewLogInput) => {
  const entry = buildPublicViewLog(input);
  if (!entry) return false;
  await db.collection(LOGS).doc().set(entry);
  return true;
};
