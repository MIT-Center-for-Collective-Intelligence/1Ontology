import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Proposal review store. Proposals are generated algorithms (steps bound to
 * activity nodes) waiting for a reviewer; decisions are written back here.
 * Nothing in this endpoint touches the nodes collection: accepting a proposal
 * records the decision only.
 *
 * Actions: index, list, decide, undecide, place (where a rejected activity
 * goes; recorded on the decision, the hierarchy is not changed), propose
 * (write a parent's derived flow as a pending proposal), families (the other
 * families with proposals and the tasks their children share, for placing).
 */
const PROPOSALS = "proposals";
const OUTCOMES = ["accepted", "edited", "rejected"];

function fail(res: NextApiResponse, status: number, msg: string) {
  return res.status(status).json({ error: msg, message: msg });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return fail(res, 405, "Method not allowed");
  const data = req.body.data || {};
  const { action, appName, user } = data as {
    action?: string;
    appName?: string;
    user?: any;
  };
  const uname: string | undefined = user?.userData?.uname;
  if (!appName || typeof appName !== "string")
    return fail(res, 400, "appName is required");

  try {
    if (action === "index") {
      const snap = await db
        .collection(PROPOSALS)
        .where("appName", "==", appName)
        .where("kind", "==", "algorithm")
        .select("nodeId", "parentId", "status")
        .get();
      const index = snap.docs.map((d) => {
        const x = d.data();
        return {
          nodeId: x.nodeId,
          parentId: x.parentId ?? null,
          status: x.status,
        };
      });
      return res.status(200).json({ index });
    }

    if (action === "list") {
      const nodeIds: string[] = Array.isArray(data.nodeIds) ? data.nodeIds : [];
      const docs: any[] = [];
      // Firestore "in" takes at most 30 ids per query.
      for (let i = 0; i < nodeIds.length; i += 30) {
        const snap = await db
          .collection(PROPOSALS)
          .where("appName", "==", appName)
          .where("nodeId", "in", nodeIds.slice(i, i + 30))
          .get();
        snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
      }
      return res.status(200).json({ proposals: docs });
    }

    if (action === "decide" || action === "undecide") {
      const id = data.proposalId;
      if (!id || typeof id !== "string")
        return fail(res, 400, "proposalId is required");
      const ref = db.collection(PROPOSALS).doc(id);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.appName !== appName)
        return fail(res, 404, `Proposal ${id} not found`);
      if (action === "undecide") {
        await ref.update({
          status: "pending",
          decision: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return res.status(200).json({ ok: true });
      }
      const { outcome, steps, kind, reason, algorithm, doesNotBelong } = data;
      if (!OUTCOMES.includes(outcome))
        return fail(res, 400, "outcome is not valid");
      await ref.update({
        status: outcome,
        decision: {
          outcome,
          ...(Array.isArray(steps) ? { steps } : {}),
          ...(kind ? { kind } : {}),
          ...(algorithm && typeof algorithm === "object" ? { algorithm } : {}),
          ...(reason ? { reason } : {}),
          ...(outcome === "rejected" && doesNotBelong === true
            ? { doesNotBelong: true, movedTo: null }
            : {}),
          by: uname || null,
          at: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ ok: true });
    }

    if (action === "place") {
      const id = data.proposalId;
      if (!id || typeof id !== "string")
        return fail(res, 400, "proposalId is required");
      const ref = db.collection(PROPOSALS).doc(id);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.appName !== appName)
        return fail(res, 404, `Proposal ${id} not found`);
      if (!snap.data()?.decision)
        return fail(res, 400, "The proposal has no decision to place");
      const { movedTo, doesNotBelong } = data;
      const to =
        movedTo && typeof movedTo.id === "string"
          ? { id: movedTo.id, title: String(movedTo.title || "") }
          : null;
      await ref.update({
        "decision.doesNotBelong": doesNotBelong !== false,
        "decision.movedTo": to,
        "decision.placedBy": uname || null,
        "decision.placedAt": FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ ok: true });
    }

    if (action === "propose") {
      // A parent's flow built from its specializations: written as a pending
      // proposal; a proposal already decided is left alone.
      const { nodeId, nodeTitle, parentId, algorithm, steps, kind, from } =
        data;
      if (!nodeId || typeof nodeId !== "string")
        return fail(res, 400, "nodeId is required");
      if (!algorithm || typeof algorithm !== "object")
        return fail(res, 400, "algorithm is required");
      const ref = db.collection(PROPOSALS).doc(`alg_${appName}_${nodeId}`);
      const snap = await ref.get();
      if (snap.exists && snap.data()?.status !== "pending")
        return res.status(200).json({ ok: false, reason: "already decided" });
      const n = Array.isArray(from) ? from.length : 0;
      const doc = {
        kind: "algorithm",
        appName,
        nodeId,
        nodeTitle: String(nodeTitle || ""),
        parentId: typeof parentId === "string" ? parentId : null,
        steps: Array.isArray(steps) ? steps : [],
        flowKind: kind || "sequence",
        flowNote: "",
        rationale: `Tasks that at least half of the ${n} accepted specializations do, in their usual order.`,
        source: `derived from ${n} accepted specializations`,
        flags: [{ t: "derived", k: "info" }],
        status: "pending",
        decision: null,
        algorithm,
        derived: {
          from: Array.isArray(from) ? from : [],
          at: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
        ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      };
      await ref.set(doc, { merge: false });
      return res
        .status(200)
        .json({ ok: true, proposal: { id: ref.id, ...doc } });
    }

    if (action === "families") {
      // Every other family with proposals, with the tasks at least half of
      // its children's flows do.
      const exclude =
        typeof data.excludeParentId === "string" ? data.excludeParentId : null;
      const snap = await db
        .collection(PROPOSALS)
        .where("appName", "==", appName)
        .where("kind", "==", "algorithm")
        .select("parentId", "status", "steps", "decision")
        .get();
      const byParent = new Map<string, Set<string>[]>();
      snap.forEach((d) => {
        const x = d.data();
        if (!x.parentId || x.parentId === exclude || x.status === "rejected")
          return;
        const steps: { id: string }[] = x.decision?.steps || x.steps || [];
        const keys = new Set(steps.map((s) => s.id).filter(Boolean));
        if (!keys.size) return;
        byParent.set(x.parentId, [...(byParent.get(x.parentId) || []), keys]);
      });
      const ids = new Set<string>();
      const fams = [...byParent].map(([parentId, kids]) => {
        const n = new Map<string, number>();
        kids.forEach((k) => k.forEach((id) => n.set(id, (n.get(id) || 0) + 1)));
        const common = [...n]
          .filter(([, c]) => c * 2 >= kids.length)
          .sort((a, b) => b[1] - a[1])
          .map(([id, c]) => ({ id, n: c }));
        common.forEach((c) => ids.add(c.id));
        ids.add(parentId);
        return { parentId, count: kids.length, common };
      });
      const titles = new Map<string, string>();
      const list = [...ids];
      for (let i = 0; i < list.length; i += 100) {
        const refs = list
          .slice(i, i + 100)
          .map((id) => db.collection("nodes").doc(id));
        const docs = await db.getAll(...refs);
        docs.forEach((d) => {
          if (d.exists && !d.data()?.deleted)
            titles.set(d.id, d.data()?.title || "");
        });
      }
      const families = fams
        .filter((f) => titles.has(f.parentId))
        .map((f) => ({
          id: f.parentId,
          title: titles.get(f.parentId) || "",
          count: f.count,
          common: f.common.map((c) => ({
            ...c,
            title: titles.get(c.id) || c.id,
          })),
        }));
      return res.status(200).json({ families });
    }

    return fail(res, 400, "Unknown action");
  } catch (error: any) {
    console.error("review/proposals error", error);
    const message = error?.message || "Internal error";
    return res.status(500).json({ error: message, message });
  }
}

export default fbAuth(handler);
