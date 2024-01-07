// Import the 'moment' library for handling and formatting dates
import moment from "moment";

// Function to check if a string contains HTML tags using a regular expression
export const containsHTMLTags = (inputString: string) => {
  // Define a regular expression for matching HTML tags
  const htmlTagsRegex = /<\/?[\w\s="/.'-]+>/;
  return htmlTagsRegex.test(inputString);
};

// Function to capitalize the first letter of each word in a given text
export const ToUpperCaseEveryWord = (text: string) => {
  return text
    .split(" ")
    .map((cur) => cur.charAt(0).toLocaleUpperCase() + cur.slice(1))
    .join(" ");
};

// Function to format a Firestore timestamp using the 'moment' library
export const formatFirestoreTimestampWithMoment = (timestamp: any) => {
  // Convert Firestore timestamp to a JavaScript Date object
  const firestoreTimestamp = timestamp.toDate();

  // Get the current moment in time
  const now = moment();

  // Create a moment object from the Firestore timestamp
  const momentTimestamp = moment(firestoreTimestamp);

  // Calculate the difference in hours between the current time and the Firestore timestamp
  const hoursAgo = now.diff(momentTimestamp, "hours");

  // Check if the timestamp is less than 1 hour ago
  if (hoursAgo < 1) {
    // Format and return the timestamp for display (within the same day)
    return momentTimestamp.format("h:mm A") + " Today";
  } else {
    // Format and return the timestamp for display (on a different day)
    return momentTimestamp.format("h:mm A MMM D, YYYY");
  }
};
export const isValidHttpUrl = (possibleUrl?: string) => {
  let url;
  if (!possibleUrl) {
    return false;
  }

  try {
    url = new URL(possibleUrl);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
};
