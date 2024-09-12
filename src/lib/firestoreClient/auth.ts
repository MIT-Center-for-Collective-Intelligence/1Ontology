// Importing necessary modules and functions
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
import { USERS } from "./collections";

// Function to sign up a new user with email and password
export const signUp = async (name: string, email: string, password: string) => {
  const newUser = await createUserWithEmailAndPassword(
    getAuth(),
    email,
    password
  );
  // Updating the profile with the user's name
  await updateProfile(newUser.user, { displayName: name });
};

// Function to sign in a user with email and password
export const signIn = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(
    getAuth(),
    email,
    password
  );
  // Returning the signed in user
  return userCredential.user;
};

// Function to send a verification email to the user
export const sendVerificationEmail = async () => {
  const auth = getAuth();
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
  }
};

// Function to create a new id token for the current user on firebase auth database
// This token is added as authorization for every request to the server
// This validates if the user is a valid user
export const idToken = async () => {
  const userToken = await getAuth().currentUser?.getIdToken(
    /* forceRefresh */ true
  );
  axios.defaults.headers.common["authorization"] = userToken || "";
};

// Function to reset the password of a user
export const resetPassword = async (email: string) => {
  await sendPasswordResetEmail(getAuth(), email);
};

// Function to log out a user
export const logout = async () => {
  await signOut(getAuth());
};

// Function to get the id token of a user
export const getIdToken = async (): Promise<string | undefined> => {
  const auth = getAuth();
  const token = auth.currentUser?.getIdToken(/* forceRefresh */ true);
  return token;
};

// Function to retrieve an authenticated user
export const retrieveAuthenticatedUser = async (
  userId: string,
  claims: { [key: string]: boolean }
) => {
  let user: User | null = null;
  let theme: UserTheme = "Dark";
  const db = getFirestore();
  const q = query(
    collection(db, USERS),
    where("userId", "==", userId),
    limit(1)
  );
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
      rightPanel: userData.rightPanel,
      ...userData,
    };
    theme = userData.theme;
  }

  // Returning the user and theme
  return {
    user,
    theme,
  };
};
