import { db } from " @components/lib/firestoreServer/admin";
import { NextApiRequest, NextApiResponse } from "next";
// @ts-ignore
import WordNet = require("node-wordnet");

const wordnet = new WordNet();

interface Pointer {
  pointerSymbol: string;
  synsetOffset: number;
  pos: string;
}

interface Synset {
  synsetOffset: number;
  pos: string;
  lemma: string;
  synonyms?: string[];
  gloss: string;
  ptrs: Pointer[];
}

interface TreeNode {
  synset: Synset;
  children: TreeNode[];
}

function insertPath(rootNodes: TreeNode[], path: Synset[]): void {
  let currentLevel = rootNodes;
  for (const s of path) {
    const id = `${s.synsetOffset}_${s.pos}`;
    let node = currentLevel.find(
      (n) => `${n.synset.synsetOffset}_${n.synset.pos}` === id,
    );
    if (!node) {
      node = { synset: s, children: [] };
      currentLevel.push(node);
    }
    currentLevel = node.children;
  }
}

async function getHypernymPaths(
  synset: Synset,
  visited: Set<string> = new Set(),
): Promise<Synset[][]> {
  const id = `${synset.synsetOffset}_${synset.pos}`;
  if (visited.has(id)) return [[synset]];
  visited.add(id);

  const hypernymPtrs = synset.ptrs.filter((ptr) => ptr.pointerSymbol === "@");
  if (hypernymPtrs.length === 0) {
    visited.delete(id);
    return [[synset]];
  }

  let allPaths: Synset[][] = [];
  for (const ptr of hypernymPtrs) {
    const parent: any = await new Promise((resolve) => {
      wordnet.get(
        ptr.synsetOffset,
        ptr.pos,
        (err: Error | null, parentSynset: unknown) => {
          resolve(err ? null : (parentSynset as Synset));
        },
      );
    });
    if (!parent) continue;
    const parentPaths = await getHypernymPaths(parent, new Set(visited));
    for (const p of parentPaths) {
      allPaths.push([synset, ...p]);
    }
  }
  visited.delete(id);
  return allPaths;
}
const lookupWord = (query: string): Promise<Synset[]> => {
  return new Promise((resolve, reject) => {
    wordnet.lookup(query, (err: Error | null, results: unknown) => {
      if (err) {
        reject(err);
      } else {
        resolve(results as Synset[]);
      }
    });
  });
};
function getSynonymString(s: Synset): string {
  if (s.synonyms && s.synonyms.length > 0) {
    return s.synonyms.join(",");
  }
  return s.lemma;
}
function posToString(pos: string): string {
  switch (pos) {
    case "n":
      return "noun";
    case "v":
      return "verb";
    case "a":
      return "adjective";
    case "s":
      return "adjective satellite";
    case "r":
      return "adverb";
    default:
      return pos;
  }
}

function buildHypernymTree(nodes: TreeNode[]): any {
  return nodes.map((node) => {
    const synonyms = getSynonymString(node.synset);
    const pos = posToString(node.synset.pos);
    const children = buildHypernymTree(node.children);
    return {
      id: db.collection("nodes").id,
      name: `${synonyms} [${pos}] - ${node.synset.gloss}`,
      children,
    };
  });
}
async function buildMeronymTree(
  synset: Synset,
  visited: Set<string> = new Set(),
): Promise<any> {
  const id = `${synset.synsetOffset}_${synset.pos}`;
  if (visited.has(id)) {
    return null;
  }
  visited.add(id);

  const partPtrs = synset.ptrs.filter((ptr) => ptr.pointerSymbol === "%p");
  if (partPtrs.length === 0) return null;

  const children: TreeNode[] = [];

  for (const ptr of partPtrs) {
    const partSynset: Synset | null = await new Promise((resolve) => {
      wordnet.get(
        ptr.synsetOffset,
        ptr.pos,
        (err: Error | null, res: unknown) => {
          resolve(err || !res ? null : (res as Synset));
        },
      );
    });
    if (partSynset) {
      const childNode = await buildMeronymTree(partSynset, new Set(visited));
      if (childNode) {
        children.push(childNode);
      }
    }
  }

  return {
    id: db.collection("nodes").id,
    name: `${getSynonymString(synset)} [${posToString(synset.pos)}] - ${synset.gloss}`,
    children,
  };
}

async function buildPartOfTrees(nodes: TreeNode[]): Promise<any> {
  const result = [];
  for (const node of nodes) {
    // Check if this synset has any part meronym pointers.
    const partPtrs = node.synset.ptrs.filter(
      (ptr) => ptr.pointerSymbol === "%p",
    );
    if (partPtrs.length > 0) {
      result.push({
        name: `${getSynonymString(node.synset)} [${posToString(
          node.synset.pos,
        )}] part of:`,
        children: [await buildMeronymTree(node.synset)],
      });
    }

    const _R = await buildPartOfTrees(node.children);
    result.push(..._R);
  }
  return result;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // const { query } = req.body.data;
  const { query } = req.body;

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Invalid word parameter" });
  }
  const synsets = await lookupWord(query);

  if (synsets.length === 0) {
    return res.status(404).json({ error: `No synsets found for '${query}'` });
  }

  const treeRoots: TreeNode[] = [];

  for (const synset of synsets) {
    const upwardPaths = await getHypernymPaths(synset);
    const downwardPaths = upwardPaths.map((path) => path.slice().reverse());

    for (const path of downwardPaths) {
      insertPath(treeRoots, path);
    }
  }

  const hypernymTree = buildHypernymTree(treeRoots);
  const partsTree = await buildPartOfTrees(treeRoots);

  res.status(200).json({ word: query, hypernymTree, partsTree });
}

export default handler;
