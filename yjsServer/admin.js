const { cert, initializeApp } = require("firebase-admin/app");
const { getFirestore, WriteBatch } = require("firebase-admin/firestore");

const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "/", ".env"),
});
const production = false;

const CONFIG_VARIABLES = production
  ? {
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
    }
  : {
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
    };

let initializationConfigs = {
  credential: cert(CONFIG_VARIABLES),
};

const app = initializeApp(initializationConfigs);
getFirestore().settings({ ignoreUndefinedProperties: true });
const db = getFirestore(app);

module.exports = {
  app,
  db,
};
