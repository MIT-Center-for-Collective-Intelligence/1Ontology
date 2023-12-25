import { User, UserTheme } from " @components/types/IAuth";
import axios from "axios";
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  query,
  where,
} from "firebase/firestore";

export const signUp = async (name: string, email: string, password: string) => {
  const newUser = await createUserWithEmailAndPassword(
    getAuth(),
    email,
    password
  );
  await updateProfile(newUser.user, { displayName: name });
};

export const signIn = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(
    getAuth(),
    email,
    password
  );
  return userCredential.user;
};

export const sendVerificationEmail = async () => {
  const auth = getAuth();
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
  }
};

// creating a new id token for current user on firebase auth database
// add token as authorization for every request to the server
// validate if user is a valid user
export const idToken = async () => {
  const userToken = await getAuth().currentUser?.getIdToken(
    /* forceRefresh */ true
  );
  axios.defaults.headers.common["authorization"] = userToken || "";
};

export const resetPassword = async (email: string) => {
  await sendPasswordResetEmail(getAuth(), email);
};

export const logout = async () => {
  await signOut(getAuth());
};

export const getIdToken = async (): Promise<string | undefined> => {
  const auth = getAuth();
  const token = auth.currentUser?.getIdToken(/* forceRefresh */ true);
  return token;
  // const userToken = await this.auth.currentUser.getIdToken(/* forceRefresh */ true);
  // axios.defaults.headers.common["Authorization"] = userToken;
};

export const retrieveAuthenticatedUser = async (
  userId: string,
  claims: { [key: string]: boolean }
) => {
  let user: User | null = null;
  let theme: UserTheme = "Dark";
  const db = getFirestore();
  const nodesRef = collection(db, "users");
  const q = query(nodesRef, where("userId", "==", userId), limit(1));
  const userDoc = await getDocs(q);
  if (userDoc.size !== 0) {
    const userData = userDoc.docs[0].data();
    user = {
      userId,
      imageUrl: userData.imageUrl,
      fName: userData.fName,
      lName: userData.lName,
      uname: userData.uname,
      email: userData.email,
      claims,
    };
    theme = userData.theme;
  }

  return {
    user,
    theme,
  };
};
