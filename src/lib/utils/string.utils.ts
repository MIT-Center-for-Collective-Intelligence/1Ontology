import { INode } from " @components/types/INode";
import { collection, doc, getDoc, Timestamp } from "firebase/firestore";
import { NODES } from "../firestoreClient/collections";

// Function to capitalize the first letter of a string
export function capitalizeFirstLetter(str: string): string {
  const capitalized = str.charAt(0).toUpperCase() + str.slice(1);
  return capitalized;
}

// Function to capitalize each word in a string
export const capitalizeString = (str: string): string => {
  return str
    .split(" ")
    .map((cur) => capitalizeFirstLetter(cur))
    .join(" ");
};

// Function to add a suffix to a string that contains "GMT"
export const addSuffixToUrlGMT = (url: string, suffix: string) => {
  let urlArr = url.split("GMT");
  return urlArr[0] + "GMT" + suffix + urlArr[1];
};

// Function to add an ellipsis (...) to a string if it exceeds a certain length
export const ellipsisString = (text: string, length: number) => {
  return text.length > length ? `${text.slice(0, length)}...` : text;
};

// Function to split a string into chunks based on a maximum number of characters
export const getTextSplittedByCharacter = (
  text: string,
  character: string
): string => {
  return Array.from(text).join(character);
};

// Function to split a sentence into chunks based on a maximum number of characters
export function splitSentenceIntoChunks(
  sentence: string,
  maxCharacters = 100
): string[] {
  const words: string[] = sentence.split(" ");
  const chunks: string[] = [];
  let currentChunk: string = "";

  for (const word of words) {
    if (currentChunk.length + word.length <= maxCharacters) {
      currentChunk += (currentChunk.length > 0 ? " " : "") + word;
    } else {
      chunks.push(currentChunk);
      currentChunk = word;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export const getTitle = (nodes: { [id: string]: INode }, id: string) => {
  if (nodes[id]) {
    return nodes[id].title;
  }
  return "";
};
export const getTitleDeleted = async (
  nodes: { [id: string]: INode },
  id: string,
  forceGet = false,
  db: any = null
) => {
  if (nodes[id]) {
    return nodes[id].title;
  } else if (forceGet && db) {
    const nodeDoc = await getDoc(doc(collection(db, NODES), id));
    return nodeDoc.data()?.title || " ";
  }
  return " ";
};

export const checkNodeLock = (nodes: { [id: string]: INode }, id: string) => {
  return !!nodes[id]?.locked;
};

export const getPropertyValue = (
  nodes: { [id: string]: INode },
  id: string | null,
  property: string
) => {
  if (id && nodes[id] && nodes[id].properties.hasOwnProperty(property)) {
    return nodes[id].properties[property];
  }
  return null;
};

export const timeAgo = (timestamp: Timestamp) => {
  const now = new Date();
  const timeDifference = now.getTime() - timestamp.toMillis(); // Difference in milliseconds

  const seconds = Math.floor(timeDifference / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return days === 1 ? "1 day ago" : `${days} days ago`;
  } else if (hours > 0) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  } else if (minutes > 0) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  } else if (seconds > 0) {
    return "a few seconds ago";
  }
};

// Function to generate a unique title
export const generateUniqueTitle = (
  title: string,
  existingTitles: string[]
) => {
  let uniqueTitle = title;
  let count = 1;

  // Check if the title already exists in the array of titles
  while (existingTitles.includes(uniqueTitle)) {
    count++;
    uniqueTitle = `${title} ${count}`; // Append a number if the title already exists
  }

  return uniqueTitle;
};

export const shortenNumber = function (
  number: number,
  maxPlaces: any,
  forcePlaces: any,
  forceLetter?: any
) {
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

function annotate(
  number: number,
  maxPlaces: any,
  forcePlaces: any,
  abbr: string
): string {
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
