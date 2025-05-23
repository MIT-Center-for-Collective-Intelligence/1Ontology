import { INode, INodeTypes } from "@components/types/INode";
import { collection, doc, getDoc, Timestamp } from "firebase/firestore";
import { NODES } from "../firestoreClient/collections";
import { Reaction } from "@components/types/IChat";

// Function to capitalize the first letter of a string
export function capitalizeFirstLetter(str: string): string {
  if (typeof str !== "string") {
    return "";
  }
  const capitalized = str.charAt(0).toUpperCase() + str.slice(1);
  return capitalized;
}

export function lowercaseFirstLetter(str: string): string {
  if (typeof str !== "string") {
    return "";
  }
  return str.charAt(0).toLowerCase() + str.slice(1);
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
  character: string,
): string => {
  return Array.from(text).join(character);
};

// Function to split a sentence into chunks based on a maximum number of characters
export function splitSentenceIntoChunks(
  sentence: string,
  maxCharacters = 100,
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
  let value = "";
  if (nodes[id]) {
    value = nodes[id].title;
  }
  if (
    nodes[id] &&
    nodes[id].nodeType === "context" &&
    Array.isArray(nodes[id].properties.context)
  ) {
    const contextId = nodes[id].properties.context[0].nodes[0]?.id;

    if (contextId) {
      value += " at " + nodes[contextId].title;
    }
  }
  return value;
};
export const getTitleDeleted = async (
  nodes: { [id: string]: INode },
  id: string,
  forceGet = false,
  db: any = null,
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
  property: string,
  structured?: boolean,
) => {
  if (id && nodes[id] && nodes[id].properties.hasOwnProperty(property)) {
    if (Array.isArray(nodes[id].properties[property]) && structured) {
      return nodes[id]?.textValue && nodes[id]?.textValue[property]
        ? nodes[id]?.textValue[property] || ""
        : "";
    }
    return nodes[id].properties[property];
  }
  return null;
};

export const timeAgo = (timestamp: Timestamp) => {
  const now = new Date();
  const timeDifference = now.getTime() - timestamp.toMillis();

  const seconds = Math.floor(timeDifference / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    return years === 1 ? "1 year ago" : `${years} years ago`;
  } else if (months > 0) {
    return months === 1 ? "1 month ago" : `${months} months ago`;
  } else if (days > 0) {
    return days === 1 ? "1 day ago" : `${days} days ago`;
  } else if (hours > 0) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  } else if (minutes > 0) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  } else {
    return "a few seconds ago";
  }
};

// Function to generate a unique title
export const generateUniqueTitle = (
  title: string,
  existingTitles: string[],
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
  forceLetter?: any,
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
  abbr: string,
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
export const getTooltipHelper = (property: string): string => {
  const propertyDescriptions: { [key: string]: string } = {
    title:
      "The title of an entity, typically starting with a verb. Example: 'Turn around aircraft'.",
    description:
      "A detailed explanation of this entity to help others understand its purpose and how it differs from similar entities.",
    isPartOf:
      "The larger entities that this entity is a component of. For activities, it includes larger activities of which this is a sub-activity. Example: The activity 'Dress seats' is part of 'Clean aircraft.'",
    parts:
      "The components or sub-entities that make up this entity. For activities, parts are the sub-activities needed to achieve the overall goal.",
    generalizations:
      "Entities that this entity is a specific type of. Example: 'Turn around aircraft' is a generalization of 'Change user of physical object' because turning around an aircraft changes its user.",
    specializations:
      "Entities that are more specific variants of this entity. Example: 'Turn around aircraft' is a specialization of 'Change user of physical object' because it involves changing the user of an aircraft.",
    references:
      "Sources of information used to create the properties of this node, such as books, papers, or other references. Please cite them here.",
    actor: "Individuals or groups who perform this activity.",
    "Objects Acted on": "Objects that the original activity is performed on.",
    preConditions:
      "The conditions that must be met before this activity can be performed.",
    postConditions:
      "The outcomes or conditions that should be achieved as a result of performing this activity.",
    evaluationDimension:
      "Criteria used to assess the performance of this activity.",
    abilities: "The skills or abilities required of this actor.",
    individual: "Types of individuals belonging to this group.",
    "Number of Individuals in Group": "The count of individuals in this group.",
    "List of Individuals in Group":
      "A detailed list of individuals that make up this group.",
    "Type of Actor": "The specific types of actors that belong to this group.",
    "Criteria for Acceptability":
      "The standards used to determine if the activity's performance meets expectations according to this evaluation dimension.",
    "Direction of Desirability":
      "Indicates whether an increase or decrease in measurement would be considered desirable for this activity’s performance.",
    "Measurement Units":
      "The units used to quantify this evaluation dimension.",
    reward: "The incentive or benefit associated with this activity or goal.",
    "Reward Function": "The way in which the reward is structured or provided.",
    "Capabilities Required":
      "The capabilities that actors must possess to achieve this reward.",
    root: "The most generalized entity in the ontology. Tracing the generalizations of this entity back leads to the root of the ontology.",
    size: "The size of the object.",
    creator: "The creator of the object.",
    "Creation Date": "The creation date of the object.",
    "Life Span": "The lifespan of the object.",
    modifiability: "The modifiability of the object.",
    "Perceivable Properties": "The perceivable properties of the object.",
  };

  return propertyDescriptions[property] || "";
};

export const isOnline = (timestamp: Timestamp) => {
  if (!timestamp) return false;
  const now = new Date();
  const timeDifference = now.getTime() - timestamp.toMillis();
  const minutes = Math.floor(timeDifference / 1000 / 60);
  return minutes < 10;
};

export const getTaggedUsers = (input: string): Set<string> => {
  const regex = /\[[^\]]+\]\(([^)]+)\)/g;
  if (input) {
    const _matches = input.match(regex);
    if (_matches) {
      const matches: Set<string> = new Set();
      for (let match of _matches) {
        const m = match.match(/\(([^)]+)\)/);
        if (m) {
          matches.add(m[1]);
        }
      }

      return matches;
    }
  }
  return new Set();
};

export const getJoinUsernames = (
  reactions: Reaction[],
  currentUser: string,
): string => {
  const allReactions =
    reactions.findIndex((u) => u.user === currentUser) !== -1
      ? [
          { fName: "You", lName: "" },
          ...reactions.filter((user) => user.user !== currentUser),
        ]
      : reactions;
  if (allReactions.length > 2) {
    const lastEl = allReactions.splice(-1);
    return (
      allReactions
        .map((u) => {
          return `${u.fName}`;
        })
        .join(", ") +
      ", and " +
      lastEl +
      " "
    );
  } else {
    return (
      allReactions
        .map((u) => {
          return `${u.fName}`;
        })
        .join(" and ") + " "
    );
  }
};
