import { doc, getDoc, getFirestore, updateDoc } from "firebase/firestore";
import React, { FC, ReactNode, useCallback, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { development } from "@components/lib/CONSTANTS";

type Props = {
  children: ReactNode;
};
const LastDeploymentProvider: FC<Props> = ({ children }) => {
  const db = getFirestore();
  const [{ user }] = useAuth();
  const [lastInteractionDate, setLastInteractionDate] = useState<Date>(
    new Date(Date.now())
  );

  useEffect(() => {
    const handleUserActivity = () => {
      setLastInteractionDate(new Date(Date.now()));
    };
    window.addEventListener("mousemove", handleUserActivity);
    window.addEventListener("keydown", handleUserActivity);
    return () => {
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
    };
  }, []);

  const checkIfDifferentDay = useCallback(async () => {
    if (!user || development) return;

    const userRef = doc(db, "users", user.uname);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      console.error("User document does not exist");
      return;
    }

    const userData = userDoc.data();
    const lastDeployment: any =
      /* await Post("/getLastDeployment") */ new Date();
    const lastCommitTimestamp = new Date(lastDeployment.lastCommitTime);
    const lastUserReload = userData?.lastReload
      ? userData.lastReload.toDate()
      : lastCommitTimestamp;
    const lastCommitTime = lastCommitTimestamp.getTime() + 1000 * 60 * 30;
    const today = new Date();

    if (
      today.getDate() !== lastInteractionDate.getDate() ||
      today.getMonth() !== lastInteractionDate.getMonth() ||
      today.getFullYear() !== lastInteractionDate.getFullYear() ||
      (lastCommitTime > lastUserReload.getTime() &&
        today.getTime() > lastCommitTime)
    ) {
      await updateDoc(userRef, { lastReload: today });
      window.location.reload();
    }
  }, [user, lastInteractionDate]);

  useEffect(() => {
    const intervalId = setInterval(checkIfDifferentDay, 1000 * 60 * 5);

    return () => clearInterval(intervalId);
  }, [checkIfDifferentDay]);

  return <>{children}</>;
};

export { LastDeploymentProvider };
