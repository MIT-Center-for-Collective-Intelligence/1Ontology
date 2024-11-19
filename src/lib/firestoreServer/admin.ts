import admin from "firebase-admin";
import { App, cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { development } from "../CONSTANTS";

const configs = development
  ? {
      type: process.env.DEV_ONTOLOGY_CRED_TYPE,
      project_id: process.env.DEV_ONTOLOGY_CRED_PROJECT_ID,
      private_key_id: process.env.DEV_ONTOLOGY_CRED_PRIVATE_KEY_ID,
      private_key: process.env.DEV_ONTOLOGY_CRED_PRIVATE_KEY,
      client_email: process.env.DEV_ONTOLOGY_CRED_CLIENT_EMAIL,
      client_id: process.env.DEV_ONTOLOGY_CRED_CLIENT_ID,
      auth_uri: process.env.DEV_ONTOLOGY_CRED_AUTH_URI,
      token_uri: process.env.DEV_ONTOLOGY_CRED_TOKEN_URI,
      auth_provider_x509_cert_url:
        process.env.DEV_ONTOLOGY_CRED_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.DEV_ONTOLOGY_CRED_CLIENT_X509_CERT_URL,
    }
  : {
      type: process.env.PROD_ONTOLOGY_CRED_TYPE,
      project_id: process.env.PROD_ONTOLOGY_CRED_PROJECT_ID,
      private_key_id: process.env.PROD_ONTOLOGY_CRED_PRIVATE_KEY_ID,
      private_key: process.env.PROD_ONTOLOGY_CRED_PRIVATE_KEY,
      client_email: process.env.PROD_ONTOLOGY_CRED_CLIENT_EMAIL,
      client_id: process.env.PROD_ONTOLOGY_CRED_CLIENT_ID,
      auth_uri: process.env.PROD_ONTOLOGY_CRED_AUTH_URI,
      token_uri: process.env.PROD_ONTOLOGY_CRED_TOKEN_URI,
      auth_provider_x509_cert_url:
        process.env.PROD_ONTOLOGY_CRED_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.PROD_ONTOLOGY_CRED_CLIENT_X509_CERT_URL,
    };

let app: App;
if (!admin.apps.filter((a: any) => a.name === "[DEFAULT]").length) {
  let initializationConfigs: any = {
    credential: cert(configs as any),
  };

  app = initializeApp(initializationConfigs);
  getFirestore().settings({ ignoreUndefinedProperties: true });
}
export const MAX_TRANSACTION_WRITES = 499;
const db = getFirestore();

export { admin, db, app };
