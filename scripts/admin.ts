import "./load-env";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const initializationConfigs = {
  credential: cert({
    type: process.env.PROD_ONTOLOGY_CRED_TYPE,
    project_id: process.env.PROD_ONTOLOGY_CRED_PROJECT_ID,
    private_key_id: process.env.PROD_ONTOLOGY_CRED_PRIVATE_KEY_ID,
    private_key: process.env.PROD_ONTOLOGY_CRED_PRIVATE_KEY?.replace(
      /\\n/g,
      "\n",
    ),
    client_email: process.env.PROD_ONTOLOGY_CRED_CLIENT_EMAIL,
    client_id: process.env.PROD_ONTOLOGY_CRED_CLIENT_ID,
    auth_uri: process.env.PROD_ONTOLOGY_CRED_AUTH_URI,
    token_uri: process.env.PROD_ONTOLOGY_CRED_TOKEN_URI,
    auth_provider_x509_cert_url:
      process.env.PROD_ONTOLOGY_CRED_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.PROD_ONTOLOGY_CRED_CLIENT_X509_CERT_URL,
  } as any),
};

export const app: any = initializeApp(initializationConfigs, "ontology");
export const db = getFirestore(app);
