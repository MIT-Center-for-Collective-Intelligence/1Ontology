import type { NextApiResponse } from "next";
import fbAuth, { CustomNextApiRequest } from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { NODES, NODES_LOGS, USERS } from "@components/lib/firestoreClient/collections";
import { FieldValue } from "firebase-admin/firestore";

type CollectionLink = { id: string; title?: string };
type ICollection = { collectionName: string; nodes: CollectionLink[] };

function asCollections(value: unknown): ICollection[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return [];
  const first = value[0] as any;
  if (typeof first !== "object" || first == null) return null;
  if (typeof first.collectionName !== "string" || !Array.isArray(first.nodes)) {
    return null;
  }
  return value as ICollection[];
}

function ensureMainCollection(collections: ICollection[]): ICollection {
  let main = collections.find((c) => c.collectionName === "main");
  if (!main) {
    main = { collectionName: "main", nodes: [] };
    collections.unshift(main);
  }
  if (!Array.isArray(main.nodes)) main.nodes = [];
  return main;
}

async function updateReciprocalParts({
  targetIds,
  reciprocalProperty,
  newLink,
}: {
  targetIds: string[];
  reciprocalProperty: "parts" | "isPartOf";
  newLink: { id: string; title: string };
}) {
  await Promise.all(
    targetIds.map(async (targetId) => {
      const ref = db.collection(NODES).doc(targetId);
      const snap = await ref.get();
      const data = snap.data() as any;
      if (!data) return;

      const existing = asCollections(data?.properties?.[reciprocalProperty]);
      if (!existing) return;

      const allIds = existing.flatMap((c) => (c.nodes || []).map((n) => n.id));
      if (allIds.includes(newLink.id)) return;

      const main = ensureMainCollection(existing);
      if (!main.nodes.some((n) => n.id === newLink.id)) {
        main.nodes.push(newLink);
      }

      await ref.update({
        [`properties.${reciprocalProperty}`]: existing,
      });
    }),
  );
}

async function updatePropertyOfBacklinks({
  targetIds,
  property,
  newLink,
}: {
  targetIds: string[];
  property: string;
  newLink: { id: string };
}) {
  await Promise.all(
    targetIds.map(async (targetId) => {
      const ref = db.collection(NODES).doc(targetId);
      const snap = await ref.get();
      const data = snap.data() as any;
      if (!data) return;

      const current = (data.propertyOf && data.propertyOf[property]) || [
        { collectionName: "main", nodes: [] },
      ];
      const collections = asCollections(current) || [
        { collectionName: "main", nodes: [] },
      ];
      const main = ensureMainCollection(collections);

      if (main.nodes.some((n) => n.id === newLink.id)) return;
      main.nodes.push(newLink);

      await ref.update({
        [`propertyOf.${property}`]: collections,
      });
    }),
  );
}

async function handler(req: CustomNextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    nodeId,
    property,
    value,
    structured = false,
    reference = null,
    fullNode = null,
    skillsFuture = false,
    appName = undefined,
  } = (req.body?.data || req.body || {}) as any;

  if (!nodeId || typeof nodeId !== "string") {
    return res.status(400).json({ error: "nodeId is required" });
  }
  if (!property || typeof property !== "string") {
    return res.status(400).json({ error: "property is required" });
  }

  const userData = req.body?.data?.user?.userData;
  const modifiedBy = userData?.uname as string | undefined;

  const nodeRef = db.collection(NODES).doc(nodeId);
  const nodeSnap = await nodeRef.get();
  const nodeData = nodeSnap.data() as any;
  if (!nodeData) {
    return res.status(404).json({ error: "Node not found" });
  }
  if (appName && nodeData?.appName && nodeData.appName !== appName) {
    return res.status(403).json({ error: "Node does not belong to this app" });
  }

  let resolvedPropertyValue: any = value;
  if (structured && reference) {
    const refSnap = await db.collection(NODES).doc(reference).get();
    const refData = refSnap.data() as any;
    if (!refData) {
      return res.status(400).json({ error: "Referenced node not found" });
    }
    resolvedPropertyValue = refData?.properties?.[property];
  }

  const now = new Date();
  const newNodeTitle =
    property === "title" && typeof value === "string" ? value : nodeData.title;

  const updates: Record<string, any> = {};
  if (property === "title") {
    updates.title = value;
  } else if (structured) {
    updates[`textValue.${property}`] = value;
    updates[`properties.${property}`] = resolvedPropertyValue;
    updates[`inheritance.${property}.ref`] = null;
    updates[`inheritance.${property}.title`] = "";
  } else {
    updates[`properties.${property}`] = value;
    updates[`inheritance.${property}.ref`] = null;
    updates[`inheritance.${property}.title`] = "";
  }

  if (modifiedBy && modifiedBy !== "ouhrac") {
    updates.contributors = FieldValue.arrayUnion(modifiedBy);
    updates[`contributorsByProperty.${property}`] = FieldValue.arrayUnion(modifiedBy);
  }

  await nodeRef.update(updates);

  // Change log + user last-change timestamp
  if (modifiedBy) {
    await db.collection(NODES_LOGS).doc().set({
      nodeId,
      modifiedBy,
      modifiedProperty: property,
      previousValue: "",
      newValue: typeof value === "string" ? value : JSON.stringify(value ?? null),
      modifiedAt: now,
      changeType: "change text",
      fullNode: fullNode || null,
      skillsFuture,
      ...(appName ? { appName } : {}),
    });

    if (modifiedBy !== "ouhrac") {
      await db.collection(USERS).doc(modifiedBy).update({
        lasChangeMadeAt: now,
      });
    }
  }

  // Cross-node consistency for structured collection properties.
  const collections = asCollections(resolvedPropertyValue);
  if (structured && collections) {
    const linkIds = collections.flatMap((c) => (c.nodes || []).map((n) => n.id));

    if (property === "parts" || property === "isPartOf") {
      const reciprocalProperty = property === "parts" ? "isPartOf" : "parts";
      await updateReciprocalParts({
        targetIds: linkIds,
        reciprocalProperty,
        newLink: { id: nodeId, title: newNodeTitle },
      });
    } else {
      await updatePropertyOfBacklinks({
        targetIds: linkIds,
        property,
        newLink: { id: nodeId },
      });
    }
  }

  return res.status(200).json({ ok: true });
}

export default fbAuth(handler);

