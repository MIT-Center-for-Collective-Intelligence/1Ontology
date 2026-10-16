/** Recover only fully emitted candidate objects from a truncated discovery.
 * Never complete a partial object, invent a field or label the response complete. */
export function completeDiscoveryPrefix(text) {
  const match = /"proposals"\s*:\s*\[/.exec(text);
  if (!match) throw Error("No complete discovery header");
  const header = JSON.parse(text.slice(0, match.index) + '"proposals":[]}');
  let start = -1,
    depth = 0,
    inString = false,
    escape = false;
  const objects = [];
  for (let i = match.index + match[0].length; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        objects.push(JSON.parse(text.slice(start, i + 1)));
        start = -1;
      }
    }
  }
  if (!objects.length) throw Error("No fully emitted candidate");
  return { ...header, proposals: objects };
}
