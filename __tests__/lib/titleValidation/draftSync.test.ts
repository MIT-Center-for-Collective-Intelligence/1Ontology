import {
  ReviewDraftWriter,
  recoverBrowserDraft,
  type DraftFrame,
} from "../../../src/lib/titleValidation/draftSync";
const base = (): DraftFrame => ({
  revision: 0,
  payload: {
    caseId: "case",
    ratings: { q: { value: "", explanation: "" } },
    correction: "",
    interruption: "",
    activeTimeMs: 0,
    submissionId: "test-submission",
  },
});
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
test("only one draft write runs; draining it supplies the acknowledged revision for submission", async () => {
  let finish!: (v: any) => void;
  const send = jest.fn(
    () =>
      new Promise<any>((r) => {
        finish = r;
      }),
  );
  const journal = jest.fn(),
    ack = jest.fn();
  const writer = new ReviewDraftWriter(base(), send, jest.fn(), journal, ack);
  const p = {
    ...base().payload,
    correction: "Latest choice",
    activeTimeMs: 1000,
  };
  const first = writer.checkpoint(p);
  await Promise.resolve();
  expect(writer.checkpoint(p)).toBe(first);
  let drained = false;
  const drain = writer.settle().then(() => {
    drained = true;
  });
  expect(drained).toBe(false);
  expect(send).toHaveBeenCalledTimes(1);
  finish({ draft: { revision: 1, payload: p } });
  await drain;
  expect(writer.revision).toBe(1);
  expect(ack).toHaveBeenCalledTimes(1);
  await writer.checkpoint(p);
  expect(send).toHaveBeenCalledTimes(1);
});
test.each([true, false])(
  "a lost response is reconciled before the next write (committed=%s)",
  async (committed) => {
    const frame = base(),
      p = { ...frame.payload, activeTimeMs: 1000 };
    const send = jest.fn().mockRejectedValue(new TypeError("Connection lost"));
    const read = jest.fn().mockResolvedValue({
      draft: committed ? { revision: 1, payload: p } : frame,
    });
    const writer = new ReviewDraftWriter(
      frame,
      send,
      read,
      jest.fn(),
      jest.fn(),
    );
    await expect(writer.checkpoint(p)).rejects.toThrow("Connection lost");
    await writer.settle();
    expect(read).toHaveBeenCalledTimes(1);
    expect(writer.revision).toBe(committed ? 1 : 0);
  },
);
test("another tab's write is never adopted as this client's checkpoint", async () => {
  const p = { ...base().payload, correction: "My text" };
  const writer = new ReviewDraftWriter(
    base(),
    jest.fn().mockRejectedValue(new TypeError("Lost")),
    jest.fn().mockResolvedValue({
      draft: { revision: 1, payload: { ...p, correction: "Other tab" } },
    }),
    jest.fn(),
    jest.fn(),
  );
  await expect(writer.checkpoint(p)).rejects.toThrow("Lost");
  await expect(writer.settle()).rejects.toMatchObject({ status: 409 });
  await expect(writer.checkpoint(p)).rejects.toMatchObject({ status: 409 });
});
test("reload retains later local edits after a journaled checkpoint committed without its response", () => {
  const checkpoint = {
    ...base(),
    payload: { ...base().payload, activeTimeMs: 1000 },
  };
  const local = {
    ...copy(checkpoint),
    payload: {
      ...checkpoint.payload,
      correction: "Typed after request",
      activeTimeMs: 2000,
    },
    checkpoint,
  };
  const server = { revision: 1, payload: copy(checkpoint.payload) };
  expect(recoverBrowserDraft(server, local)).toEqual({
    revision: 1,
    payload: local.payload,
  });
  expect(() =>
    recoverBrowserDraft(
      { revision: 2, payload: { ...server.payload, correction: "Other tab" } },
      local,
    ),
  ).toThrow("another tab");
});
test("old clients' timing-only checkpoints recover without falsely treating unchanged choices as a conflict", () => {
  const local = base(),
    server = { revision: 2, payload: { ...local.payload, activeTimeMs: 2000 } };
  expect(recoverBrowserDraft(server, local)).toEqual(server);
  const latest = {
    ...local,
    payload: { ...local.payload, activeTimeMs: 3000 },
  };
  expect(recoverBrowserDraft(server, latest)).toEqual({
    revision: 2,
    payload: latest.payload,
  });
});
