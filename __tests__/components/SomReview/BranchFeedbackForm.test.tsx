/** @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { createHash } from 'crypto';

jest.mock('../../../src/lib/firestoreClient/auth', () => ({
  getIdToken: jest.fn().mockResolvedValue('synthetic-review-token'),
}));

import BranchFeedbackForm from '../../../src/components/SomReview/BranchFeedbackForm';
import { relationshipRequest } from '../../../src/lib/relationshipReview/client';
import { GENERALIZATION_BRANCH_VERSION } from '../../../src/types/IBranchReview';
import type { BranchDataset, BranchFamily, BranchSession } from '../../../src/types/IBranchReview';
import type { RelationshipFeedback } from '../../../src/types/IRelationshipReview';

const NOTE = 'Keep the independent Generalizations visible.';
const CORRECTION = 'Review all proposed Specializations together.';
const RAW_NOTE = `  ${NOTE}  `;
const RAW_CORRECTION = `  ${CORRECTION}  `;
const REBASE = 'I reviewed the latest feedback; keep my draft';
const FORM = 'Whole-family arrangement feedback';
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

function syntheticFamily(id: string): BranchFamily {
  return {
    id, title: `Synthetic ${id}`, description: 'Synthetic family description.',
    generalizations: [
      { id: `${id}-generalization-one`, title: 'First independent Generalization' },
      { id: `${id}-generalization-two`, title: 'Second independent Generalization' },
    ],
    currentSpecializations: [{ id: `${id}-specialization`, title: 'Current Specialization' }],
    currentSourceRecords: [], summary: 'Review the complete arrangement.',
    scopeNote: 'Feedback only; no ontology changes.', groups: [],
    sourceCaseIds: [], remainingQuestions: [],
  };
}

const FIRST = syntheticFamily('family-one');
const SECOND = syntheticFamily('family-two');
const DATASET: BranchDataset = {
  schemaVersion: 'generalization-branch-review-v1',
  version: GENERALIZATION_BRANCH_VERSION,
  title: 'Synthetic whole-family review', createdAt: '2026-10-24T12:00:00.000Z',
  model: 'synthetic', modelVersion: 'synthetic-v1', reasoning: 'Synthetic fixture.',
  fundingRoute: 'ACCESS', sourceApp: 'synthetic-test',
  sourceCapturedAt: '2026-10-24T10:00:00.000Z', sourceRecheckedAt: '2026-10-24T11:00:00.000Z',
  sourceSha256: sha256('synthetic source graph'),
  priorDatasetVersion: 'synthetic-child-review-v1',
  priorDatasetSha256: sha256('synthetic child review'),
  scopeNote: 'Whole-family feedback is separate from child-case feedback.',
  titleStatusNote: 'Synthetic titles.', nounNote: 'Synthetic fixture.',
  prompt: 'Synthetic public test template.', criticPrompts: [], families: [FIRST, SECOND],
};

function makeSession(options: Partial<BranchSession> = {}): BranchSession {
  const dataset = options.dataset ?? DATASET;
  return {
    dataset, datasetSha256: sha256(JSON.stringify(dataset)),
    reviewerKey: 'reviewer-one', reviewerLabel: 'Synthetic reviewer',
    feedback: {}, preview: false, peerReviewer: null, canViewPeerFeedback: false,
    legacy: { version: dataset.priorDatasetVersion, sha256: dataset.priorDatasetSha256 },
    ...options,
  };
}

function answer(overrides: Partial<RelationshipFeedback> = {}): RelationshipFeedback {
  return {
    caseId: FIRST.id, datasetVersion: DATASET.version, decision: 'disagree',
    note: NOTE, correction: CORRECTION, revisitLater: true, revision: 1,
    savedAt: '2026-10-24T12:01:00.000Z', ...overrides,
  };
}

// Mock only HTTP transport; both modes use the real request client.
const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  window.sessionStorage.clear();
  globalThis.fetch = fetchMock as typeof fetch;
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  globalThis.fetch = originalFetch;
});

function reply(data: unknown, status = 200): Response {
  return { status, ok: status >= 200 && status < 300, json: async () => data } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function posted(index: number) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, init, body: JSON.parse(init.body as string) as Record<string, unknown> };
}

function click(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
}

function fillDraft(note = RAW_NOTE) {
  fireEvent.click(screen.getByRole('radio', { name: 'Disagree' }));
  fireEvent.change(screen.getByLabelText('Comment (optional)'), { target: { value: note } });
  fireEvent.change(screen.getByLabelText('Suggested changes (optional)'), { target: { value: RAW_CORRECTION } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Revisit later' }));
}

function expectDraft(note = RAW_NOTE) {
  expect(screen.getByLabelText('Comment (optional)')).toHaveValue(note);
  expect(screen.getByLabelText('Suggested changes (optional)')).toHaveValue(RAW_CORRECTION);
  expect(screen.getByRole('radio', { name: 'Disagree' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Revisit later' })).toBeChecked();
}

async function confirmed(revision = 1) {
  await screen.findByText(`Feedback saved for this whole family (revision ${revision}).`);
}

it.each([false, true])('uses the same save API and reloads server feedback (preview=%s)', async (preview) => {
  const initial = makeSession({ preview });
  const persisted = answer();
  const onSaved = jest.fn();
  fetchMock.mockResolvedValueOnce(reply({ answer: persisted }));
  const view = render(<BranchFeedbackForm session={initial} family={FIRST} onSaved={onSaved} />);
  fillDraft();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(window.sessionStorage.length).toBe(1);
  click('Save feedback');
  await confirmed();

  const sent = posted(0);
  expect(sent.url).toBe('/api/som-review/relationships/branch-save');
  expect(sent.init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
  expect(sent.init.headers).toEqual({
    'Content-Type': 'application/json',
    ...(preview ? {} : { Authorization: 'Bearer synthetic-review-token' }),
  });
  expect(sent.body).toEqual({
    caseId: FIRST.id, datasetVersion: DATASET.version, datasetSha256: initial.datasetSha256,
    reviewerKey: initial.reviewerKey, decision: 'disagree', note: NOTE,
    correction: CORRECTION, revisitLater: true, revision: 0,
    requestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  });
  expect(onSaved).toHaveBeenCalledTimes(1);
  expect(onSaved).toHaveBeenCalledWith(persisted);
  expect(window.sessionStorage.length).toBe(0);
  view.unmount();

  const withoutServerFeedback = render(<BranchFeedbackForm session={initial} family={FIRST} />);
  expect(screen.getByLabelText('Comment (optional)')).toHaveValue('');
  expect(screen.queryByText(/Previously saved family feedback/)).not.toBeInTheDocument();
  withoutServerFeedback.unmount();

  const latest = makeSession({ preview, feedback: { [FIRST.id]: persisted } });
  fetchMock.mockResolvedValueOnce(reply(latest));
  const query = { datasetVersion: DATASET.version, datasetSha256: initial.datasetSha256 };
  const reloaded: BranchSession = await relationshipRequest('branch-session', query, preview);
  expect(posted(1).url).toBe('/api/som-review/relationships/branch-session');
  expect(posted(1).body).toEqual(query);
  expect(posted(1).init.headers).toEqual(sent.init.headers);
  render(<BranchFeedbackForm session={reloaded} family={FIRST} />);
  expect(screen.getByLabelText('Comment (optional)')).toHaveValue(NOTE);
  expect(screen.getByLabelText('Suggested changes (optional)')).toHaveValue(CORRECTION);
  expect(screen.getByRole('radio', { name: 'Disagree' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Save feedback' })).toBeDisabled();
  expect(screen.getByText('Previously saved family feedback (revision 1)').closest('details')).not.toHaveAttribute('open');
  expect(window.sessionStorage.length).toBe(0);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it.each([false, true])('retains a failed draft and identical pending request through retries and reload (preview=%s)', async (preview) => {
  const initial = makeSession({ preview });
  const persisted = answer();
  const onSaved = jest.fn();
  fetchMock.mockRejectedValueOnce(new Error('Simulated connection loss after commit'));
  const view = render(<BranchFeedbackForm session={initial} family={FIRST} onSaved={onSaved} />);
  fillDraft();
  click('Save feedback');
  await screen.findByRole('button', { name: 'Retry save' });
  expectDraft();
  expect(screen.getByLabelText('Comment (optional)')).toBeDisabled();
  expect(onSaved).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const payload = posted(0).init.body;

  const unbound = answer(preview ? { caseId: SECOND.id } : { datasetVersion: DATASET.priorDatasetVersion });
  fetchMock.mockResolvedValueOnce(reply({ answer: unbound }));
  click('Retry save');
  await screen.findByRole('button', { name: 'Retry save' });
  expect(posted(1).init.body).toBe(payload);
  expectDraft();
  expect(screen.getByLabelText('Comment (optional)')).toBeDisabled();
  expect(onSaved).not.toHaveBeenCalled();
  view.unmount();

  fetchMock.mockResolvedValueOnce(reply(makeSession({ preview, feedback: { [FIRST.id]: persisted } })));
  const reloaded: BranchSession = await relationshipRequest('branch-session', {
    datasetVersion: DATASET.version, datasetSha256: initial.datasetSha256,
  }, preview);
  render(<BranchFeedbackForm session={reloaded} family={FIRST} onSaved={onSaved} />);
  expectDraft();
  expect(screen.getByLabelText('Comment (optional)')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Retry save' })).toBeEnabled();
  fetchMock.mockResolvedValueOnce(reply({ answer: persisted }));
  click('Retry save');
  await confirmed();
  expect(posted(3).url).toBe('/api/som-review/relationships/branch-save');
  expect(posted(3).init.body).toBe(payload);
  expect(onSaved).toHaveBeenCalledTimes(1);
  expect(onSaved).toHaveBeenCalledWith(persisted);
  expect(window.sessionStorage.length).toBe(0);
});

it.each(['hash', 'account', 'version', 'family'] as const)('requires explicit loading, verified %s binding and deliberate rebasing after conflict', async (binding) => {
  const initial = makeSession({ preview: true, feedback: { [FIRST.id]: answer({
    decision: 'agree', note: 'Initial server judgment.', correction: '', revisitLater: false, revision: 2,
  }) } });
  const latest = makeSession({ preview: true, feedback: { [FIRST.id]: answer({
    decision: 'discuss', note: 'Latest server judgment.', correction: 'Latest server suggestions.', revisitLater: false, revision: 3,
  }) } });
  const onLatestSession = jest.fn();
  const onSaved = jest.fn();
  fetchMock.mockResolvedValueOnce(reply({ error: 'Revision changed' }, 409));
  render(<BranchFeedbackForm session={initial} family={FIRST} onSaved={onSaved} onLatestSession={onLatestSession} />);
  fillDraft();
  click('Save feedback');
  await screen.findByText(/The save conflicted with a newer revision/);
  expectDraft();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: REBASE })).toBeDisabled();
  fireEvent.submit(screen.getByRole('form', { name: FORM }));
  expect(fetchMock).toHaveBeenCalledTimes(1);

  const invalidLatest = {
    hash: { ...latest, datasetSha256: sha256('another frozen dataset') },
    account: { ...latest, reviewerKey: 'reviewer-two' },
    version: { ...latest, dataset: { ...latest.dataset, version: DATASET.priorDatasetVersion } },
    family: { ...latest, dataset: { ...latest.dataset, families: [SECOND] } },
  }[binding];
  fetchMock.mockResolvedValueOnce(reply(invalidLatest));
  click('Load latest feedback');
  await screen.findByText(/Latest family feedback could not be loaded or verified/);
  expect(onLatestSession).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: REBASE })).toBeDisabled();
  expectDraft();

  fetchMock.mockResolvedValueOnce(reply(latest));
  click('Retry loading latest feedback');
  await screen.findByText('Latest saved family feedback (revision 3)');
  expect(screen.getByText('Comment: Latest server judgment.')).toBeInTheDocument();
  expect(onLatestSession).toHaveBeenCalledWith(latest);
  const query = { datasetVersion: DATASET.version, datasetSha256: initial.datasetSha256 };
  expect(posted(1).body).toEqual(query);
  expect(posted(2).body).toEqual(query);
  click(REBASE);
  expectDraft();
  expect(screen.getByLabelText('Comment (optional)')).toBeEnabled();
  expect(fetchMock).toHaveBeenCalledTimes(3);

  const persisted = answer({ revision: 4 });
  fetchMock.mockResolvedValueOnce(reply({ answer: persisted }));
  click('Save feedback');
  await confirmed(4);
  expect(posted(3).body).toEqual({ ...posted(0).body, revision: 3, requestId: expect.any(String) });
  expect(posted(3).body.requestId).not.toBe(posted(0).body.requestId);
  expect(onSaved).toHaveBeenCalledWith(persisted);
  expect(window.sessionStorage.length).toBe(0);
});

it('guards double submission while the API request is unresolved', async () => {
  const held = deferred<Response>();
  const onSaved = jest.fn();
  fetchMock.mockReturnValueOnce(held.promise);
  render(<BranchFeedbackForm session={makeSession({ preview: true })} family={FIRST} onSaved={onSaved} />);
  fillDraft();
  fireEvent.submit(screen.getByRole('form', { name: FORM }));
  fireEvent.submit(screen.getByRole('form', { name: FORM }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'Saving feedback…' })).toBeDisabled();
  await act(async () => { held.resolve(reply({ answer: answer() })); });
  await confirmed();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(onSaved).toHaveBeenCalledTimes(1);
});

type Navigation = {
  name: string;
  next: (initial: BranchSession) => { session: BranchSession; family: BranchFamily };
  backBeforeReply?: boolean;
};
const NAVIGATION: Navigation[] = [
  { name: 'family navigation', next: (initial) => ({ session: initial, family: SECOND }) },
  { name: 'account change and return', backBeforeReply: true, next: (initial) => ({
    session: { ...initial, reviewerKey: 'reviewer-two', reviewerLabel: 'Other synthetic reviewer' }, family: FIRST,
  }) },
  { name: 'dataset hash change', next: (initial) => ({
    session: makeSession({ preview: initial.preview, dataset: { ...initial.dataset, title: 'Another synthetic frozen arrangement' } }), family: FIRST,
  }) },
  { name: 'preview mode change and return', backBeforeReply: true, next: (initial) => ({
    session: { ...initial, preview: true }, family: FIRST,
  }) },
];

it.each(NAVIGATION)('ignores stale saves on $name and keeps isolated drafts', async ({ next, backBeforeReply }) => {
  const initial = makeSession();
  const other = next(initial);
  const held = deferred<Response>();
  const onSaved = jest.fn();
  fetchMock.mockReturnValueOnce(held.promise);
  const view = render(<BranchFeedbackForm session={initial} family={FIRST} onSaved={onSaved} />);
  fillDraft();
  click('Save feedback');
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const payload = posted(0).init.body;
  view.rerender(<BranchFeedbackForm {...other} onSaved={onSaved} />);
  expect(screen.getByLabelText('Comment (optional)')).toHaveValue('');
  fillDraft('Other unsaved draft');
  if (backBeforeReply) view.rerender(<BranchFeedbackForm session={initial} family={FIRST} onSaved={onSaved} />);
  await act(async () => { held.resolve(reply({ answer: answer() })); });
  expect(onSaved).not.toHaveBeenCalled();
  expectDraft(backBeforeReply ? RAW_NOTE : 'Other unsaved draft');

  view.rerender(<BranchFeedbackForm {...other} onSaved={onSaved} />);
  expectDraft('Other unsaved draft');
  expect(screen.queryByText(/Previously saved family feedback/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save feedback' })).toBeEnabled();
  view.rerender(<BranchFeedbackForm session={initial} family={FIRST} onSaved={onSaved} />);
  expectDraft();
  expect(screen.getByRole('button', { name: 'Retry save' })).toBeEnabled();
  expect(screen.queryByText(/Previously saved family feedback/)).not.toBeInTheDocument();
  fetchMock.mockResolvedValueOnce(reply({ answer: answer() }));
  click('Retry save');
  await confirmed();
  expect(posted(1).init.body).toBe(payload);
  expect(onSaved).toHaveBeenCalledTimes(1);
});

it.each(NAVIGATION.slice(0, 2))('ignores stale latest-session reads on $name', async ({ next, backBeforeReply }) => {
  const initial = makeSession();
  const other = next(initial);
  const onLatestSession = jest.fn();
  fetchMock.mockResolvedValueOnce(reply({ error: 'Revision changed' }, 409));
  const view = render(<BranchFeedbackForm session={initial} family={FIRST} onLatestSession={onLatestSession} />);
  fillDraft();
  click('Save feedback');
  await screen.findByText(/The save conflicted with a newer revision/);
  const held = deferred<Response>();
  fetchMock.mockReturnValueOnce(held.promise);
  click('Load latest feedback');
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  view.rerender(<BranchFeedbackForm {...other} onLatestSession={onLatestSession} />);
  fillDraft('Other unsaved draft');
  if (backBeforeReply) view.rerender(<BranchFeedbackForm session={initial} family={FIRST} onLatestSession={onLatestSession} />);
  await act(async () => {
    held.resolve(reply(makeSession({ feedback: { [FIRST.id]: answer({ note: 'Late server judgment.' }) } })));
  });
  expect(onLatestSession).not.toHaveBeenCalled();
  expectDraft(backBeforeReply ? RAW_NOTE : 'Other unsaved draft');
  view.rerender(<BranchFeedbackForm session={initial} family={FIRST} onLatestSession={onLatestSession} />);
  expectDraft();
  expect(screen.getByRole('button', { name: REBASE })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Load latest feedback' })).toBeEnabled();
  expect(screen.queryByText('Comment: Late server judgment.')).not.toBeInTheDocument();
});

it('does not publish an older receipt over a newer saved family revision', async () => {
  const initial = makeSession({ feedback: { [FIRST.id]: answer({
    revision: 1, decision: 'agree', note: 'Initial server judgment.', correction: '', revisitLater: false,
  }) } });
  const held = deferred<Response>();
  const onSaved = jest.fn();
  fetchMock.mockReturnValueOnce(held.promise);
  const view = render(<BranchFeedbackForm session={initial} family={FIRST} onSaved={onSaved} />);
  fillDraft();
  click('Save feedback');
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const newer = makeSession({ feedback: { [FIRST.id]: answer({
    revision: 3, decision: 'discuss', note: 'Newest server judgment.', correction: '', revisitLater: false,
  }) } });
  view.rerender(<BranchFeedbackForm session={newer} family={FIRST} onSaved={onSaved} />);
  await act(async () => { held.resolve(reply({ answer: answer({ revision: 2 }) })); });
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.getByText('Latest saved family feedback (revision 3)')).toBeInTheDocument();
  expect(screen.getByText('Comment: Newest server judgment.')).toBeInTheDocument();
  expectDraft();
  expect(screen.getByRole('button', { name: 'Save feedback' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Retry save' })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each([
  { name: 'an older child-review version', feedback: answer({ datasetVersion: DATASET.priorDatasetVersion }) },
  { name: 'a different child case', feedback: answer({ caseId: 'synthetic-legacy-child' }) },
])('does not copy $name into a family judgment', ({ feedback }) => {
  render(<BranchFeedbackForm session={makeSession({ feedback: { [FIRST.id]: feedback } })} family={FIRST} />);
  for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
  expect(screen.getByLabelText('Comment (optional)')).toHaveValue('');
  expect(screen.queryByText(/Previously saved family feedback/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save feedback' })).toBeDisabled();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(window.sessionStorage.length).toBe(0);
});
