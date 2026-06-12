import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import {
  db,
  MAX_TRANSACTION_WRITES,
} from "@components/lib/firestoreServer/admin";
import {
  LOGS,
  NODES,
  NODES_LOGS,
  USERS,
} from "@components/lib/firestoreClient/collections";
import { getDoerCreate } from "@components/lib/utils/helpers";
import { computeDiffValue } from "@components/lib/utils/diffValue";
import { FieldValue } from "firebase-admin/firestore";
import { ICollection, INode, NodeChange } from "@components/types/INode";

/**
 * Single endpoint for generic node-property operations — add / delete /
 * rename / change / change-links — selected by `action` in the request body.
 */

type PropertyAction = "add" | "delete" | "rename" | "change" | "change-links";

type OperationContext = {
  nodeId: string;
  nodeData: INode;
  data: any;
  uname?: string;
  appName?: string;
};

/** Thrown by ops to signal a specific HTTP status. */
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const hasOwn = (obj: any, key: string) =>
  !!obj && Object.prototype.hasOwnProperty.call(obj, key);

const RESERVED_PROPERTIES = new Set([
  "title",
  "specializations",
  "generalizations",
  "parts",
  "isPartOf",
]);

const PROPERTY_NAME_REGEX = /^[a-zA-Z0-9 ]+$/;

/** Returns an error message, or `null` if the name is valid. */
function validatePropertyName(name: unknown): string | null {
  if (typeof name !== "string") return "property name must be a string";
  const trimmed = name.trim();
  if (!trimmed) return "property name is required";
  if (trimmed.length > 30) return "property name must be at most 30 characters";
  if (!PROPERTY_NAME_REGEX.test(name)) {
    return "property name may only contain letters, numbers and spaces";
  }
  if (RESERVED_PROPERTIES.has(trimmed)) {
    return `"${trimmed}" is a reserved property and cannot be modified here`;
  }
  return null;
}

/** Initial value by type; link-typed properties start as an empty `main` collection. */
function defaultValueForType(normalizedType: string): any {
  if (normalizedType === "string") return "";
  if (normalizedType === "numeric") return 0;
  return [{ collectionName: "main", nodes: [] }];
}

function specializationIds(node: Pick<INode, "specializations">): string[] {
  return (node.specializations || []).flatMap((collection) =>
    (collection.nodes || []).map((n) => n.id),
  );
}

/** Field paths removed from a node when a property is deleted. */
function deletionUpdates(propertyName: string): Record<string, any> {
  const del = FieldValue.delete();
  return {
    [`properties.${propertyName}`]: del,
    [`propertyType.${propertyName}`]: del,
    [`inheritance.${propertyName}`]: del,
    [`textValue.${propertyName}`]: del,
    [`propertyOf.${propertyName}`]: del,
  };
}

/**
 * Field paths that move a property `oldName` -> `newName` on a single node.
 * Only call for nodes that actually have `oldName`.
 */
function renameUpdatesFor(
  node: INode,
  oldName: string,
  newName: string,
): Record<string, any> {
  const del = FieldValue.delete();
  // Old data can lack the inheritance title; normalize to "".
  const inh = node.inheritance?.[oldName];
  const updates: Record<string, any> = {
    [`properties.${oldName}`]: del,
    [`properties.${newName}`]: node.properties?.[oldName],
    [`propertyType.${oldName}`]: del,
    [`propertyType.${newName}`]: (node.propertyType as any)?.[oldName],
    [`inheritance.${oldName}`]: del,
    [`inheritance.${newName}`]: { ...inh, title: inh?.title ?? "" },
  };
  if (node.textValue && hasOwn(node.textValue, oldName)) {
    updates[`textValue.${oldName}`] = del;
    updates[`textValue.${newName}`] = node.textValue[oldName];
  }
  const propertyOf = (node as any).propertyOf;
  if (propertyOf && hasOwn(propertyOf, oldName)) {
    updates[`propertyOf.${oldName}`] = del;
    updates[`propertyOf.${newName}`] = propertyOf[oldName];
  }
  return updates;
}

/**
 * BFS over the specialization subtree below `rootId`. `apply` returns a
 * Firestore update (batched) or `null` to skip. `descendPastSkipped` controls
 * whether a skipped node's subtree is still visited (add) or pruned (rewiring).
 */
async function walkSpecializations(
  rootId: string,
  apply: (node: INode, nodeId: string) => Record<string, any> | null,
  { descendPastSkipped = true }: { descendPastSkipped?: boolean } = {},
): Promise<{ written: number; skipped: number }> {
  const visited = new Set<string>([rootId]);
  const rootSnap = await db.collection(NODES).doc(rootId).get();
  const rootData = rootSnap.data() as INode | undefined;
  if (!rootData) return { written: 0, skipped: 0 };

  const queue = specializationIds(rootData).filter((id) => !visited.has(id));
  queue.forEach((id) => visited.add(id));

  let batch = db.batch();
  let pending = 0;
  let written = 0;
  let skipped = 0;

  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    const snap = await db.collection(NODES).doc(currentId).get();
    const data = snap.data() as INode | undefined;
    if (!data) continue;

    const update = apply(data, currentId);
    if (update) {
      batch.update(snap.ref, update);
      pending += 1;
      written += 1;
      if (pending >= MAX_TRANSACTION_WRITES) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    } else {
      skipped += 1;
      if (!descendPastSkipped) continue;
    }

    for (const childId of specializationIds(data)) {
      if (!visited.has(childId)) {
        visited.add(childId);
        queue.push(childId);
      }
    }
  }

  if (pending > 0) await batch.commit();
  return { written, skipped };
}

/**
 * Make descendants that inherit this property point at `nodeId`. Only the
 * inheritance ref is written — values are read through it, never copied. A
 * descendant with its own value keeps it, and its subtree is left alone too.
 */
async function rewireInheritingDescendants(
  nodeId: string,
  nodeTitle: string,
  propertyName: string,
): Promise<void> {
  await walkSpecializations(
    nodeId,
    (node) => {
      const inh = node.inheritance?.[propertyName];
      if (!inh || inh.inheritanceType === "neverInherit") return null;
      const stillInherits = inh.ref !== null; // null === overridden, leave it
      const rewire =
        inh.inheritanceType === "alwaysInherit" ||
        (inh.inheritanceType === "inheritUnlessAlreadyOverRidden" &&
          stillInherits);
      if (!rewire) return null;
      return {
        [`inheritance.${propertyName}.ref`]: nodeId,
        [`inheritance.${propertyName}.title`]: nodeTitle,
      };
    },
    { descendPastSkipped: false },
  );
}

/** Write an info/error log to LOGS, attributed to `uname`. */
const recordLogs = async (logs: { [key: string]: any }, uname: string) => {
  try {
    if (uname === "ouhrac") return;
    const logRef = db.collection(LOGS).doc();
    const doerCreate = getDoerCreate(uname || "");
    await logRef.set({
      type: "info",
      ...logs,
      createdAt: new Date(),
      doer: uname,
      doerCreate,
    });
  } catch (error) {
    console.error(error);
  }
};

/** Write a NodeChange to NODES_LOGS and bump the user's last-activity timestamp. */
async function writeChangeLog(change: NodeChange): Promise<void> {
  if (!change.modifiedBy) return;
  const diffValue = computeDiffValue(change);
  if (diffValue) change.diffValue = diffValue;
  await db
    .collection(NODES_LOGS)
    .doc()
    .set(change as any);
  if (change.modifiedBy !== "ouhrac") {
    await db.collection(USERS).doc(change.modifiedBy).update({
      lasChangeMadeAt: new Date(),
    });
  }
}

async function addProperty(
  ctx: OperationContext,
): Promise<{ ok: true; addedProperty: string }> {
  const { nodeId, nodeData, data, uname, appName } = ctx;

  const { propertyName, propertyType } = data as {
    propertyName?: string;
    propertyType?: string;
  };
  if (!propertyType || typeof propertyType !== "string") {
    throw new HttpError(400, "propertyType is required");
  }
  const nameError = validatePropertyName(propertyName);
  if (nameError) throw new HttpError(400, nameError);
  const cleanName = (propertyName as string).trim();

  if (hasOwn(nodeData.properties, cleanName)) {
    throw new HttpError(
      409,
      `Property "${cleanName}" already exists on this node`,
    );
  }

  const normalizedType = propertyType.toLowerCase();
  const propertyValue = defaultValueForType(normalizedType);
  const previousProperties = nodeData.properties || {};

  // Create the property on the node itself (own value, not inherited).
  const nodeUpdates: Record<string, any> = {
    [`properties.${cleanName}`]: propertyValue,
    [`propertyType.${cleanName}`]: normalizedType,
    [`inheritance.${cleanName}`]: {
      ref: null,
      title: "",
      inheritanceType: "inheritUnlessAlreadyOverRidden",
    },
  };
  if (uname && uname !== "ouhrac") {
    nodeUpdates.contributors = FieldValue.arrayUnion(uname);
  }
  await db.collection(NODES).doc(nodeId).update(nodeUpdates);

  // Propagate down the subtree, skipping descendants that already define
  // the property (their own value is preserved).
  await walkSpecializations(nodeId, (node) => {
    if (hasOwn(node.properties, cleanName)) return null;
    return {
      [`properties.${cleanName}`]: propertyValue,
      [`propertyType.${cleanName}`]: normalizedType,
      [`inheritance.${cleanName}`]: {
        ref: nodeId,
        title: nodeData.title ?? "",
        inheritanceType: "inheritUnlessAlreadyOverRidden",
      },
    };
  });

  if (uname) {
    const newProperties = { ...previousProperties, [cleanName]: propertyValue };
    await writeChangeLog({
      nodeId,
      modifiedBy: uname,
      modifiedProperty: null,
      previousValue: previousProperties,
      newValue: newProperties,
      modifiedAt: new Date(),
      changeType: "add property",
      changeDetails: { addedProperty: cleanName },
      fullNode: { ...nodeData, properties: newProperties },
      ...(appName ? { appName } : {}),
    } as NodeChange);
  }

  return { ok: true, addedProperty: cleanName };
}

async function deleteProperty(
  ctx: OperationContext,
): Promise<{ ok: true; removedProperty: string }> {
  const { nodeId, nodeData, data, uname, appName } = ctx;

  const nameError = validatePropertyName(data?.propertyName);
  if (nameError) throw new HttpError(400, nameError);
  const cleanName = (data.propertyName as string).trim();

  if (!hasOwn(nodeData.properties, cleanName)) {
    throw new HttpError(404, `Property "${cleanName}" not found on this node`);
  }

  // Resolve previous value for the log (follows inheritance ref if any).
  let previousValue: any = nodeData.properties[cleanName];
  const inheritedRef = nodeData.inheritance?.[cleanName]?.ref;
  if (inheritedRef) {
    const refData = (
      await db.collection(NODES).doc(inheritedRef).get()
    ).data() as INode | undefined;
    if (refData) previousValue = refData.properties?.[cleanName];
  }

  // Remove from the node, then unconditionally across the subtree.
  const nodeUpdates: Record<string, any> = deletionUpdates(cleanName);
  if (uname && uname !== "ouhrac") {
    nodeUpdates.contributors = FieldValue.arrayUnion(uname);
  }
  await db.collection(NODES).doc(nodeId).update(nodeUpdates);
  const updates = deletionUpdates(cleanName);
  await walkSpecializations(nodeId, () => updates);

  if (uname) {
    await writeChangeLog({
      nodeId,
      modifiedBy: uname,
      modifiedProperty: cleanName,
      previousValue: previousValue ?? null,
      newValue: null,
      modifiedAt: new Date(),
      changeType: "remove property",
      fullNode: nodeData,
      ...(appName ? { appName } : {}),
    } as NodeChange);
  }

  return { ok: true, removedProperty: cleanName };
}

async function renameProperty(
  ctx: OperationContext,
): Promise<{ ok: true; renamedTo: string }> {
  const { nodeId, nodeData, data, uname, appName } = ctx;

  const { previousValue, newValue } = data as {
    previousValue?: string;
    newValue?: string;
  };
  const oldNameError = validatePropertyName(previousValue);
  if (oldNameError) throw new HttpError(400, `Old ${oldNameError}`);
  const newNameError = validatePropertyName(newValue);
  if (newNameError) throw new HttpError(400, `New ${newNameError}`);
  const oldName = (previousValue as string).trim();
  const newName = (newValue as string).trim();
  if (oldName === newName) {
    throw new HttpError(400, "New name must differ from the current name");
  }

  if (!hasOwn(nodeData.properties, oldName)) {
    throw new HttpError(404, `Property "${oldName}" not found on this node`);
  }
  if (hasOwn(nodeData.properties, newName)) {
    throw new HttpError(
      409,
      `Property "${newName}" already exists on this node`,
    );
  }

  const nodeUpdates = renameUpdatesFor(nodeData, oldName, newName);
  if (uname && uname !== "ouhrac") {
    nodeUpdates.contributors = FieldValue.arrayUnion(uname);
    nodeUpdates[`contributorsByProperty.${newName}`] =
      FieldValue.arrayUnion(uname);
  }
  await db.collection(NODES).doc(nodeId).update(nodeUpdates);

  // Rename across the subtree — only nodes that define the old key; a
  // collision on the new name overwrites it.
  await walkSpecializations(nodeId, (node) =>
    hasOwn(node.properties, oldName)
      ? renameUpdatesFor(node, oldName, newName)
      : null,
  );

  if (uname) {
    await writeChangeLog({
      nodeId,
      modifiedBy: uname,
      modifiedProperty: newName,
      previousValue: oldName,
      newValue: newName,
      modifiedAt: new Date(),
      changeType: "edit property",
      fullNode: nodeData,
      ...(appName ? { appName } : {}),
    } as NodeChange);
  }

  return { ok: true, renamedTo: newName };
}

/**
 * Types `change` accepts. `string` (text) is synced by the realtime YJS
 * editor; link/collection types go through the link-element flow.
 */
const CHANGE_TYPES = new Set(["numeric", "string-select", "string-array"]);

/** Light, type-aware validation of an incoming value. */
function validateValue(propertyType: string, value: any): string | null {
  if (value === undefined || value === null) return "value is required";
  if (propertyType === "string-array") {
    if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
      return "value must be an array of strings";
    }
  }
  if (propertyType === "numeric") {
    const ok =
      typeof value === "number" ||
      (typeof value === "object" && value !== null && "value" in value);
    if (!ok) return "numeric value must be a number or { value, unit }";
  }
  // string-select stores an object ({ performer, reason, … }) — accept as-is.
  return null;
}

/** Change-log fields for a value change; the shape depends on the type. */
function buildValueChangeLog(
  propertyType: string,
  previousValue: any,
  newValue: any,
): Pick<
  NodeChange,
  "previousValue" | "newValue" | "changeType" | "changeDetails"
> {
  if (propertyType === "numeric") {
    return {
      previousValue: JSON.stringify(previousValue ?? null),
      newValue: JSON.stringify(newValue ?? null),
      changeType: "change text",
    };
  }
  if (propertyType === "string-select") {
    return {
      previousValue: previousValue ?? null,
      newValue,
      changeType: "change select-string",
    };
  }
  // string-array
  const oldArr: string[] = Array.isArray(previousValue) ? previousValue : [];
  const newArr: string[] = Array.isArray(newValue) ? newValue : [];
  const added = newArr.filter((x) => !oldArr.includes(x));
  const removed = oldArr.filter((x) => !newArr.includes(x));
  let changeType: NodeChange["changeType"] = "modify elements";
  if (added.length === 1 && removed.length === 0) changeType = "add element";
  else if (removed.length === 1 && added.length === 0)
    changeType = "remove element";
  return {
    previousValue: oldArr,
    newValue: newArr,
    changeType,
    changeDetails: { addedElements: added, removedElements: removed },
  };
}

async function changeProperty(
  ctx: OperationContext,
): Promise<{ ok: true; changedProperty: string }> {
  const { nodeId, nodeData, data, uname, appName } = ctx;

  const nameError = validatePropertyName(data?.propertyName);
  if (nameError) throw new HttpError(400, nameError);
  const cleanName = (data.propertyName as string).trim();

  if (!hasOwn(nodeData.properties, cleanName)) {
    throw new HttpError(404, `Property "${cleanName}" not found on this node`);
  }
  if (!data || !("value" in data)) {
    throw new HttpError(400, "value is required");
  }
  const value = data.value;

  // The node is authoritative for the property's type.
  const propertyType = (nodeData.propertyType as any)?.[cleanName];
  if (propertyType === "string") {
    throw new HttpError(
      400,
      "Text properties are edited via the realtime editor, not this endpoint",
    );
  }
  if (!CHANGE_TYPES.has(propertyType)) {
    throw new HttpError(
      400,
      `Property "${cleanName}" (type "${propertyType ?? "unknown"}") cannot be changed here; only numeric, string-select and string-array are supported`,
    );
  }
  const valueError = validateValue(propertyType, value);
  if (valueError) throw new HttpError(400, valueError);

  // Resolve the previous value for the log through the inheritance ref —
  // while inheriting, the node's own stored copy can be stale.
  let previousValue: any = nodeData.properties[cleanName];
  const inheritedRef = nodeData.inheritance?.[cleanName]?.ref;
  if (inheritedRef) {
    const refData = (
      await db.collection(NODES).doc(inheritedRef).get()
    ).data() as INode | undefined;
    if (refData && hasOwn(refData.properties, cleanName)) {
      previousValue = refData.properties[cleanName];
    }
  }
  const wasInheriting = !!inheritedRef;

  // Write the value; if the node was inheriting, this overrides — break its ref.
  const nodeUpdates: Record<string, any> = {
    [`properties.${cleanName}`]: value,
  };
  if (wasInheriting) {
    nodeUpdates[`inheritance.${cleanName}.ref`] = null;
    nodeUpdates[`inheritance.${cleanName}.title`] = "";
  }
  if (uname && uname !== "ouhrac") {
    nodeUpdates.contributors = FieldValue.arrayUnion(uname);
    nodeUpdates[`contributorsByProperty.${cleanName}`] =
      FieldValue.arrayUnion(uname);
  }
  await db.collection(NODES).doc(nodeId).update(nodeUpdates);

  // When newly overriding, re-point inheriting descendants at this node.
  if (wasInheriting) {
    await rewireInheritingDescendants(nodeId, nodeData.title ?? "", cleanName);
  }

  // No-op edits still persist the value (an override can pin the inherited
  // value) but are not logged.
  if (uname && JSON.stringify(previousValue) !== JSON.stringify(value)) {
    await writeChangeLog({
      nodeId,
      modifiedBy: uname,
      modifiedProperty: cleanName,
      modifiedAt: new Date(),
      fullNode: nodeData,
      ...buildValueChangeLog(propertyType, previousValue, value),
      ...(appName ? { appName } : {}),
    } as NodeChange);
  }

  return { ok: true, changedProperty: cleanName };
}

/**
 * Add/remove link elements on a link-typed property.
 * Maintains propertyOf back-links on the linked nodes.
 */
async function changeLinks(
  ctx: OperationContext,
): Promise<{ ok: true; changedProperty: string }> {
  const { nodeId, nodeData, data, uname, appName } = ctx;

  const nameError = validatePropertyName(data?.propertyName);
  if (nameError) throw new HttpError(400, nameError);
  const cleanName = (data.propertyName as string).trim();

  if (!hasOwn(nodeData.properties, cleanName)) {
    throw new HttpError(404, `Property "${cleanName}" not found on this node`);
  }
  const propertyType = (nodeData.propertyType as any)?.[cleanName];
  if (propertyType === "string" || CHANGE_TYPES.has(propertyType)) {
    throw new HttpError(
      400,
      `Property "${cleanName}" (type "${propertyType ?? "unknown"}") is not link-typed`,
    );
  }

  const isIdArray = (v: any): v is string[] =>
    Array.isArray(v) && v.every((x) => typeof x === "string");
  const added: string[] = isIdArray(data.added)
    ? [...new Set<string>(data.added)]
    : [];
  const removed: string[] = isIdArray(data.removed)
    ? [...new Set<string>(data.removed)]
    : [];
  if (added.length === 0 && removed.length === 0) {
    throw new HttpError(400, "added and/or removed link ids are required");
  }
  const collectionName =
    typeof data.collectionName === "string" ? data.collectionName : "main";

  // Apply the edit to the collections the user actually saw: while inheriting,
  // those live on the referenced node, not in this node's own (stale) copy.
  const inheritedRef = nodeData.inheritance?.[cleanName]?.ref;
  let refData: INode | undefined;
  if (inheritedRef) {
    refData = (await db.collection(NODES).doc(inheritedRef).get()).data() as
      | INode
      | undefined;
  }
  let base: any =
    refData && hasOwn(refData.properties, cleanName)
      ? refData.properties[cleanName]
      : nodeData.properties[cleanName];
  if (!Array.isArray(base) || base.length === 0) {
    base = [{ collectionName: "main", nodes: [] }];
  }
  const previousValue: ICollection[] = JSON.parse(JSON.stringify(base));
  const newValue: ICollection[] = JSON.parse(JSON.stringify(base));

  for (const c of newValue) {
    c.nodes = (c.nodes || []).filter((n) => !removed.includes(n.id));
  }
  let collectionIdx = newValue.findIndex(
    (c) => c.collectionName === collectionName,
  );
  if (collectionIdx === -1) collectionIdx = 0;
  const existingIds = new Set(
    newValue.flatMap((c) => c.nodes.map((n) => n.id)),
  );

  // Fetch each added node for its title and back-links. Ids that don't exist,
  // are deleted, or point at this node itself are skipped, not errors.
  const addedNodes: { id: string; data: INode }[] = [];
  for (const id of added) {
    if (existingIds.has(id) || id === nodeId) continue;
    const d = (await db.collection(NODES).doc(id).get()).data() as
      | INode
      | undefined;
    if (d && !d.deleted) addedNodes.push({ id, data: d });
  }
  newValue[collectionIdx].nodes.push(
    ...addedNodes.map((n) => ({ id: n.id, title: n.data.title ?? "" })),
  );

  // Write the new collections. Editing an inherited property makes it an
  // override: break the ref and copy the referenced node's comments down.
  const wasInheriting = !!inheritedRef;
  const nodeUpdates: Record<string, any> = {
    [`properties.${cleanName}`]: newValue,
  };
  if (wasInheriting) {
    nodeUpdates[`inheritance.${cleanName}.ref`] = null;
    nodeUpdates[`inheritance.${cleanName}.title`] = "";
    if (refData?.textValue && hasOwn(refData.textValue, cleanName)) {
      nodeUpdates[`textValue.${cleanName}`] = refData.textValue[cleanName];
    }
  }
  if (uname && uname !== "ouhrac") {
    nodeUpdates.contributors = FieldValue.arrayUnion(uname);
    nodeUpdates[`contributorsByProperty.${cleanName}`] =
      FieldValue.arrayUnion(uname);
  }
  await db.collection(NODES).doc(nodeId).update(nodeUpdates);

  // Update the back-links: each linked node records in propertyOf which
  // nodes use it as a value of this property.
  const batch = db.batch();
  for (const id of removed) {
    const snap = await db.collection(NODES).doc(id).get();
    const backLinks = (snap.data() as INode | undefined)?.propertyOf?.[
      cleanName
    ];
    if (!Array.isArray(backLinks)) continue;
    for (const c of backLinks) {
      c.nodes = (c.nodes || []).filter((n) => n.id !== nodeId);
    }
    batch.update(snap.ref, { [`propertyOf.${cleanName}`]: backLinks });
  }
  for (const { id, data: d } of addedNodes) {
    const backLinks: ICollection[] = Array.isArray(d.propertyOf?.[cleanName])
      ? (d.propertyOf as any)[cleanName]
      : [{ collectionName: "main", nodes: [] }];
    let main = backLinks.find((c) => c.collectionName === "main");
    if (!main) {
      main = { collectionName: "main", nodes: [] };
      backLinks.push(main);
    }
    if (!main.nodes.some((n) => n.id === nodeId)) {
      main.nodes.push({ id: nodeId });
      batch.update(db.collection(NODES).doc(id), {
        [`propertyOf.${cleanName}`]: backLinks,
      });
    }
  }
  await batch.commit();

  // When newly overriding, re-point inheriting descendants at this node.
  if (wasInheriting) {
    await rewireInheritingDescendants(nodeId, nodeData.title ?? "", cleanName);
  }

  if (uname) {
    await writeChangeLog({
      nodeId,
      modifiedBy: uname,
      modifiedProperty: cleanName,
      previousValue,
      newValue,
      modifiedAt: new Date(),
      changeType: "modify elements",
      fullNode: nodeData,
      ...(appName ? { appName } : {}),
    } as NodeChange);
  }

  return { ok: true, changedProperty: cleanName };
}

const ACTIONS: PropertyAction[] = [
  "add",
  "delete",
  "rename",
  "change",
  "change-links",
];

function fail(res: NextApiResponse, status: number, msg: string) {
  return res.status(status).json({ error: msg, message: msg });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return fail(res, 405, "Method not allowed");

  const data = req.body.data;
  const { action, nodeId, appName, user } = data as {
    action?: PropertyAction;
    nodeId?: string;
    appName?: string;
    user?: any;
  };
  const { uname } = user?.userData || {};

  if (!action || !ACTIONS.includes(action)) {
    return fail(res, 400, `Unknown or missing action "${action}"`);
  }
  if (!nodeId || typeof nodeId !== "string") {
    return fail(res, 400, "nodeId is required");
  }

  try {
    const nodeData = (await db.collection(NODES).doc(nodeId).get()).data() as
      | INode
      | undefined;
    if (!nodeData || nodeData.deleted) return fail(res, 404, "Node not found");
    if (appName && nodeData.appName && nodeData.appName !== appName) {
      return fail(res, 403, "Node does not belong to this app");
    }

    const ctx: OperationContext = { nodeId, nodeData, data, uname, appName };

    let result: { ok: true } & Record<string, any>;
    switch (action) {
      case "add":
        result = await addProperty(ctx);
        break;
      case "delete":
        result = await deleteProperty(ctx);
        break;
      case "rename":
        result = await renameProperty(ctx);
        break;
      case "change":
        result = await changeProperty(ctx);
        break;
      case "change-links":
        result = await changeLinks(ctx);
        break;
    }

    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof HttpError) {
      return fail(res, error.status, error.message);
    }
    console.error("nodes/properties error", error);
    recordLogs(
      {
        type: "error",
        error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
        at: "nodes/properties/update",
      },
      uname,
    );
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
}

export default fbAuth(handler);
