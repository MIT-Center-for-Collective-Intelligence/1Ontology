import admin from "firebase-admin";
import { App, cert, initializeApp } from "firebase-admin/app";
import {
  getFirestore,
} from "firebase-admin/firestore";

export const publicStorageBucket = process.env.ONECADEMYCRED_STORAGE_BUCKET;

require("dotenv").config();

let app: App;
if (!admin.apps.filter((a: any) => a.name === "[DEFAULT]").length) {
  let initializationConfigs: any = {
    credential: cert({
      type: process.env.ONEONTOLOGY_TYPE,
      project_id: process.env.ONEONTOLOGY_PROJECT_ID,
      private_key_id: process.env.ONEONTOLOGY_PRIVATE_KEY_ID,
      private_key: process.env.ONEONTOLOGY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      client_email: process.env.ONEONTOLOGY_CLIENT_EMAIL,
      client_id: process.env.ONEONTOLOGY_CLIENT_ID,
      auth_uri: process.env.ONEONTOLOGY_AUTH_URI,
      token_uri: process.env.ONEONTOLOGY_TOKEN_URI,
      auth_provider_x509_cert_url:
        process.env.ONEONTOLOGY_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.ONEONTOLOGY_CLIENT_X509_CERT_URL,
      storageBucket: process.env.ONEONTOLOGY_STORAGE_BUCKET,
      databaseURL: process.env.ONEONTOLOGY_DATA_BASE_URL,
    } as any),
  };

  if (process.env.NODE_ENV === "test") {
    initializationConfigs = {
      projectId: "test",
      credential: admin.credential.applicationDefault(),
    };
  }
  app = initializeApp(initializationConfigs);
  getFirestore().settings({ ignoreUndefinedProperties: true });
}
export const MAX_TRANSACTION_WRITES = 499;
const db = getFirestore();

export { admin, db, app };
