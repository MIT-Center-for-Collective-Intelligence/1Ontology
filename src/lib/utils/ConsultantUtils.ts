export const getColor = (nodeType: string, nodeTypes: any, factor: number) => {
  const color = nodeTypes[nodeType.toLowerCase()]?.color || "";
  return changeAlphaColor(color, factor);
};

export const changeAlphaColor = (color: string, factor: number) => {
  let hex = color.replace("#", "");
  if (hex.length === 3)
    hex = hex
      .split("")
      .map((x: string) => x + x)
      .join("");
  if (hex.length === 6)
    return `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(
      hex.slice(4, 6),
      16,
    )}, ${factor})`;
  if (hex.length === 8)
    return `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(
      hex.slice(4, 6),
      16,
    )}, ${(parseInt(hex.slice(6, 8), 16) / 255) * factor})`;
  return hex;
};

export const LINKS_TYPES: any = {
  "known positive": { text: "Known Positive Effect", color: "#4caf50" },
  "hypothetical positive": {
    text: "Hypothetical Positive Effect",
    color: "#1BBAE4",
  },
  "known negative": { text: "Known Negative Effect", color: "#A91BE4" },
  "hypothetical negative": {
    text: "Hypothetical Negative Effect",
    color: "#E4451B",
  },
};

export function extractMoves(movesArray: any) {
  return (movesArray || []).map((move: any) => {
    const match = move.match(/^([^(]+)\s*\(([^)]+)\)$/i);
    if (match) {
      return {
        action: match[1].trim(),
        detail: match[2].trim(),
      };
    } else {
      return {
        action: move.trim(),
        detail: "",
      };
    }
  });
}
