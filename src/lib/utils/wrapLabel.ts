// Breaks a label into lines of at most `maxChars` characters, at spaces where
// possible (overlong words are cut). Lines are joined with "\n".
export const wrapLabel = (text: string, maxChars: number): string => {
  const lines: string[] = [];
  let line: string[] = [];
  for (const word of (text || "").split(/\s+/).filter(Boolean)) {
    let chars = Array.from(word);
    while (chars.length > maxChars) {
      if (line.length > 0) {
        lines.push(line.join(""));
        line = [];
      }
      lines.push(chars.slice(0, maxChars).join(""));
      chars = chars.slice(maxChars);
    }
    const next = line.length > 0 ? [...line, " ", ...chars] : chars;
    if (next.length <= maxChars) {
      line = next;
    } else {
      lines.push(line.join(""));
      line = chars;
    }
  }
  if (line.length > 0) {
    lines.push(line.join(""));
  }
  return lines.join("\n");
};
