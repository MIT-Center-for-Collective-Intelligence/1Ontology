import fs from "fs";
import path from "path";
export function relationshipPackages() {
  const active = JSON.parse(
    fs.readFileSync(
      path.join(
        process.cwd(),
        "scripts/deployment/relationship-review-package.json",
      ),
      "utf8",
    ),
  );
  return [active, ...(active.history || [])];
}
export function relationshipPackage(version?: string) {
  const entries = relationshipPackages();
  const entry = version
    ? entries.find((e) => e.version === version)
    : entries[0];
  if (!entry) throw Error("Unknown relationship review version");
  const directory = entry.directory || "";
  if (directory && !/^[a-z0-9-]+$/.test(directory))
    throw Error("Invalid package directory");
  return {
    entry,
    dir: path.join(process.cwd(), "src/lib/relationshipReview/data", directory),
  };
}
