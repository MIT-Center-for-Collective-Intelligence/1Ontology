import { useState, useEffect } from "react";
import { collection, query, getDocs, getFirestore } from "firebase/firestore";
import { User } from "@components/types/IAuth";

let usersCache: { [key: string]: User } | null = null;

// Fetch users data once and share across all PropertyContributors components through cache
export const useUsers = () => {
  const [usersData, setUsersData] = useState<{ [key: string]: User }>(
    usersCache || {},
  );
  const [isLoading, setIsLoading] = useState(!usersCache);

  useEffect(() => {
    const fetchUsers = async () => {
      // returns when user data already exists
      if (usersCache) return;

      const db = getFirestore();
      const usersQuery = query(collection(db, "users"));

      try {
        const querySnapshot = await getDocs(usersQuery);
        const users: { [key: string]: User } = {};

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          users[doc.id] = {
            userId: doc.id,
            imageUrl: data.imageUrl || "",
            fName: data.fName || "",
            lName: data.lName || "",
            uname: doc.id,
            email: data.email || "",
            claims: data.claims || {},
            rightPanel: data.rightPanel || false,
            currentNode: data.currentNode || {},
            manageLock: data.manageLock || false,
            copilot: data.copilot || false,
            admin: data.admin || false,
          };
        });

        usersCache = users;
        setUsersData(users);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  return { usersData, isLoading };
};
