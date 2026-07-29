export interface OntologyNodeMetadata {
  actionAlternatives?: string[];
  synsets?: string;
}

export const nodeSynonyms = (node?: OntologyNodeMetadata): string[] => {
  const values = new Set<string>();
  for (const value of node?.actionAlternatives || []) {
    if (String(value).trim()) values.add(String(value).trim());
  }
  for (const value of String(node?.synsets || "").split(",")) {
    const lemma = value.trim().replace(/\.[a-z]+\.\d+$/i, "");
    if (lemma) values.add(lemma.replace(/_/g, " "));
  }
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
};
