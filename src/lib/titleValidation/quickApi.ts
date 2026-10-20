import type { NextApiRequest, NextApiResponse } from "next";
import { actorFor } from "./api";
import { TitleValidationError } from "./engine";
import { getQuickDataset } from "./quickDataset";
import {
  QUICK_QA_ID,
  QUICK_SELECTION_QA_ID,
  QUICK_STUDY_ID,
  quickKey,
  quickSession,
  quickStatus,
  saveQuick,
  QuickState,
} from "./quick";
import { withQuickStudy } from "./quickRepository";
import { STUDY_COLLECTION } from "./repository";
import {
  makeQuickSelection,
  quickAnswerSelection,
  quickSelectionManifest,
  quickSelectionRelease,
  selectionHash,
} from "./quickSelection";

export async function quickTitleHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Vary", "Authorization");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body
        : {};
    const actor = await actorFor(req, body);
    if (!actor.preview && process.env.TITLE_VALIDATION_RELEASED !== "1")
      throw new TitleValidationError(503, "This review is not enabled yet.");
    if (body.qa && !actor.canManage)
      throw new TitleValidationError(
        403,
        "Software tests are coordinator-only.",
      );
    if (body.qa !== undefined && ![false, true, "selection"].includes(body.qa))
      throw new TitleValidationError(400, "Unknown software test study.");
    if (body.pool !== undefined && !["regular", "flagged"].includes(body.pool))
      throw new TitleValidationError(400, "Unknown review set.");
    const id =
        body.qa === "selection"
          ? QUICK_SELECTION_QA_ID
          : body.qa
            ? QUICK_QA_ID
            : QUICK_STUDY_ID,
      flagged = body.pool === "flagged",
      data = getQuickDataset(),
      action = String(req.query.action);
    const allowed = [
      "quick-session",
      "quick-status",
      "quick-checkpoint",
      "quick-respond",
      "quick-manage",
      "quick-export",
    ];
    if (!allowed.includes(action))
      throw new TitleValidationError(404, "Unknown review action.");
    let additions: { reviewerId: string; label: string }[] = [];
    if (action === "quick-manage") {
      if (!actor.canManage)
        throw new TitleValidationError(
          403,
          "Only coordinators can manage assignments.",
        );
      if (body.operation === "add") {
        if (
          !Array.isArray(body.reviewers) ||
          !body.reviewers.length ||
          body.reviewers.length > 10
        )
          throw new TitleValidationError(
            400,
            "Enter 1–10 existing account emails.",
          );
        const { admin } = await import("../firestoreServer/admin");
        additions = await Promise.all(
          body.reviewers.map(async (row: any) => {
            try {
              const user = await admin
                .auth()
                .getUserByEmail(String(row.email).trim());
              if (user.disabled) throw Error();
              return {
                reviewerId: user.uid,
                label: String(
                  user.displayName || row.label || user.email,
                ).slice(0, 80),
              };
            } catch {
              throw new TitleValidationError(
                400,
                "One account could not be found or is disabled. Use an existing ontology account.",
              );
            }
          }),
        );
      } else if (!["expand", "activate-selection"].includes(body.operation))
        throw new TitleValidationError(400, "Unknown assignment change.");
    }
    if (action === "quick-manage" && !actor.preview) {
      const { db } = await import("../firestoreServer/admin");
      const ref = db.collection(STUDY_COLLECTION).doc(id);
      const result = await db.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        if (!doc.exists)
          throw new TitleValidationError(
            404,
            "The review has not been prepared yet.",
          );
        const study = doc.data()!.study as QuickState["study"];
        const now = Date.now();
        if (body.operation === "activate-selection") {
          const release = quickSelectionRelease(data);
          if (
            body.selectionVersion !== release.selectionVersion ||
            body.selectionSha256 !== release.selectionSha256 ||
            selectionHash(body.initialOutcomes) !==
              selectionHash(release.initialOutcomes) ||
            selectionHash(body.reservedOutcomes) !==
              selectionHash(release.reservedOutcomes) ||
            selectionHash(body.selectionCoverage) !==
              selectionHash(release.selectionCoverage)
          )
            throw new TitleValidationError(
              409,
              "Confirm the exact committed selection and coverage.",
            );
          if (study.selection) {
            if (
              study.selection.version !== release.selectionVersion ||
              study.selection.sha256 !== release.selectionSha256
            )
              throw new TitleValidationError(
                409,
                "A different selection is already active.",
              );
            return { ok: true, duplicate: true, ...release };
          }
          if (
            !body.qa &&
            (!process.env.K_REVISION ||
              body.compatibleRevision !== process.env.K_REVISION ||
              body.drainedOldRevisions !== true)
          )
            throw new TitleValidationError(
              409,
              "Activation is disabled until compatible production traffic is verified and old mutating revisions are drained.",
            );
          const [answerDocs, draftDocs] = await Promise.all([
            tx.get(ref.collection("answers")),
            tx.get(ref.collection("drafts")),
          ]);
          const state: QuickState = {
            study,
            answers: Object.fromEntries(
              answerDocs.docs.map((d) => [d.id, d.data() as any]),
            ),
            drafts: Object.fromEntries(
              draftDocs.docs.map((d) => [d.id, d.data() as any]),
            ),
          };
          quickStatus(state, data, actor.uid, false, true, now);
          const protectedDrafts = Object.values(state.drafts).filter(
            (d) =>
              quickSelectionManifest.protectedCaseIds.includes(d.caseId) &&
              !state.answers[quickKey(d.reviewerId, d.caseId)],
          );
          if (
            !body.qa &&
            (protectedDrafts.length !== 1 ||
              !study.roster.some(
                (r) => r.reviewerId === protectedDrafts[0].reviewerId,
              ) ||
              selectionHash(
                state.drafts[
                  quickKey(
                    protectedDrafts[0].reviewerId,
                    protectedDrafts[0].caseId,
                  )
                ],
              ) !== body.protectedDraftSha256)
          )
            throw new TitleValidationError(
              409,
              "Verify the unchanged protected production draft snapshot first.",
            );
          const selection = makeQuickSelection(state, data, now);
          tx.update(ref, { "study.selection": selection });
          tx.create(ref.collection("events").doc(release.selectionVersion), {
            kind: "quick-selection-activated",
            actorId: actor.uid,
            at: now,
            baseRevision: quickSelectionManifest.baseRevision,
            ...release,
            previousInitialCaseIds: data.cases
              .filter((c) => c.batch === "first25")
              .map((c) => c.id),
            initialCaseIds: quickSelectionManifest.initialCaseIds,
            draftSnapshots: Object.entries(state.drafts)
              .filter(([key]) => selection.legacyDrafts[key])
              .map(([key, draft]) => ({
                key,
                sha256: selectionHash(draft),
                draft,
              })),
          });
          return { ok: true, ...release };
        }
        const roster = [...study.roster];
        for (const row of additions)
          if (!roster.some((r) => r.reviewerId === row.reviewerId))
            roster.push(row);
        tx.update(
          ref,
          body.operation === "expand"
            ? { "study.regularLimit": 100 }
            : { "study.roster": roster },
        );
        tx.create(ref.collection("events").doc(), {
          kind: "quick-assignments-updated",
          actorId: actor.uid,
          at: now,
          operation: body.operation,
          regularLimit: body.operation === "expand" ? 100 : study.regularLimit,
        });
        return {
          ok: true,
          regularLimit: body.operation === "expand" ? 100 : study.regularLimit,
        };
      });
      return res.status(200).json(result);
    }
    if (action === "quick-status" && !actor.preview) {
      const { db } = await import("../firestoreServer/admin");
      const ref = db.collection(STUDY_COLLECTION).doc(id),
        doc = await ref.get();
      if (!doc.exists)
        throw new TitleValidationError(
          404,
          "The review has not been prepared yet.",
        );
      const [answers, drafts] = await Promise.all([
        ref.collection("answers").where("reviewerId", "==", actor.uid).get(),
        ref.collection("drafts").where("reviewerId", "==", actor.uid).get(),
      ]);
      const state: QuickState = {
        study: doc.data()!.study,
        answers: Object.fromEntries(
          answers.docs.map((d) => [d.id, d.data() as any]),
        ),
        drafts: Object.fromEntries(
          drafts.docs.map((d) => [d.id, d.data() as any]),
        ),
      };
      return res
        .status(200)
        .json({
          ...quickStatus(
            state,
            data,
            actor.uid,
            flagged,
            actor.canManage,
            Date.now(),
          ),
          preview: false,
        });
    }
    if (action === "quick-export") {
      if (!actor.canManage)
        throw new TitleValidationError(
          403,
          "Only coordinators can export team reviews.",
        );
      const { db } = await import("../firestoreServer/admin");
      const ref = db.collection(STUDY_COLLECTION).doc(id),
        doc = await ref.get();
      if (!doc.exists)
        throw new TitleValidationError(
          404,
          "The review has not been prepared yet.",
        );
      const [answers, drafts, events] = await Promise.all([
        ref.collection("answers").get(),
        ref.collection("drafts").get(),
        ref.collection("events").get(),
      ]);
      const state: QuickState = {
        study: doc.data()!.study,
        answers: Object.fromEntries(
          answers.docs.map((d) => [d.id, d.data() as any]),
        ),
        drafts: Object.fromEntries(
          drafts.docs.map((d) => [d.id, d.data() as any]),
        ),
      };
      const own = quickStatus(state, data, actor.uid, false, true, Date.now());
      if (
        state.study.roster.some((r) => r.reviewerId === actor.uid) &&
        (own.completed !== own.total || Boolean(own.item)) &&
        !body.qa
      )
        throw new TitleValidationError(
          403,
          "Finish your regular reviews before opening other reviewers’ answers.",
        );
      return res.status(200).json({
        formatVersion: "quick-title-review-export-v1",
        study: state.study,
        answers: answers.docs.map((d) => d.data()),
        drafts: drafts.docs.map((d) => d.data()),
        events: events.docs.map((d) => ({ id: d.id, record: d.data() })),
        selection: {
          ...quickSelectionRelease(data),
          initialCaseIds: quickSelectionManifest.initialCaseIds,
          active: Boolean(state.study.selection),
        },
        answerSelections: Object.fromEntries(
          Object.values(state.answers).map((a) => [
            a.id,
            quickAnswerSelection(
              state,
              data.cases.find((c) => c.id === a.caseId)!,
              a,
            ),
          ]),
        ),
        dataset: data,
        interpretation:
          "Individual human judgments, not ontology edits or population accuracy. Active page time and elapsed time differ; interruptions and software tests remain identified.",
      });
    }
    const result = await withQuickStudy<any>(
      id,
      actor.uid,
      actor.preview,
      (state) => {
        if (!state && (actor.preview || (body.qa && actor.canManage))) {
          state = {
            study: {
              id,
              protocol: "quick-title-verification-v1",
              datasetVersion: data.version,
              roster: actor.preview
                ? ["preview-a", "preview-b", "preview-c"].map((reviewerId) => ({
                    reviewerId,
                    label: reviewerId,
                  }))
                : [
                    {
                      reviewerId: actor.uid,
                      label: "SOFTWARE TEST — not human review evidence",
                    },
                  ],
              flaggedReviewerIds: [actor.uid],
              regularLimit: 25,
              createdAt: Date.now(),
              ...(body.qa ? { softwareQA: true } : {}),
            },
            answers: {},
            drafts: {},
          };
          if (body.qa === "selection")
            state.study.selection = makeQuickSelection(state, data, Date.now());
        }
        if (!state)
          throw new TitleValidationError(
            404,
            "The coordinator is preparing the new review. Earlier pilot answers remain available through the earlier-pilot link.",
          );
        if (action === "quick-manage") {
          if (body.operation === "activate-selection")
            state.study.selection = makeQuickSelection(state, data, Date.now());
          else if (body.operation === "expand") state.study.regularLimit = 100;
          else
            for (const row of additions)
              if (
                !state.study.roster.some((r) => r.reviewerId === row.reviewerId)
              )
                state.study.roster.push(row);
          return {
            state,
            result: { ok: true, regularLimit: state.study.regularLimit },
            event: {
              kind: "quick-assignments-updated",
              actorId: actor.uid,
              operation: body.operation,
              regularLimit: state.study.regularLimit,
            },
          };
        }
        let event: Record<string, unknown> | undefined;
        if (action === "quick-checkpoint" || action === "quick-respond") {
          const saved = saveQuick(
            state,
            data,
            actor.uid,
            flagged,
            actor.canManage,
            body.payload,
            body.revision,
            action === "quick-respond",
            Date.now(),
          );
          if (!saved.duplicate && action === "quick-respond")
            event = {
              kind: "quick-answer-submitted",
              actorId: actor.uid,
              caseId: body.payload.caseId,
              answerId: quickKey(actor.uid, body.payload.caseId),
              softwareQA: Boolean(state.study.softwareQA),
              selection:
                state.answers[quickKey(actor.uid, body.payload.caseId)]
                  .selection,
            };
        }
        const session = (
          action === "quick-status" ? quickStatus : quickSession
        )(state, data, actor.uid, flagged, actor.canManage, Date.now());
        return {
          state,
          result: { ...session, preview: actor.preview },
          ...(event ? { event } : {}),
        };
      },
    );
    return res.status(200).json(result);
  } catch (e) {
    const status = e instanceof TitleValidationError ? e.status : 500;
    if (status === 500)
      console.error(
        "Quick title review failed",
        e instanceof Error ? e.name : "UnknownError",
      );
    return res.status(status).json({
      error:
        status === 500
          ? "Your review could not be loaded or saved. Existing answers are unchanged."
          : (e as Error).message,
    });
  }
}
