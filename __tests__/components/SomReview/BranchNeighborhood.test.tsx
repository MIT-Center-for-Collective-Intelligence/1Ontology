/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import BranchNeighborhood from '../../../src/components/SomReview/BranchNeighborhood';
import { relationshipRequest } from '../../../src/lib/relationshipReview/client';
import { GENERALIZATION_BRANCH_VERSION } from '../../../src/types/IBranchReview';
import type { BranchContextResponse, BranchFamily, BranchSession } from '../../../src/types/IBranchReview';
import type { RelationshipNode } from '../../../src/types/IRelationshipReview';

jest.mock('../../../src/lib/relationshipReview/client', () => ({ relationshipRequest: jest.fn() }));

const fixture = require('./branchFixture.json') as BranchSession;
const request = relationshipRequest as jest.MockedFunction<typeof relationshipRequest>;
const SUMMARY = 'Optional activity neighborhood (current context)';
const NEXT_VERSION = 'synthetic-next-branch-version' as BranchSession['dataset']['version'];
const OTHER_HASH = 'd'.repeat(64);
type ContextQuery = {
  caseId: string; datasetVersion: string; datasetSha256: string; focusId: string;
  activityOffset: number; sourceOffset: number; limit: number;
};
type Context = BranchContextResponse['context'];
let session: BranchSession;
let family: BranchFamily;

function respond(handler: (action: string, body: unknown, preview?: boolean) => unknown) {
  request.mockImplementation(async <T,>(action: string, body: unknown, preview?: boolean): Promise<T> =>
    (await handler(action, body, preview)) as T);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function toggleDetails(open = true) {
  const details = screen.getByText(SUMMARY, { selector: 'summary' }).closest('details') as HTMLDetailsElement;
  details.open = open;
  fireEvent(details, new Event('toggle'));
}
function node(id: string, title: string): RelationshipNode {
  return { id, title, description: `Synthetic evidence for ${title}.` } as RelationshipNode;
}
function page(kind: string, total: number, offset: number): Context['specializations'] {
  const count = Math.max(0, Math.min(8, total - offset));
  return {
    items: Array.from({ length: count }, (_, index) => node(`${kind}-${offset + index + 1}`, `Synthetic ${kind} ${offset + index + 1}`)),
    total, offset, limit: 8, nextOffset: offset + 8 < total ? offset + 8 : null,
  };
}
function contextFor(query: ContextQuery, boundSession = session, marker = 'Synthetic verified context.'): BranchContextResponse {
  const suppliedFamily = boundSession.dataset.families.find((item) => item.id === query.caseId)!;
  const parents = [node('context-parent-a', 'Verified parent Alpha'), node('context-parent-b', 'Verified parent Beta')];
  const candidates = [
    node(suppliedFamily.id, suppliedFamily.title), ...suppliedFamily.generalizations, ...suppliedFamily.currentSpecializations,
    ...suppliedFamily.groups.flatMap((group) => [group.node, ...group.members.flatMap((member) => [member.node, ...member.currentGeneralizations])]),
    ...parents,
  ];
  const focus = candidates.find((candidate) => (candidate as { id: string }).id === query.focusId);
  if (!focus) throw new Error('Unexpected synthetic focus');
  return { context: {
    caseId: query.caseId, datasetVersion: query.datasetVersion, datasetSha256: query.datasetSha256,
    sourceSha256: boundSession.dataset.sourceSha256, focus: { ...focus, description: marker } as RelationshipNode,
    generalizations: parents, specializations: page('specialization', 18, query.activityOffset),
    siblings: page('sibling', 10, query.activityOffset), sources: page('source', 9, query.sourceOffset),
    limitations: ['Synthetic source view is frozen, not a live graph.'],
  } };
}
function expectedQuery(focusId = family.id, activityOffset = 0, sourceOffset = 0, boundSession = session): ContextQuery {
  return {
    caseId: family.id, datasetVersion: boundSession.dataset.version, datasetSha256: boundSession.datasetSha256,
    focusId, activityOffset, sourceOffset, limit: 8,
  };
}
function expectReadOnly() {
  expect(request.mock.calls.every(([action]) => action === 'branch-context')).toBe(true);
}

const invalidContexts: [string, (context: Context) => void][] = [
  ['another family', (context) => { context.caseId = 'another-family'; }],
  ['another version', (context) => { context.datasetVersion = NEXT_VERSION; }],
  ['another package snapshot', (context) => { context.datasetSha256 = OTHER_HASH; }],
  ['another frozen source snapshot', (context) => { context.sourceSha256 = OTHER_HASH; }],
  ['a substituted focus', (context) => { context.focus = node('another-focus', 'Substituted activity'); }],
  ['more than eight activity records', (context) => { context.specializations.items.push(node('ninth', 'Unexpected ninth activity')); }],
  ['the wrong activity offset', (context) => { context.siblings.offset = 8; }],
  ['the wrong source offset', (context) => { context.sources.offset = 8; }],
  ['a different source page limit', (context) => { context.sources.limit = 9; }],
];

describe('BranchNeighborhood', () => {
  beforeEach(() => {
    request.mockReset();
    session = JSON.parse(JSON.stringify(fixture)) as BranchSession;
    session.preview = false;
    session.dataset.version = GENERALIZATION_BRANCH_VERSION;
    session.datasetSha256 = 'a'.repeat(64);
    session.dataset.sourceSha256 = 'b'.repeat(64);
    session.legacy.sha256 = 'c'.repeat(64);
    family = session.dataset.families[0];
    respond((action, body) => {
      if (action !== 'branch-context') throw new Error(`Unexpected action: ${action}`);
      return contextFor(body as ContextQuery);
    });
  });
  afterEach(cleanup);

  it('is lazy and offers root, both kinds of groups, retained members and current parents/neighbors as inspectable choices', async () => {
    render(<BranchNeighborhood session={session} family={family} />);
    expect(request).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox', { name: 'Activity to inspect' })).not.toBeInTheDocument();
    toggleDetails();
    await screen.findByRole('heading', { name: 'Current context for Synthetic family 01' });
    expect(request).toHaveBeenCalledWith('branch-context', expectedQuery(), false);
    const select = screen.getByRole('combobox', { name: 'Activity to inspect' }) as HTMLSelectElement;
    const values = Array.from(select.options, (option) => option.value);
    expect(select).toHaveValue(family.id);
    expect(within(select).getByRole('option', { name: 'Synthetic family 01 — higher Generalization (family-01)' })).toBeInTheDocument();
    expect(values).toEqual(expect.arrayContaining([
      'family-01', 'root-parent-a', 'root-parent-b', 'current-direct', 'ready-group', 'not-ready-group',
      'included-activity', 'held-activity', 'excluded-activity', 'not-ready-include',
      'independent-a', 'independent-b', 'context-parent-a', 'context-parent-b',
    ]));
    expect(new Set(values).size).toBe(values.length);
    expect(values).not.toContain('compound-source');
    expect(values).not.toContain('frozen-source');
    const parents = screen.getByRole('region', { name: 'Generalizations of focused activity' });
    expect(within(parents).getByRole('heading', { name: 'Generalizations of focused activity (2)' })).toBeVisible();
    expect(within(parents).getByText('Verified parent Alpha')).toBeVisible();
    expect(within(parents).getByText('Verified parent Beta')).toBeVisible();
    expect(screen.getByText(/These are current source neighbors, not newly validated placements/)).toBeVisible();
    expect(screen.getByText('Synthetic source view is frozen, not a live graph.')).toBeVisible();
    for (const [id, title] of [
      ['ready-group', 'Ready intermediate group'], ['held-activity', 'Held named activity'],
      ['current-direct', 'Existing direct activity'], ['context-parent-b', 'Verified parent Beta'],
    ]) {
      fireEvent.change(select, { target: { value: id } });
      await screen.findByRole('heading', { name: `Current context for ${title}` });
      expect(request).toHaveBeenLastCalledWith('branch-context', expectedQuery(id), false);
    }
    expectReadOnly();
  });

  it('pages activity and source evidence independently in limits of eight and resets both offsets for a requested focus', async () => {
    const view = render(<BranchNeighborhood session={session} family={family} requestedFocus={{ id: family.id, sequence: 1 }} />);
    async function expectPage(activityOffset: number, sourceOffset: number) {
      await waitFor(() => expect(request).toHaveBeenLastCalledWith('branch-context', expectedQuery(family.id, activityOffset, sourceOffset), false));
      await screen.findByRole('region', { name: 'Verified focused activity' });
    }
    await expectPage(0, 0);
    expect(screen.getByRole('heading', { name: 'Specializations: showing 1–8 of 18' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Siblings: showing 1–8 of 10' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Source records: showing 1–8 of 9' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Previous activity page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous source page' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next activity page' }));
    await expectPage(8, 0);
    expect(screen.getByRole('heading', { name: 'Specializations: showing 9–16 of 18' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Siblings: showing 9–10 of 10' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Source records: showing 1–8 of 9' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next source page' }));
    await expectPage(8, 8);
    expect(screen.getByRole('heading', { name: 'Source records: showing 9–9 of 9' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next source page' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next activity page' }));
    await expectPage(16, 8);
    expect(screen.getByRole('heading', { name: 'Specializations: showing 17–18 of 18' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Siblings: 0 shown at offset 16; 10 total' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next activity page' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous activity page' }));
    await expectPage(8, 8);
    fireEvent.click(screen.getByRole('button', { name: 'Previous source page' }));
    await expectPage(8, 0);
    fireEvent.click(screen.getByRole('button', { name: 'Next source page' }));
    await expectPage(8, 8);
    view.rerender(<BranchNeighborhood session={session} family={family} requestedFocus={{ id: 'held-activity', sequence: 2 }} />);
    await screen.findByRole('heading', { name: 'Current context for Held named activity' });
    expect(request).toHaveBeenLastCalledWith('branch-context', expectedQuery('held-activity'), false);
    expect(screen.getByRole('button', { name: 'Previous activity page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous source page' })).toBeDisabled();
    expectReadOnly();
  });

  it('does not substitute a different activity for an unknown requested focus', async () => {
    render(<BranchNeighborhood session={session} family={family} requestedFocus={{ id: 'not-supplied', sequence: 1 }} />);
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('The requested activity is not supplied by this family.');
    expect(error).toHaveTextContent('no different focus has been substituted');
    expect(request).not.toHaveBeenCalled();
    const select = screen.getByRole('combobox', { name: 'Activity to inspect' });
    expect(select).toHaveValue('not-supplied');
    expect(screen.queryByRole('region', { name: 'Verified focused activity' })).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: family.id } });
    await screen.findByRole('heading', { name: 'Current context for Synthetic family 01' });
    expect(request).toHaveBeenLastCalledWith('branch-context', expectedQuery(), false);
    expectReadOnly();
  });

  it('shows a readable failure and retries the same read without saving feedback', async () => {
    let failing = true;
    respond((action, body) => {
      if (action !== 'branch-context') throw new Error(`Unexpected action: ${action}`);
      if (failing) throw new Error('Synthetic transport internals');
      return contextFor(body as ContextQuery);
    });
    render(<BranchNeighborhood session={session} family={family} requestedFocus={{ id: family.id, sequence: 1 }} />);
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Current source context could not be loaded or verified for the selected activity.');
    expect(error).toHaveTextContent('Reading evidence does not save or change your feedback.');
    expect(screen.queryByText('Synthetic transport internals')).not.toBeInTheDocument();
    failing = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry context' }));
    await screen.findByRole('region', { name: 'Verified focused activity' });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith('branch-context', expectedQuery(), false);
    expectReadOnly();
  });

  it.each(invalidContexts)('rejects context containing %s rather than displaying unverified evidence', async (_, corrupt) => {
    respond((action, body) => {
      if (action !== 'branch-context') throw new Error(`Unexpected action: ${action}`);
      const result = contextFor(body as ContextQuery);
      corrupt(result.context);
      return result;
    });
    render(<BranchNeighborhood session={session} family={family} requestedFocus={{ id: family.id, sequence: 1 }} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Current source context could not be loaded or verified for the selected activity.');
    expect(screen.queryByRole('region', { name: 'Verified focused activity' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry context' })).toBeEnabled();
    expect(request).toHaveBeenCalledWith('branch-context', expectedQuery(), false);
    expectReadOnly();
  });

  it.each(['focus', 'account', 'version'] as const)('ignores a late response after the %s changes', async (change) => {
    const old = deferred<BranchContextResponse>();
    const current = deferred<BranchContextResponse>();
    let reads = 0;
    respond((action) => {
      if (action !== 'branch-context') throw new Error(`Unexpected action: ${action}`);
      return reads++ === 0 ? old.promise : current.promise;
    });
    const view = render(<BranchNeighborhood session={session} family={family} />);
    toggleDetails();
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    const oldQuery = request.mock.calls[0][1] as ContextQuery;
    let nextSession = session;
    if (change === 'focus') {
      fireEvent.change(screen.getByRole('combobox', { name: 'Activity to inspect' }), { target: { value: 'held-activity' } });
    } else {
      nextSession = change === 'account'
        ? { ...session, reviewerKey: 'another-reviewer' }
        : { ...session, dataset: { ...session.dataset, version: NEXT_VERSION } };
      view.rerender(<BranchNeighborhood session={nextSession} family={family} />);
    }
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    const currentQuery = request.mock.calls[1][1] as ContextQuery;
    await act(async () => { current.resolve(contextFor(currentQuery, nextSession, 'New verified source context.')); });
    expect(await screen.findByText('New verified source context.')).toBeVisible();
    await act(async () => { old.resolve(contextFor(oldQuery, session, 'Late old source context.')); });
    expect(screen.getByText('New verified source context.')).toBeVisible();
    expect(screen.queryByText('Late old source context.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Current source context could not be loaded or verified/)).not.toBeInTheDocument();
    expect(request).toHaveBeenLastCalledWith('branch-context', expectedQuery(change === 'focus' ? 'held-activity' : family.id, 0, 0, nextSession), false);
    expectReadOnly();
  });
});
