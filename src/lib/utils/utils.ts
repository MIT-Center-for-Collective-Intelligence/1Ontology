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

function annotate(number: number, maxPlaces: any, forcePlaces: any, abbr: string): string {
  // set places to false to not round
  let rounded: number = 0;
  switch (abbr) {
    case "T":
      rounded = number / 1e12;
      break;
    case "B":
      rounded = number / 1e9;
      break;
    case "M":
      rounded = number / 1e6;
      break;
    case "K":
      rounded = number / 1e3;
      break;
    case "":
      rounded = number;
      break;
  }
  if (maxPlaces !== false) {
    if (("" + rounded).includes("e-")) {
      rounded = 0;
    } else {
      const test = new RegExp("\\.\\d{" + (maxPlaces + 1) + ",}$");
      if (test.test("" + rounded)) {
        rounded = Number(rounded.toFixed(maxPlaces));
      }
    }
  }
  if (forcePlaces !== false) {
    rounded = Number(Number(rounded).toFixed(forcePlaces));
  }
  return rounded + abbr;
}

export const shortenNumber = function (number: number, maxPlaces: any, forcePlaces: any, forceLetter?: any) {
  number = Number(number);
  forceLetter = forceLetter || false;
  if (forceLetter !== false) {
    return annotate(number, maxPlaces, forcePlaces, forceLetter);
  }
  let abbr = "";
  if (number >= 1e12) {
    abbr = "T";
  } else if (number >= 1e9) {
    abbr = "B";
  } else if (number >= 1e6) {
    abbr = "M";
  } else if (number >= 1e3) {
    abbr = "K";
  }
  return annotate(number, maxPlaces, forcePlaces, abbr);
};

export const imageLoaded = async (imageUrl: any) => {
  return new Promise(resolve => {
    fetch(imageUrl).then(res => {
      if (res.status === 200) {
        resolve(true);
      } else {
        resolve(imageLoaded(imageUrl));
      }
    });
  });
};