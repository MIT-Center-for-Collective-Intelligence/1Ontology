import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@components/lib/firestoreServer/admin";
import fbAuth from "@components/middlewares/fbAuth";

const COLLECTION = "oNetNodesDecomposedLeafs";
const CACHE_TTL_MS = 5 * 60 * 1000;
const FIELDS = [
  "title",
  "specializations",
  "generalizations",
  "actionAlternatives",
  "oNetTask",
  "task",
  "comments",
  "nodeType",
];

type Link = { id: string };
type LinkCollection = { collectionName?: string; nodes: Link[] };

export type ClustersNode = {
  id: string;
  title: string;
  specializations: LinkCollection[];
  generalizations: LinkCollection[];
  actionAlternatives?: string[];
  oNetTask?: boolean;
  task?: boolean;
  comments?: boolean;
  nodeType?: string;
};

const idsOnly = (collections: unknown): LinkCollection[] =>
  (Array.isArray(collections) ? collections : []).map((collection: any) => ({
    ...(collection?.collectionName
      ? { collectionName: collection.collectionName }
      : {}),
    nodes: (Array.isArray(collection?.nodes) ? collection.nodes : [])
      .filter((link: any) => typeof link?.id === "string")
      .map((link: any) => ({ id: link.id })),
  }));

const loadNodes = async (): Promise<string> => {
  const snapshot = await db
    .collection(COLLECTION)
    .select(...FIELDS)
    .get();
  const nodes: ClustersNode[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: typeof data.title === "string" ? data.title : "",
      specializations: idsOnly(data.specializations),
      generalizations: idsOnly(data.generalizations),
      ...(Array.isArray(data.actionAlternatives) &&
      data.actionAlternatives.length > 0
        ? { actionAlternatives: data.actionAlternatives }
        : {}),
      ...(data.oNetTask ? { oNetTask: true } : {}),
      ...(data.task ? { task: true } : {}),
      ...(data.comments ? { comments: true } : {}),
      ...(data.nodeType ? { nodeType: data.nodeType } : {}),
    };
  });
  return JSON.stringify({ nodes });
};

let cache: { loadedAt: number; body: string } | null = null;
let loading: Promise<string> | null = null;

const refresh = () => {
  loading ??= loadNodes()
    .then((body) => {
      cache = { loadedAt: Date.now(), body };
      return body;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  let body: string;
  if (!cache) {
    body = await refresh();
  } else {
    body = cache.body;
    if (Date.now() - cache.loadedAt > CACHE_TTL_MS) {
      refresh().catch((error) => console.error(error));
    }
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, max-age=300");
  return res.status(200).send(body);
};

export const config = {
  api: { responseLimit: false },
};

export default fbAuth(handler);
