import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const app = initializeApp({
  apiKey: "AIzaSyDLai5Nmxp0el8BoQFpDF3e5WIcTSrZfrU",
  authDomain: "ontology-41607.firebaseapp.com",
  projectId: "ontology-41607",
  storageBucket: "ontology-41607.appspot.com",
  messagingSenderId: "163479774214",
  appId: "1:163479774214:web:f6805c87b6d4676f32cf87",
  measurementId: "G-R1G6CLG68D",
});
export const messaging = async () => (await isSupported()) && getMessaging(app);
export const db = getFirestore(app);
export const initializeFirestore = () => {
  app;
};
