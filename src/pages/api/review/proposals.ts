import type { NextApiRequest, NextApiResponse } from "next";
import fbAuth from "@components/middlewares/fbAuth";
import { db } from "@components/lib/firestoreServer/admin";
import { FieldValue } from "firebase-admin/firestore";
import { reviewTargets } from "@components/lib/review/reviewTargets";

/**
 * Proposal review store. Proposals are generated algorithms (steps bound to
 * activity nodes) waiting for a reviewer; decisions are written back here.
 * Nothing in this endpoint touches the nodes collection: accepting a proposal
 * records the decision only.
 *
 * Actions: targets (the nodes a review opens on, for the sidebar's list), list, decide, undecide, place (where a rejected activity
 * goes; recorded on the decision, the hierarchy is not changed), save (a
 * step's decisions and places, written together), propose (write a parent's
 * derived flow as a pending proposal), families (the other families with
 * proposals and the tasks their children share, for placing).
 */
const PROPOSALS = "proposals";
const OUTCOMES = ["accepted", "edited", "rejected"];

// The generalizations a reviewer left an activity under, as stored.
function cleanUnder(list: any[]) {
  return list
    .filter((u: any) => u && typeof u.id === "string")
    .map((u: any) => ({
      id: u.id,
      title: String(u.title || ""),
      ...(u.isNew === true
        ? {
            isNew: true,
            parent:
              u.parent && typeof u.parent.id === "string"
                ? { id: u.parent.id, title: String(u.parent.title || "") }
                : null,
          }
        : {}),
    }));
}

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
    if (action === "targets") {
      const snap = await db
        .collection(PROPOSALS)
        .where("appName", "==", appName)
        .where("kind", "==", "algorithm")
        .select("nodeId", "parentId", "status")
        .get();
      const targets = reviewTargets(snap.docs.map((d) => d.data() as any));
      const titles = new Map<string, string>();
      for (let i = 0; i < targets.length; i += 100) {
        const refs = targets
          .slice(i, i + 100)
          .map((t) => db.collection("nodes").doc(t.id));
        const docs = await db.getAll(...refs);
        docs.forEach((d) => {
          if (d.exists && !d.data()?.deleted)
            titles.set(d.id, d.data()?.title || "");
        });
      }
      const nodes = targets
        .filter((t) => titles.has(t.id))
        .map((t) => ({ ...t, title: titles.get(t.id) || "" }))
        .sort((a, b) => a.title.localeCompare(b.title));
      return res.status(200).json({ nodes });
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
            ? { doesNotBelong: true, under: null }
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
      // The generalizations it should be under, as the reviewer left them.
      const under = Array.isArray(data.under) ? cleanUnder(data.under) : null;
      if (!under) return fail(res, 400, "under must be a list");
      await ref.update({
        "decision.under": under,
        "decision.placedBy": uname || null,
        "decision.placedAt": FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ ok: true });
    }

    if (action === "save") {
      // The changes of one step: each proposal's decision as the reviewer
      // left it, written together or not at all.
      const changes: any[] = Array.isArray(data.changes) ? data.changes : [];
      if (!changes.length) return fail(res, 400, "changes is required");
      for (const c of changes) {
        if (!c || typeof c.proposalId !== "string")
          return fail(res, 400, "proposalId is required");
        if (c.outcome !== null && !OUTCOMES.includes(c.outcome))
          return fail(res, 400, "outcome is not valid");
      }
      const refs = changes.map((c) =>
        db.collection(PROPOSALS).doc(c.proposalId),
      );
      const snaps = await db.getAll(...refs);
      const missing = snaps.find(
        (d) => !d.exists || d.data()?.appName !== appName,
      );
      if (missing) return fail(res, 404, `Proposal ${missing.id} not found`);
      const batch = db.batch();
      changes.forEach((c, i) => {
        if (c.outcome === null) {
          batch.update(refs[i], {
            status: "pending",
            decision: null,
            updatedAt: FieldValue.serverTimestamp(),
          });
          return;
        }
        const out = c.outcome === "rejected" && c.doesNotBelong === true;
        batch.update(refs[i], {
          status: c.outcome,
          decision: {
            outcome: c.outcome,
            ...(Array.isArray(c.steps) ? { steps: c.steps } : {}),
            ...(c.kind ? { kind: c.kind } : {}),
            ...(c.algorithm && typeof c.algorithm === "object"
              ? { algorithm: c.algorithm }
              : {}),
            ...(c.inheritance && typeof c.inheritance === "object"
              ? { inheritance: c.inheritance }
              : {}),
            ...(c.reason ? { reason: c.reason } : {}),
            ...(out
              ? {
                  doesNotBelong: true,
                  under: Array.isArray(c.under) ? cleanUnder(c.under) : null,
                }
              : {}),
            by: uname || null,
            at: FieldValue.serverTimestamp(),
          },
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      return res.status(200).json({ ok: true });
    }

    if (action === "propose") {
      // A parent's flow built from its specializations: written as a pending
      // proposal; a proposal already decided is left alone.
      const {
        nodeId,
        nodeTitle,
        parentId,
        algorithm,
        steps,
        kind,
        from,
        inheritance,
      } = data;
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
        // how each accepted specialization inherits the parts, as computed
        // by the client that built the flow
        ...(inheritance && typeof inheritance === "object"
          ? { inheritance }
          : {}),
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
