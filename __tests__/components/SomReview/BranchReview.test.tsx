/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useRouter } from 'next/router';
import { useAuth } from '../../../src/components/context/AuthContext';
import BranchReview from '../../../src/components/SomReview/BranchReview';
import BranchFeedbackForm from '../../../src/components/SomReview/BranchFeedbackForm';
import RelationshipPeerFeedback from '../../../src/components/SomReview/RelationshipPeerFeedback';
import { relationshipRequest } from '../../../src/lib/relationshipReview/client';
import { GENERALIZATION_BRANCH_VERSION } from '../../../src/types/IBranchReview';
import type { BranchContextResponse, BranchFamily, BranchSession } from '../../../src/types/IBranchReview';
import type { RelationshipNode } from '../../../src/types/IRelationshipReview';

jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('../../../src/components/SomReview/ThemeModeToggle', () => () => (
  <button>Use dark mode</button>
));
jest.mock('../../../src/components/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../src/lib/relationshipReview/client', () => ({ relationshipRequest: jest.fn() }));
jest.mock('../../../src/components/SomReview/BranchFeedbackForm', () => ({
  __esModule: true, default: jest.fn(() => null),
}));
// Preserve the shared component's empty/hidden boundary; do not invent a feedback section.
jest.mock('../../../src/components/SomReview/RelationshipPeerFeedback', () => ({
  __esModule: true, default: jest.fn(() => null),
}));

const fixture = require('./branchFixture.json') as BranchSession;
const request = relationshipRequest as jest.MockedFunction<typeof relationshipRequest>;
const form = BranchFeedbackForm as jest.Mock;
const peer = RelationshipPeerFeedback as jest.Mock;
const AUDIT = 'Agents and prompts used for this proposal';
const NEIGHBORHOOD = 'Optional activity neighborhood (current context)';
const NEXT_VERSION = 'synthetic-next-branch-version' as BranchSession['dataset']['version'];
const OTHER_HASH = 'd'.repeat(64);
type ContextQuery = {
  caseId: string; datasetVersion: string; datasetSha256: string; focusId: string;
  activityOffset: number; sourceOffset: number; limit: number;
};
type TraceEnvelope = { caseId: string; datasetVersion: string; datasetSha256: string; trace: unknown };
let session: BranchSession;
let router: { isReady: boolean; query: Record<string, string | string[] | undefined> };
let auth: { isAuthInitialized: boolean; isAuthenticated: boolean; user?: { uid: string } };

function makeSession(overrides: Partial<BranchSession> = {}): BranchSession {
  const next = JSON.parse(JSON.stringify(fixture)) as BranchSession;
  next.dataset.version = GENERALIZATION_BRANCH_VERSION;
  next.datasetSha256 = 'a'.repeat(64);
  next.dataset.sourceSha256 = 'b'.repeat(64);
  next.legacy.sha256 = 'c'.repeat(64);
  const first = next.dataset.families[0];
  next.dataset.families = [first, ...Array.from({ length: 17 }, (_, index): BranchFamily => {
    const number = index + 2;
    const suffix = String(number).padStart(2, '0');
    const groupId = `group-${suffix}`;
    const activityId = `activity-${suffix}`;
    return {
      ...first, id: `family-${suffix}`, title: `Synthetic family ${suffix}`,
      description: `Synthetic higher activity ${suffix}.`, summary: `Synthetic arrangement ${suffix}.`, scopeNote: '',
      generalizations: [], currentSpecializations: [], currentSourceRecords: [], remainingQuestions: [],
      sourceCaseIds: [activityId],
      groups: [{
        ...first.groups[0], id: groupId,
        node: { id: groupId, title: number === 18 ? 'Held-only intermediate group 18' : `Synthetic intermediate group ${suffix}` } as RelationshipNode,
        eligible: number !== 18, remainingQuestions: [],
        members: [{
          ...first.groups[0].members[0],
          node: { id: activityId, title: number === 18 ? 'Held-only activity 18' : `Synthetic activity ${suffix}` } as RelationshipNode,
          decision: number === 18 ? 'hold' : 'include', titleDependency: 'none-observed',
          currentGeneralizations: [], sourceRecords: [], nounEvidenceNote: '',
        }],
      }],
    };
  })];
  return { ...next, ...overrides };
}

function respond(handler: (action: string, body: unknown, preview?: boolean) => unknown) {
  request.mockImplementation(async <T,>(action: string, body: unknown, preview?: boolean): Promise<T> =>
    (await handler(action, body, preview)) as T);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function toggleDetails(title: string, open = true) {
  const details = screen.getByText(title, { selector: 'summary' }).closest('details') as HTMLDetailsElement;
  // Deliver the native disclosure event explicitly for jsdom versions without summary activation.
  details.open = open;
  fireEvent(details, new Event('toggle'));
  return details;
}
function latestForm() {
  return form.mock.calls[form.mock.calls.length - 1][0] as React.ComponentProps<typeof BranchFeedbackForm>;
}
function peerProps() {
  return peer.mock.calls.map(([props]) => props as React.ComponentProps<typeof RelationshipPeerFeedback>);
}
function expectReadOnly() {
  expect(request.mock.calls.some(([action]) => action.includes('save'))).toBe(false);
}
async function renderPackage() {
  const view = render(<BranchReview preview />);
  await screen.findByRole('heading', { name: `Generalization: ${session.dataset.families[0].title}` });
  return view;
}
function traceEnvelope(family: BranchFamily, trace: unknown): TraceEnvelope {
  return { caseId: family.id, datasetVersion: session.dataset.version, datasetSha256: session.datasetSha256, trace };
}
function contextFor(query: ContextQuery, description: string): BranchContextResponse {
  const family = session.dataset.families.find((item) => item.id === query.caseId)!;
  const nodes = [{ id: family.id, title: family.title }, ...family.groups.flatMap((group) => [group.node, ...group.members.map((member) => member.node)])];
  const focus = nodes.find((node) => (node as { id: string }).id === query.focusId)!;
  const empty = (offset: number) => ({ items: [], total: 0, offset, limit: 8, nextOffset: null });
  return { context: {
    caseId: query.caseId, datasetVersion: query.datasetVersion, datasetSha256: query.datasetSha256,
    sourceSha256: session.dataset.sourceSha256, focus: { ...focus, description } as RelationshipNode,
    generalizations: [], specializations: empty(query.activityOffset), siblings: empty(query.activityOffset),
    sources: empty(query.sourceOffset), limitations: [],
  } };
}

describe('BranchReview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    request.mockReset();
    session = makeSession();
    router = { isReady: true, query: {} };
    auth = { isAuthInitialized: false, isAuthenticated: false };
    (useRouter as jest.Mock).mockImplementation(() => router);
    (useAuth as jest.Mock).mockImplementation(() => [auth, jest.fn()]);
    respond((action) => {
      if (action === 'branch-session') return session;
      throw new Error(`Unexpected action: ${action}`);
    });
  });
  afterEach(cleanup);

  it('honors a deep link and lets all 18 families be visited without submitting, even when search hides them', async () => {
    router.query = {
      version: [GENERALIZATION_BRANCH_VERSION, 'unused-version'],
      family: [session.dataset.families[6].id, 'unused-family'],
    };
    render(<BranchReview preview />);
    const selectedName = `Generalization: ${session.dataset.families[6].title}`;
    expect(await screen.findByRole('heading', { name: selectedName })).toHaveFocus();
    expect(request).toHaveBeenCalledWith('branch-session', { datasetVersion: GENERALIZATION_BRANCH_VERSION }, true);
    const nav = screen.getByRole('navigation', { name: 'Generalizations' });
    const search = within(nav).getByRole('textbox', { name: 'Find a Generalization or activity' });
    expect(within(nav).getAllByRole('button', { name: /^Review Generalization / })).toHaveLength(17);
    expect(within(nav).queryByRole('button', { name: 'Review Generalization Synthetic family 18' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Review Generalization Synthetic family 07' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Activity 7 of 17')).toBeVisible();

    fireEvent.change(search, { target: { value: 'no synthetic match' } });
    expect(within(nav).getByText('No matching activities. Clear search or show activities with no proposed changes to browse the retained candidates.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next activity' }));
    expect(screen.getByRole('heading', { name: 'Generalization: Synthetic family 08' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Previous activity' }));
    for (const term of ['Ready intermediate group', 'included NAMED activity', 'existing direct activity']) {
      fireEvent.change(search, { target: { value: term } });
      expect(within(nav).getAllByRole('button', { name: /^Review Generalization / })).toHaveLength(1);
      expect(screen.getByRole('heading', { name: selectedName })).toBeVisible();
    }
    fireEvent.click(within(nav).getByRole('button', { name: 'Clear search' }));
    fireEvent.click(within(nav).getByRole('button', { name: 'Show activities with no proposed changes' }));
    expect(within(nav).getAllByRole('button', { name: /^Review Generalization / })).toHaveLength(18);
    fireEvent.click(within(nav).getByRole('button', { name: 'Review Generalization Synthetic family 01' }));
    expect(screen.getByRole('button', { name: 'Previous activity' })).toBeDisabled();
    for (let index = 0; index < 18; index += 1) {
      const family = session.dataset.families[index];
      expect(screen.getByRole('heading', { name: `Generalization: ${family.title}` })).toHaveFocus();
      expect(screen.getByText(`Activity ${index + 1} of 18`)).toBeVisible();
      expect(latestForm().family.id).toBe(family.id);
      if (index < 17) fireEvent.click(screen.getByRole('button', { name: 'Next activity' }));
    }
    expect(screen.getByRole('button', { name: 'Next activity' })).toBeDisabled();
    expect(screen.getByText(/This Generalization has no proposed changes/)).toBeVisible();
    expect(latestForm().disabled).toBe(true);
    toggleDetails('Other candidates kept for reference (1 groups)');
    toggleDetails('Other candidates kept for reference (1)');
    expect(screen.getByText('Held-only activity 18')).toBeVisible();
    expect(screen.getByText('Held for further review - not a proposed Specialization')).toBeVisible();
    expect(form.mock.calls.every(([props]) => session.dataset.families.some((family) => family.id === props.family.id))).toBe(true);
    expect(request.mock.calls.map(([action]) => action)).toEqual(['branch-session']);
  });

  it('keeps the whole arrangement, non-proposals, independent parents and complete source wording distinct', async () => {
    await renderPackage();
    const family = session.dataset.families[0];
    const arrangement = screen.getByRole('region', { name: 'Complete proposed arrangement' });
    const ready = within(arrangement).getByRole('article', { name: 'Specialization group Ready intermediate group' });
    const proposed = within(ready).getByRole('region', { name: 'Proposed Specializations in Ready intermediate group' });
    expect(within(ready).queryByText('Held named activity')).not.toBeInTheDocument();
    expect(within(ready).queryByText('Excluded named activity')).not.toBeInTheDocument();
    expect(within(arrangement).queryByRole('article', { name: 'Specialization group Not-ready intermediate group' })).not.toBeInTheDocument();
    toggleDetails('Other candidates kept for reference (2)');
    const held = within(ready).getByRole('region', { name: 'Held activities - not proposed changes in Ready intermediate group' });
    const excluded = within(ready).getByRole('region', { name: 'Excluded activities - not proposed changes in Ready intermediate group' });
    toggleDetails('Other candidates kept for reference (1 groups)');
    const notReady = within(arrangement).getByRole('article', { name: 'Specialization group Not-ready intermediate group' });
    toggleDetails('Other candidates kept for reference (1)');
    expect(within(proposed).getByText('Included named activity')).toBeVisible();
    expect(within(proposed).getByText('Proposed Specialization - provisional')).toBeVisible();
    expect(within(held).getByText('Held named activity')).toBeVisible();
    expect(within(held).getByText('Held for further review - not a proposed Specialization')).toBeVisible();
    expect(within(excluded).getByText('Excluded named activity')).toBeVisible();
    expect(within(excluded).getByText('Excluded from this proposal - kept for reference')).toBeVisible();
    expect(within(notReady).getByText('Not-ready include candidate')).toBeVisible();
    expect(within(notReady).getByText('Candidate Specialization - not a proposed change')).toBeVisible();
    const groups = latestForm().family.groups;
    const members = groups.flatMap((group) => group.members);
    expect({
      groups: groups.length,
      eligible: groups.filter((group) => group.eligible).length,
      notReady: groups.filter((group) => !group.eligible).length,
      records: members.length,
      include: members.filter((member) => member.decision === 'include').length,
      hold: members.filter((member) => member.decision === 'hold').length,
      exclude: members.filter((member) => member.decision === 'exclude').length,
      proposed: groups.filter((group) => group.eligible).flatMap((group) => group.members.filter((member) => member.decision === 'include')).length,
    }).toEqual({ groups: 2, eligible: 1, notReady: 1, records: 4, include: 2, hold: 1, exclude: 1, proposed: 1 });
    expect(within(proposed).getByRole('heading', { name: 'Current Generalizations (2)' })).toBeVisible();
    expect(within(proposed).getByText('Independent parent Alpha')).toBeVisible();
    expect(within(proposed).getByText('Independent parent Beta')).toBeVisible();
    expect(within(proposed).getByText(/These other current links are context, not newly validated or removed/)).toBeVisible();
    const higher = screen.getByRole('region', { name: 'Higher Generalization' });
    expect(within(higher).getByText('Root parent Alpha')).toBeVisible();
    expect(within(higher).getByText('Root parent Beta')).toBeVisible();
    const current = screen.getByRole('region', { name: 'Current links and neighboring activities' });
    expect(within(current).queryByText('Existing direct activity')).not.toBeInTheDocument();
    toggleDetails(`Current direct Specializations (${family.currentSpecializations.length})`);
    expect(within(current).getByText('Existing direct activity')).toBeVisible();
    expect(within(current).getByText('Current links are context, not proposed changes or newly validated links. This review does not remove them.')).toBeVisible();
    expect(within(arrangement).queryByText('Existing direct activity')).not.toBeInTheDocument();
    expect(screen.getByText('This activity needs title clarification before any placement can be settled. Recheck after clarification or an activity split.')).toBeVisible();
    expect(screen.getByText('Any placement depends on the activity title. Recheck after title changes or activity splits.')).toBeVisible();

    // The parent supplies one family-level form, not forms for individual members.
    expect(screen.getByText('Review each proposed group and its Specializations together under this Generalization. The complete proposed arrangement is shown without paging. Other candidates are kept below for reference, not as proposed changes.')).toBeVisible();
    expect(latestForm().family).toBe(family);
    expect(latestForm().disabled).toBe(false);
    expect(peerProps()[peerProps().length - 1]).toEqual(expect.objectContaining({
      caseId: family.id, readAction: 'branch-peer-feedback', saveAction: 'branch-save-peer', refreshKey: 0,
    }));
    expect(screen.queryByRole('heading', { name: /feedback/i })).not.toBeInTheDocument();

    const source = family.groups[0].members[0].sourceRecords[0] as RelationshipNode & { text: string };
    const frozenSource = family.currentSourceRecords[0] as RelationshipNode & { description: string };
    expect(screen.queryByText(source.text)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand supporting details' }));
    expect(screen.getByText(source.text)).toBeVisible();
    expect(screen.getByText(frozenSource.description)).toBeVisible();
    expect(screen.getByText('Synthetic remaining group question?')).toBeVisible();
    expect(screen.getByText('Synthetic remaining family question?')).toBeVisible();
    const exact = toggleDetails('Exact supplied record for Compound O*NET source');
    expect(exact.querySelector('pre')).toBeVisible();
    expect(exact.querySelector('pre')!.textContent).toBe(JSON.stringify(source, null, 2));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse supporting details' }));
    expect(screen.queryByText(source.text)).not.toBeInTheDocument();
    expect(screen.queryByText('Synthetic remaining family question?')).not.toBeInTheDocument();
    expect(request.mock.calls.map(([action]) => action)).toEqual(['branch-session']);
  });

  it('mounts earlier individual inspection lazily with its original version, without creating a child vote', async () => {
    await renderPackage();
    expect(peerProps().every((props) => props.readAction === 'branch-peer-feedback')).toBe(true);
    expect(screen.getByRole('link', { name: 'Open earlier individual review' })).toHaveAttribute(
      'href', `/review/relationships?version=${encodeURIComponent(session.legacy.version)}`);
    toggleDetails('Inspect earlier individual judgments (2)');
    expect(screen.getByText('Earlier judgments about individual activities stay separate from this proposed arrangement and do not approve it. Responding to comments does not submit a new judgment about the original activity.')).toBeVisible();
    expect(peerProps().every((props) => props.readAction === 'branch-peer-feedback')).toBe(true);
    const inspect = screen.getByRole('button', { name: 'Inspect earlier individual judgment for Included named activity' });
    fireEvent.click(inspect);
    expect(screen.getByRole('heading', { name: 'Earlier individual judgment — not family approval' })).toBeVisible();
    const legacy = peerProps().filter((props) => props.caseId === 'included-activity').pop()!;
    expect(legacy.session).toEqual(expect.objectContaining({
      dataset: { version: session.legacy.version }, datasetSha256: session.legacy.sha256,
      reviewerKey: session.reviewerKey, preview: true,
      peerReviewer: session.peerReviewer, canViewPeerFeedback: session.canViewPeerFeedback,
    }));
    expect(legacy.readAction).toBeUndefined();
    expect(legacy.saveAction).toBeUndefined();
    expect(form.mock.calls.every(([props]) => props.family.id === 'family-01')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close earlier judgment' }));
    expect(screen.queryByRole('heading', { name: 'Earlier individual judgment — not family approval' })).not.toBeInTheDocument();
    fireEvent.click(inspect);
    fireEvent.click(screen.getByRole('button', { name: 'Next activity' }));
    expect(screen.queryByRole('heading', { name: 'Earlier individual judgment — not family approval' })).not.toBeInTheDocument();
    expect(latestForm().family.id).toBe('family-02');
    expectReadOnly();
  });

  it('waits for initialized authentication and router readiness for non-preview reads', async () => {
    session = makeSession({ preview: false });
    router.isReady = false;
    const view = render(<BranchReview />);
    expect(screen.getByText('Loading your account…')).toBeVisible();
    expect(request).not.toHaveBeenCalled();
    auth = { isAuthInitialized: true, isAuthenticated: true, user: { uid: 'account-a' } };
    view.rerender(<BranchReview />);
    expect(request).not.toHaveBeenCalled();
    router = { ...router, isReady: true };
    view.rerender(<BranchReview />);
    await screen.findByRole('heading', { name: 'Generalization: Synthetic family 01' });
    expect(request).toHaveBeenCalledWith('branch-session', {}, false);
  });

  it.each(['unknown version', 'invalid snapshot digest'] as const)('does not silently display a package with an %s', async (reason) => {
    if (reason === 'unknown version') router.query.version = 'synthetic-unavailable-version';
    else session = { ...session, datasetSha256: 'invalid-digest' };
    render(<BranchReview preview />);
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('could not be loaded or verified for this account and version');
    expect(error).toHaveTextContent('Retained drafts are not discarded.');
    expect(screen.getByRole('button', { name: 'Retry loading package' })).toBeEnabled();
    expect(screen.queryByRole('region', { name: 'Higher Generalization' })).not.toBeInTheDocument();
    expect(form).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith('branch-session', reason === 'unknown version' ? { datasetVersion: 'synthetic-unavailable-version' } : {}, true);
    expectReadOnly();
  });

  it('retries a failed or stale snapshot read with a readable error and no save', async () => {
    let attempts = 0;
    respond((action) => {
      if (action !== 'branch-session') throw new Error(`Unexpected action: ${action}`);
      if (attempts++ === 0) throw new Error('Synthetic stale frozen snapshot internals');
      return session;
    });
    render(<BranchReview preview />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Retry loading the package. Retained drafts are not discarded.');
    expect(screen.queryByText('Synthetic stale frozen snapshot internals')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading package' }));
    await screen.findByRole('heading', { name: 'Generalization: Synthetic family 01' });
    expect(latestForm().disabled).toBe(false);
    expect(request.mock.calls.map(([action]) => action)).toEqual(['branch-session', 'branch-session']);
  });

  it.each(['account', 'version'] as const)('ignores a late session response after the %s changes', async (change) => {
    session = makeSession({ preview: false, reviewerKey: 'old-reviewer', reviewerLabel: 'Old account' });
    auth = { isAuthInitialized: true, isAuthenticated: true, user: { uid: 'account-a' } };
    router.query.version = GENERALIZATION_BRANCH_VERSION;
    const old = deferred<BranchSession>();
    const current = deferred<BranchSession>();
    let reads = 0;
    respond((action) => {
      if (action !== 'branch-session') throw new Error(`Unexpected action: ${action}`);
      return reads++ === 0 ? old.promise : current.promise;
    });
    const view = render(<BranchReview />);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    let next = makeSession({ preview: false, reviewerKey: change === 'account' ? 'current-reviewer' : 'old-reviewer', reviewerLabel: 'Current account' });
    if (change === 'account') auth = { ...auth, user: { uid: 'account-b' } };
    else {
      router = { ...router, query: { version: NEXT_VERSION } };
      next = { ...next, dataset: { ...next.dataset, version: NEXT_VERSION } };
    }
    view.rerender(<BranchReview />);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await act(async () => { current.resolve(next); });
    expect(await screen.findByText('Reviewing as Current account')).toBeVisible();
    await act(async () => { old.resolve(session); });
    expect(screen.queryByText('Reviewing as Old account')).not.toBeInTheDocument();
    expect(screen.queryByText(/could not be loaded or verified for this account and version/)).not.toBeInTheDocument();
    expect(latestForm().session.reviewerKey).toBe(next.reviewerKey);
    expect(latestForm().session.dataset.version).toBe(next.dataset.version);
    expectReadOnly();
  });

  it('loads technical audit only on disclosure and verifies case, version and hash before showing the exact trace', async () => {
    const family = session.dataset.families[0];
    const bound = traceEnvelope(family, {
      author: { request: { input: 'Synthetic author input' }, result: { output: 'Synthetic author output' } },
      critics: [
        { request: { input: 'Synthetic critic one input' }, result: { output: 'Synthetic critic one output' } },
        { request: { input: 'Synthetic critic two input' }, result: { output: 'Synthetic critic two output' } },
      ],
      aliasMap: { 'synthetic-alias': 'included-activity' }, provenance: { sourceSha256: session.dataset.sourceSha256 },
    });
    const replies = [
      { ...bound, caseId: 'another-family' },
      { ...bound, datasetVersion: NEXT_VERSION },
      { ...bound, datasetSha256: OTHER_HASH },
      bound,
    ];
    let reads = 0;
    respond((action) => {
      if (action === 'branch-session') return session;
      if (action === 'branch-trace') return replies[reads++];
      throw new Error(`Unexpected action: ${action}`);
    });
    await renderPackage();
    fireEvent.click(screen.getByRole('button', { name: 'Expand supporting details' }));
    expect(request.mock.calls.map(([action]) => action)).toEqual(['branch-session']);
    expect(screen.queryByLabelText('Exact author prompt')).not.toBeInTheDocument();
    const audit = toggleDetails(AUDIT);
    await waitFor(() => expect(request).toHaveBeenLastCalledWith('branch-trace', {
      caseId: family.id, datasetVersion: session.dataset.version, datasetSha256: session.datasetSha256,
    }, true));
    expect(within(audit).getByLabelText('Exact author prompt')).toHaveTextContent(session.dataset.prompt);
    session.dataset.criticPrompts.forEach((prompt, index) => {
      expect(within(audit).getByLabelText(`Exact critic prompt ${index + 1}`)).toHaveTextContent(prompt);
    });
    expect(within(audit).getByText(session.datasetSha256)).toBeVisible();
    for (let index = 0; index < 3; index += 1) {
      const error = await within(audit).findByRole('alert');
      expect(error).toHaveTextContent('could not be loaded or verified for this family');
      expect(error).toHaveTextContent('Your feedback has not changed.');
      expect(within(audit).queryByLabelText('Exact agent trace')).not.toBeInTheDocument();
      fireEvent.click(within(audit).getByRole('button', { name: 'Retry audit' }));
    }
    const exact = await within(audit).findByLabelText('Exact agent trace');
    expect(exact.textContent).toBe(JSON.stringify(bound.trace, null, 2));
    expect(exact).toHaveAttribute('tabindex', '0');
    toggleDetails(AUDIT, false);
    expect(screen.queryByLabelText('Exact agent trace')).not.toBeInTheDocument();
    toggleDetails(AUDIT);
    expect(await screen.findByLabelText('Exact agent trace')).toBeVisible();
    expect(request.mock.calls.filter(([action]) => action === 'branch-trace')).toHaveLength(4);
    expectReadOnly();
  });

  it('opens the actual requested neighborhood and isolates pending context and audit reads when moving to another family', async () => {
    const first = session.dataset.families[0];
    const second = session.dataset.families[1];
    const oldContext = deferred<BranchContextResponse>();
    const oldTrace = deferred<TraceEnvelope>();
    let pendingQuery: ContextQuery | undefined;
    respond((action, body) => {
      if (action === 'branch-session') return session;
      if (action === 'branch-trace') {
        return (body as { caseId: string }).caseId === first.id
          ? oldTrace.promise : traceEnvelope(second, { receipt: 'Current family trace.' });
      }
      if (action === 'branch-context') {
        const query = body as ContextQuery;
        if (query.caseId === first.id && query.focusId === 'included-activity') {
          pendingQuery = query;
          return oldContext.promise;
        }
        return contextFor(query, 'Current verified family context.');
      }
      throw new Error(`Unexpected action: ${action}`);
    });
    await renderPackage();
    fireEvent.click(screen.getByRole('button', { name: 'Open neighboring activities for Ready intermediate group' }));
    await screen.findByRole('heading', { name: 'Current context for Ready intermediate group' });
    expect(request).toHaveBeenLastCalledWith('branch-context', {
      caseId: first.id, datasetVersion: session.dataset.version, datasetSha256: session.datasetSha256,
      focusId: 'ready-group', activityOffset: 0, sourceOffset: 0, limit: 8,
    }, true);
    fireEvent.click(screen.getByRole('button', { name: 'Open neighboring activities for Included named activity' }));
    await waitFor(() => expect(pendingQuery).toEqual(expect.objectContaining({ caseId: first.id, focusId: 'included-activity' })));
    toggleDetails(AUDIT);
    await waitFor(() => expect(request).toHaveBeenLastCalledWith('branch-trace', {
      caseId: first.id, datasetVersion: session.dataset.version, datasetSha256: session.datasetSha256,
    }, true));
    fireEvent.click(screen.getByRole('button', { name: 'Next activity' }));
    expect(screen.getByRole('heading', { name: 'Generalization: Synthetic family 02' })).toHaveFocus();
    expect(screen.queryByRole('combobox', { name: 'Activity to inspect' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Exact agent trace')).not.toBeInTheDocument();
    toggleDetails(NEIGHBORHOOD);
    await screen.findByRole('heading', { name: 'Current context for Synthetic family 02' });
    expect(request).toHaveBeenLastCalledWith('branch-context', {
      caseId: second.id, datasetVersion: session.dataset.version, datasetSha256: session.datasetSha256,
      focusId: second.id, activityOffset: 0, sourceOffset: 0, limit: 8,
    }, true);
    toggleDetails(AUDIT);
    expect(await screen.findByLabelText('Exact agent trace')).toHaveTextContent('Current family trace.');
    await act(async () => {
      oldContext.resolve(contextFor(pendingQuery!, 'Late old context.'));
      oldTrace.resolve(traceEnvelope(first, { receipt: 'Late old trace.' }));
    });
    expect(screen.getByText('Current verified family context.')).toBeVisible();
    expect(screen.queryByText('Late old context.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Late old trace/)).not.toBeInTheDocument();
    expect(latestForm().family.id).toBe(second.id);
    expectReadOnly();
  });
});
