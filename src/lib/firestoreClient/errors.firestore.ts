import {
  collection,
  doc,
  Firestore,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { CLIENT_ERRORS } from "./collections";

export type ErrorLog = {
  user: string;
  title: any;
  level?: "INFO" | "WARNING" | "ERROR";
  description?: string;
  data: { [key: string]: any };
  operatingSystem: any;
  browser: any;
};
export const getOperatingSystem = () => {
  const userAgent = window.navigator.userAgent;
  let os = "Unknown OS";

  if (userAgent.indexOf("Windows NT 10.0") !== -1) os = "Windows 10";
  else if (userAgent.indexOf("Windows NT 6.2") !== -1) os = "Windows 8";
  else if (userAgent.indexOf("Windows NT 6.1") !== -1) os = "Windows 7";
  else if (userAgent.indexOf("Mac OS X") !== -1) os = "MacOS";
  else if (userAgent.indexOf("Linux") !== -1) os = "Linux";
  else if (userAgent.indexOf("Android") !== -1) os = "Android";
  else if (
    userAgent.indexOf("iPhone") !== -1 ||
    userAgent.indexOf("iPad") !== -1
  )
    os = "iOS";

  return os;
};

// Function to detect the browser
export const getBrowser = () => {
  const userAgent = window.navigator.userAgent;
  let browser = "Unknown Browser";

  if (
    userAgent.indexOf("Chrome") !== -1 &&
    userAgent.indexOf("Edg") === -1 &&
    userAgent.indexOf("OPR") === -1
  )
    browser = "Google Chrome";
  else if (userAgent.indexOf("Firefox") !== -1) browser = "Mozilla Firefox";
  else if (
    userAgent.indexOf("Safari") !== -1 &&
    userAgent.indexOf("Chrome") === -1
  )
    browser = "Safari";
  else if (userAgent.indexOf("Edg") !== -1) browser = "Microsoft Edge";
  else if (userAgent.indexOf("OPR") !== -1 || userAgent.indexOf("Opera") !== -1)
    browser = "Opera";
  else if (userAgent.indexOf("MSIE") !== -1 || !!document.DOCUMENT_NODE)
    browser = "Internet Explorer"; // For old versions

  return browser;
};
export const addClientErrorLog = async (
  db: Firestore,
  data: ErrorLog | any,
  getUser?: any
): Promise<void> => {
  const errorsRef = doc(collection(db, CLIENT_ERRORS));
  const dataCompleted: ErrorLog = { ...data, level: data.level ?? "ERROR" };
  const userId = getUser ? await getUser() : "";
  await setDoc(errorsRef, {
    ...dataCompleted,
    userId,
    operatingSystem: getOperatingSystem(),
    browser: getBrowser(),
    createdAt: Timestamp.fromDate(new Date()),
  });
};
