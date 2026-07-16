import {
  FirebaseApp,
  FirebaseOptions,
  getApps,
  initializeApp,
} from "firebase/app";
import { development } from "../CONSTANTS";

const DEFAULT_APP_NAME = "[DEFAULT]";

const getFirebaseOptions = (): FirebaseOptions =>
  development
    ? {
        apiKey: process.env.NEXT_PUBLIC_DEV_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_DEV_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_DEV_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_DEV_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_DEV_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_DEV_APP_ID,
      }
    : {
        apiKey: process.env.NEXT_PUBLIC_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_APP_ID,
      };

export const initializeFirestore = (): FirebaseApp => {
  const options = getFirebaseOptions();
  const expectedProjectId = options.projectId?.trim();
  if (!expectedProjectId) {
    throw new Error(
      `Missing ${
        development ? "NEXT_PUBLIC_DEV_PROJECT_ID" : "NEXT_PUBLIC_PROJECT_ID"
      } for client Firebase initialization`,
    );
  }

  const existingApp = getApps().find(
    (candidate) => candidate.name === DEFAULT_APP_NAME,
  );
  if (!existingApp) return initializeApp(options);

  const existingProjectId = existingApp.options.projectId?.trim();
  if (existingProjectId !== expectedProjectId) {
    throw new Error(
      `Client Firebase is already initialized for project ${
        existingProjectId || "<unknown>"
      }, but this build expects ${expectedProjectId}. Restart the Next.js server to clear the stale app.`,
    );
  }

  return existingApp;
};
