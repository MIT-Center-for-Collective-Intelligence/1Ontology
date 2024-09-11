import { INode } from " @components/types/INode";

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

export const getTitle = (nodes: INode[], id: string) => {
  const nodeIdx = nodes.findIndex((n) => n.id === id);
  if (nodeIdx !== -1) {
    return nodes[nodeIdx].title;
  }
};
