import type { QuickPayload } from "./quick";

export type DraftFrame = { revision: number; payload: QuickPayload };
export type BrowserDraft = DraftFrame & { checkpoint?: DraftFrame };
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const conflict = () =>
  Object.assign(
    new Error(
      "This review changed in another tab. Your unsent choices are kept in this browser. Reload the saved review before continuing.",
    ),
    { status: 409 },
  );

// A lost checkpoint response may have committed. Adopt a newer server revision
// only when its exact payload matches the journaled request; never guess.
export function recoverBrowserDraft(
  server: DraftFrame,
  local?: BrowserDraft | null,
) {
  if (
    !local ||
    !local.payload ||
    local.payload.caseId !== server.payload.caseId ||
    local.payload.submissionId !== server.payload.submissionId
  )
    return server;
  // Older clients did not journal checkpoint requests. A timing-only change
  // can still be reconciled without discarding or guessing about any choice.
  if (
    local.revision <= server.revision &&
    same(
      { ...local.payload, activeTimeMs: 0 },
      { ...server.payload, activeTimeMs: 0 },
    )
  )
    return {
      revision: server.revision,
      payload:
        local.payload.activeTimeMs >= server.payload.activeTimeMs
          ? local.payload
          : server.payload,
    };
  if (
    local.revision === server.revision ||
    (local.checkpoint?.revision === server.revision - 1 &&
      same(local.checkpoint.payload, server.payload))
  )
    return {
      revision: server.revision,
      payload:
        local.payload.activeTimeMs >= server.payload.activeTimeMs
          ? local.payload
          : server.payload,
    };
  throw conflict();
}

/** One draft request at a time. Submission drains this writer first. */
export class ReviewDraftWriter<T extends { draft?: DraftFrame | null }> {
  private frame: DraftFrame;
  private flight: Promise<void> | null = null;
  private uncertain: DraftFrame | null = null;
  private blocked: unknown;
  constructor(
    frame: DraftFrame,
    private send: (attempt: DraftFrame) => Promise<T>,
    private read: () => Promise<T>,
    private journal: (attempt?: DraftFrame) => void,
    private acknowledged: (next: T) => void,
  ) {
    this.frame = clone(frame);
  }
  get revision() {
    return this.frame.revision;
  }
  get writing() {
    return this.flight !== null;
  }
  changed(payload: QuickPayload) {
    return !same(payload, this.frame.payload);
  }
  private accept(next: T) {
    if (!next.draft) throw conflict();
    this.frame = clone(next.draft);
    this.uncertain = null;
    this.journal();
    this.acknowledged(next);
  }
  async settle() {
    if (this.flight) await this.flight.catch(() => undefined);
    if (this.blocked) throw this.blocked;
    const attempt = this.uncertain;
    if (!attempt) return;
    const next = await this.read(),
      draft = next.draft;
    if (
      draft &&
      draft.revision === attempt.revision + 1 &&
      same(draft.payload, attempt.payload)
    )
      this.accept(next);
    else if (
      draft &&
      draft.revision === this.frame.revision &&
      same(draft.payload, this.frame.payload)
    ) {
      // The request did not commit; retaining the known revision permits retry.
      this.uncertain = null;
      this.journal();
    } else {
      this.blocked = conflict();
      throw this.blocked;
    }
  }
  checkpoint(payload: QuickPayload): Promise<void> {
    if (this.flight) return this.flight;
    if (!this.changed(payload)) return Promise.resolve();
    const execute = async () => {
      const attempt = {
        revision: this.frame.revision,
        payload: clone(payload),
      };
      this.journal(attempt);
      try {
        const next = await this.send(attempt);
        if (
          !next.draft ||
          next.draft.revision !== attempt.revision + 1 ||
          !same(next.draft.payload, attempt.payload)
        )
          throw Object.assign(
            new Error(
              "The draft save could not be confirmed. Reconnecting before the next save.",
            ),
            { status: 502 },
          );
        this.accept(next);
      } catch (e: any) {
        const status = e?.status || e?.response?.status;
        if (status === 409) this.blocked = e;
        if (!status || status >= 500 || status === 408)
          this.uncertain = attempt;
        else this.journal();
        throw e;
      }
    };
    // settle starts before assigning flight, so it cannot await its own request.
    const work = this.settle().then(execute);
    this.flight = work.finally(() => {
      this.flight = null;
    });
    return this.flight;
  }
}
