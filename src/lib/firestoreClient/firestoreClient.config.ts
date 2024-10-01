import { initializeApp } from "firebase/app";
export const initializeFirestore = () => {
  if (process.env.NODE_ENV === "development") {
    console.log("In development env");
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_DEV_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_DEV_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_DEV_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_DEV_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_DEV_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_DEV_APP_ID,
    });
  } else {
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_APP_ID,
    });
  }
};
