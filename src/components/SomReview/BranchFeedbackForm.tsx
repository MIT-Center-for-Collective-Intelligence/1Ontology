import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material';
import { relationshipRequest } from '../../lib/relationshipReview/client';
import type { BranchFamily, BranchSession } from '../../types/IBranchReview';
import type { RelationshipFeedback } from '../../types/IRelationshipReview';

type Decision = 'agree' | 'disagree' | 'discuss';
type Binding = { caseId: string; datasetVersion: string; datasetSha256: string };
type SaveBody = Binding & {
  reviewerKey: string;
  decision: Decision;
  note: string;
  correction: string;
  revisitLater: boolean;
  revision: number;
  requestId: string;
};
type Draft = {
  decision: Decision | '';
  note: string;
  correction: string;
  revisitLater: boolean;
  expectedRevision: number;
  dirty: boolean;
  pending: Readonly<SaveBody> | null;
  needsRebase: boolean;
  rejectedStatus: number | null;
};
type Entry = {
  key: string;
  query: Binding;
  session: BranchSession;
  draft: Draft;
  saved: RelationshipFeedback | null;
  storageError: string;
  saveError: string;
  resultText: string;
  saving: boolean;
  refreshing: boolean;
  latestReady: boolean;
  readError: string;
  readSeq: number;
  saveSeq: number;
};
const decisions = ['agree', 'disagree', 'discuss'];
const decisionLabel = (decision: string) => decision === 'agree' ? 'Agree' : decision === 'disagree' ? 'Disagree' : 'Needs discussion';
const storageMessage = 'This browser could not retain the draft in session storage. Keep this page open and copy your text before reloading. A local draft is not submitted feedback.';

function feedbackBound(value: RelationshipFeedback | null | undefined, query: Binding): value is RelationshipFeedback {
  return !!value && value.caseId === query.caseId && value.datasetVersion === query.datasetVersion && decisions.includes(value.decision) && typeof value.note === 'string' && typeof value.correction === 'string' && typeof value.revisitLater === 'boolean' && Number.isSafeInteger(value.revision) && value.revision > 0;
}

function receiptMatches(value: RelationshipFeedback | undefined, body: Readonly<SaveBody>): value is RelationshipFeedback {
  if (!feedbackBound(value, body)) return false;
  const reviewerKey = (value as unknown as { reviewerKey?: string }).reviewerKey;
  return value.revision === body.revision + 1 && value.decision === body.decision && value.note === body.note && value.correction === body.correction && value.revisitLater === body.revisitLater && (reviewerKey === undefined || reviewerKey === body.reviewerKey);
}

function statusOf(error: unknown): number | undefined {
  const failure = error as { status?: number; statusCode?: number; response?: { status?: number } };
  return failure?.status ?? failure?.statusCode ?? failure?.response?.status;
}

function secureRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function copySaved(draft: Draft, saved: RelationshipFeedback | null) {
  Object.assign(draft, {
    decision: saved?.decision ?? '',
    note: saved?.note ?? '',
    correction: saved?.correction ?? '',
    revisitLater: saved?.revisitLater ?? false,
    expectedRevision: saved?.revision ?? 0,
  });
}

function mergeSaved(entry: Entry, feedback: RelationshipFeedback | null | undefined) {
  if (feedbackBound(feedback, entry.query) && (!entry.saved || feedback.revision > entry.saved.revision)) entry.saved = feedback;
}

function reconcile(entry: Entry) {
  const draft = entry.draft;
  const revision = entry.saved?.revision ?? 0;
  if (draft.dirty || draft.pending || draft.needsRebase || draft.rejectedStatus !== null) {
    if (draft.expectedRevision !== revision) draft.needsRebase = true;
  } else copySaved(draft, entry.saved);
}

function persist(entry: Entry) {
  try {
    if (!entry.draft.dirty && !entry.draft.pending && !entry.draft.needsRebase && entry.draft.rejectedStatus === null) {
      window.sessionStorage.removeItem(entry.key);
    } else {
      window.sessionStorage.setItem(entry.key, JSON.stringify({
        schema: 'branch-family-draft-v1',
        reviewerKey: entry.session.reviewerKey,
        preview: entry.session.preview,
        query: entry.query,
        draft: entry.draft,
      }));
    }
    entry.storageError = '';
  } catch {
    entry.storageError = storageMessage;
  }
}

function makeEntry(session: BranchSession, family: BranchFamily): Entry {
  const query = { caseId: family.id, datasetVersion: session.dataset.version, datasetSha256: session.datasetSha256 };
  const key = 'som-branch-family-draft-v1:' + JSON.stringify([session.preview, session.reviewerKey, query.datasetVersion, query.datasetSha256, query.caseId]);
  const entry: Entry = {
    key, query, session,
    draft: { decision: '', note: '', correction: '', revisitLater: false, expectedRevision: 0, dirty: false, pending: null, needsRebase: false, rejectedStatus: null },
    saved: null, storageError: '', saveError: '', resultText: '', saving: false, refreshing: false, latestReady: true, readError: '', readSeq: 0, saveSeq: 0,
  };
  mergeSaved(entry, session.feedback[family.id]);
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw) {
      const value = JSON.parse(raw) as { schema: string; reviewerKey: string; preview: boolean; query: Binding; draft: Draft };
      const draft = value.draft;
      if (value.schema !== 'branch-family-draft-v1' || value.reviewerKey !== session.reviewerKey || value.preview !== session.preview || value.query?.caseId !== query.caseId || value.query.datasetVersion !== query.datasetVersion || value.query.datasetSha256 !== query.datasetSha256 || !draft || !['', ...decisions].includes(draft.decision) || typeof draft.note !== 'string' || typeof draft.correction !== 'string' || typeof draft.revisitLater !== 'boolean' || typeof draft.dirty !== 'boolean' || typeof draft.needsRebase !== 'boolean' || !Number.isSafeInteger(draft.expectedRevision) || draft.expectedRevision < 0 || (draft.rejectedStatus !== null && !Number.isSafeInteger(draft.rejectedStatus))) throw new Error('Invalid stored draft');
      const pending = draft.pending;
      if (pending && (pending.caseId !== query.caseId || pending.datasetVersion !== query.datasetVersion || pending.datasetSha256 !== query.datasetSha256 || pending.reviewerKey !== session.reviewerKey || pending.revision !== draft.expectedRevision || pending.decision !== draft.decision || pending.note !== draft.note.trim() || pending.correction !== draft.correction.trim() || pending.revisitLater !== draft.revisitLater || typeof pending.requestId !== 'string' || !pending.requestId || pending.note.length > 8000 || pending.correction.length > 2000)) throw new Error('Invalid pending request');
      entry.draft = { ...draft, pending: pending ? Object.freeze({ ...pending }) : null };
      if (pending) {
        entry.resultText = 'An earlier save has no confirmed receipt. Retry save sends the identical request.';
        entry.saveError = 'The save is unconfirmed. Edits remain locked until its receipt is confirmed or the request is definitively rejected.';
      }
    }
  } catch {
    entry.storageError = storageMessage;
  }
  reconcile(entry);
  if (entry.draft.needsRebase) entry.latestReady = false;
  if (!entry.storageError) persist(entry);
  return entry;
}

function SavedText({ feedback }: { feedback: RelationshipFeedback }) {
  return <Stack spacing={0.5} sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
    <Typography variant='body2'>Arrangement judgment: {decisionLabel(feedback.decision)}</Typography>
    {feedback.correction && <Typography variant='body2'>Suggested changes: {feedback.correction}</Typography>}
    {feedback.note && <Typography variant='body2'>Comment: {feedback.note}</Typography>}
    <Typography variant='body2'>Revisit later: {feedback.revisitLater ? 'Yes' : 'No'}</Typography>
  </Stack>;
}

export default function BranchFeedbackForm({
  session,
  family,
  onSaved,
  onLatestSession,
  disabled = false,
}: {
  session: BranchSession;
  family: BranchFamily;
  onSaved?: (feedback: RelationshipFeedback) => void;
  onLatestSession?: (session: BranchSession) => void;
  disabled?: boolean;
}) {
  const entries = useRef(new Map<string, Entry>());
  const alive = useRef(false);
  const active = useRef('');
  const busy = useRef<Entry | null>(null);
  const [, render] = useState(0);
  const key = 'som-branch-family-draft-v1:' + JSON.stringify([session.preview, session.reviewerKey, session.dataset.version, session.datasetSha256, family.id]);
  if (!entries.current.has(key)) entries.current.set(key, makeEntry(session, family));
  const entry = entries.current.get(key)!;
  entry.session = session;
  active.current = key;
  const current = (candidate: Entry) => alive.current && active.current === candidate.key;
  const notify = (candidate?: Entry) => { if (alive.current && (!candidate || active.current === candidate.key)) render((value) => value + 1); };

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    return () => { ++entry.readSeq; ++entry.saveSeq; entry.refreshing = false; };
  }, [entry]);
  useEffect(() => {
    mergeSaved(entry, session.feedback[family.id]);
    reconcile(entry);
    if (alive.current && active.current === entry.key) render((value) => value + 1);
  }, [entry, session, family.id]);

  async function loadLatest(candidate: Entry) {
    if (!current(candidate) || candidate.refreshing) return;
    const sequence = ++candidate.readSeq;
    candidate.refreshing = true;
    candidate.readError = '';
    candidate.latestReady = false;
    notify(candidate);
    try {
      const next: BranchSession = await relationshipRequest('branch-session', { datasetVersion: candidate.query.datasetVersion, datasetSha256: candidate.query.datasetSha256 }, candidate.session.preview);
      if (!current(candidate) || sequence !== candidate.readSeq) return;
      if (next?.reviewerKey !== candidate.session.reviewerKey || next.preview !== candidate.session.preview || next.dataset?.version !== candidate.query.datasetVersion || next.datasetSha256 !== candidate.query.datasetSha256 || !next.dataset.families.some((item) => item.id === candidate.query.caseId)) throw new Error('Different account or dataset');
      mergeSaved(candidate, next.feedback[candidate.query.caseId]);
      candidate.latestReady = true;
      reconcile(candidate);
      onLatestSession?.(next);
    } catch {
      if (current(candidate) && sequence === candidate.readSeq) candidate.readError = 'Latest family feedback could not be loaded or verified for this account and dataset. Your draft is retained. Retry loading latest feedback before rebasing.';
    } finally {
      if (sequence === candidate.readSeq) { candidate.refreshing = false; notify(candidate); }
    }
  }

  async function send(candidate: Entry) {
    const body = candidate.draft.pending;
    if (!body || candidate.saving || busy.current || !current(candidate) || disabled) return;
    const sequence = ++candidate.saveSeq;
    candidate.saving = true;
    busy.current = candidate;
    candidate.saveError = '';
    candidate.resultText = 'Saving feedback for this whole family…';
    ++candidate.readSeq;
    candidate.refreshing = false;
    notify();
    try {
      const result = await relationshipRequest('branch-save', body, candidate.session.preview);
      if (!current(candidate) || sequence !== candidate.saveSeq || candidate.draft.pending !== body) return;
      const answer: RelationshipFeedback | undefined = result?.answer;
      if (!receiptMatches(answer, body)) throw new Error('Unbound save receipt');
      const newer = !!candidate.saved && candidate.saved.revision > answer.revision;
      mergeSaved(candidate, answer);
      candidate.draft.pending = null;
      candidate.draft.rejectedStatus = null;
      candidate.saveError = '';
      candidate.latestReady = true;
      if (newer) {
        candidate.draft.dirty = true;
        candidate.draft.needsRebase = true;
        candidate.resultText = `This request was saved at revision ${answer.revision}. A newer saved revision exists; review it before saving your retained draft.`;
      } else {
        copySaved(candidate.draft, candidate.saved);
        candidate.draft.dirty = false;
        candidate.draft.needsRebase = false;
        candidate.resultText = `Feedback saved for this whole family (revision ${answer.revision}).`;
      }
      persist(candidate);
      if (!newer) onSaved?.(answer);
    } catch (error) {
      if (!current(candidate) || sequence !== candidate.saveSeq || candidate.draft.pending !== body) return;
      const status = statusOf(error);
      const definitive = status && status >= 400 && status < 500 && ![408, 429, 499].includes(status);
      if (definitive) {
        candidate.draft.pending = null;
        candidate.draft.dirty = true;
        if (status === 409) {
          candidate.draft.needsRebase = true;
          candidate.latestReady = false;
          candidate.resultText = 'The save conflicted with a newer revision. No new request will be sent until you review and rebase your draft.';
          candidate.saveError = 'Your saved family feedback changed. Your choices and text are retained. Review the latest saved feedback before a new save.';
        } else {
          candidate.draft.rejectedStatus = status!;
          candidate.resultText = 'The save was rejected; your draft has not been discarded.';
          candidate.saveError = 'The save was rejected. Choose Edit rejected feedback to revise your retained draft, or reload the package if access changed.';
        }
      } else {
        candidate.resultText = 'The save has no verified receipt.';
        candidate.saveError = 'The save could not be confirmed. Edits are locked. Retry save resends the identical body and request ID; it does not create a second judgment.';
      }
      persist(candidate);
    } finally {
      if (busy.current === candidate) {
        candidate.saving = false;
        if ((!current(candidate) || sequence !== candidate.saveSeq) && candidate.draft.pending) {
          candidate.resultText = 'This save was not confirmed in the active view. Retry save sends the identical request.';
          candidate.saveError = 'Edits are locked until this pending save is confirmed or definitively rejected.';
        }
        busy.current = null;
        notify();
      }
    }
  }

  const draft = entry.draft;
  const otherSaving = !!busy.current && busy.current !== entry;
  const locked = disabled || entry.saving || !!draft.pending || draft.needsRebase || draft.rejectedStatus !== null;
  const ready = !disabled && !busy.current && !entry.saving && !draft.pending && !draft.needsRebase && draft.rejectedStatus === null && !!draft.decision && draft.dirty && draft.note.length <= 8000 && draft.correction.length <= 2000 && draft.expectedRevision === (entry.saved?.revision ?? 0);

  function edit(patch: Partial<Pick<Draft, 'decision' | 'note' | 'correction' | 'revisitLater'>>) {
    if (!current(entry) || locked) return;
    Object.assign(draft, patch, { dirty: true });
    entry.saveError = '';
    persist(entry);
    notify(entry);
  }

  function submit() {
    if (!current(entry) || disabled || busy.current) return;
    if (!draft.pending) {
      if (!ready) return;
      try {
        draft.pending = Object.freeze({
          ...entry.query,
          reviewerKey: session.reviewerKey,
          decision: draft.decision as Decision,
          note: draft.note.trim(),
          correction: draft.correction.trim(),
          revisitLater: draft.revisitLater,
          revision: draft.expectedRevision,
          requestId: secureRequestId(),
        });
        persist(entry);
      } catch {
        entry.saveError = 'A secure request ID could not be created. Your draft has not been sent. Keep your text and reload.';
        notify(entry);
        return;
      }
    }
    void send(entry);
  }

  return (
    <Stack component='form' aria-label='Whole-family arrangement feedback' spacing={2} onSubmit={(event) => { event.preventDefault(); submit(); }} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
      <Typography component='h3' variant='h6'>Your feedback on the whole family</Typography>
      <Typography variant='body2'>Your answer covers this complete arrangement, not an individual child or edge. Held, excluded and not-ready entries are not proposed placements. Saving feedback does not apply ontology changes.</Typography>
      {session.preview && <Alert severity='info'>Local preview: Saves go through the review service and are kept separately from production feedback. Peer feedback is unavailable.</Alert>}
      {entry.storageError && <Alert severity='warning'>{entry.storageError}</Alert>}
      {draft.dirty && !draft.pending && <Typography role='status' variant='body2'>{entry.storageError ? 'Unsaved family draft: retain a copy before reloading.' : 'Unsaved family draft retained for this account and dataset in this tab. It is not submitted feedback.'}</Typography>}
      {entry.resultText && <Typography role='status'>{entry.resultText}</Typography>}
      {entry.saveError && <Alert severity='error'>{entry.saveError}</Alert>}
      {otherSaving && <Alert severity='info'>Another family save is in progress. Please wait before saving this family.</Alert>}
      {draft.pending && <Alert severity='info'>Edits are locked while receipt is uncertain. Retry save uses the same request, even after navigation or reload.</Alert>}
      {draft.rejectedStatus !== null && <Button type='button' color='inherit' variant='outlined' disabled={entry.saving || disabled} onClick={() => {
        if (!current(entry) || entry.saving || disabled) return;
        draft.rejectedStatus = null;
        entry.saveError = '';
        persist(entry);
        notify(entry);
      }}>Edit rejected feedback</Button>}
      {draft.needsRebase && !draft.pending && (
        <Stack spacing={1}>
          <Alert severity='warning'>Review the latest saved family feedback. Rebasing keeps your draft text and choices; it does not submit them.</Alert>
          {entry.refreshing && <Typography role='status'>Loading latest family feedback…</Typography>}
          {entry.readError && <Alert severity='error'>{entry.readError}</Alert>}
          {(!entry.latestReady || entry.readError) && <Button type='button' color='inherit' variant='outlined' disabled={entry.refreshing || entry.saving} onClick={() => void loadLatest(entry)}>{entry.readError ? 'Retry loading latest feedback' : 'Load latest feedback'}</Button>}
          {entry.latestReady && !entry.readError && <Box>
            <Typography component='h4' variant='subtitle1'>Latest saved family feedback (revision {entry.saved?.revision ?? 0})</Typography>
            {entry.saved ? <SavedText feedback={entry.saved} /> : <Typography>No saved family judgment exists.</Typography>}
          </Box>}
          <Button type='button' color='inherit' variant='outlined' disabled={!entry.latestReady || !!entry.readError || entry.refreshing || entry.saving || disabled} onClick={() => {
            if (!current(entry) || !entry.latestReady || entry.readError || entry.refreshing || entry.saving || disabled) return;
            draft.expectedRevision = entry.saved?.revision ?? 0;
            draft.needsRebase = false;
            draft.rejectedStatus = null;
            draft.dirty = true;
            entry.saveError = '';
            persist(entry);
            notify(entry);
          }}>I reviewed the latest feedback; keep my draft</Button>
        </Stack>
      )}
      {entry.saved && !draft.needsRebase && <details><summary>Previously saved family feedback (revision {entry.saved.revision})</summary><SavedText feedback={entry.saved} /></details>}
      <FormControl component='fieldset' disabled={locked}>
        <FormLabel component='legend'>Does this proposed arrangement make sense?</FormLabel>
        <RadioGroup name={`branch-decision-${family.id}`} aria-label='Does this proposed arrangement make sense?' value={draft.decision} onChange={(_, value) => edit({ decision: value as Decision })}>
          <FormControlLabel value='agree' control={<Radio color='default' />} label='Agree' />
          <FormControlLabel value='disagree' control={<Radio color='default' />} label='Disagree' />
          <FormControlLabel value='discuss' control={<Radio color='default' />} label='Needs discussion' />
        </RadioGroup>
      </FormControl>
      <TextField label='Suggested changes (optional)' multiline minRows={2} value={draft.correction} disabled={locked} inputProps={{ maxLength: 2000 }} helperText={`${draft.correction.length}/2000 characters. Plain language is fine.`} onChange={(event) => edit({ correction: event.target.value })} />
      <TextField label='Comment (optional)' multiline minRows={3} value={draft.note} disabled={locked} inputProps={{ maxLength: 8000 }} helperText={`${draft.note.length}/8000 characters`} onChange={(event) => edit({ note: event.target.value })} />
      <FormControlLabel control={<Checkbox color='default' checked={draft.revisitLater} disabled={locked} onChange={(_, checked) => edit({ revisitLater: checked })} />} label='Revisit later' />
      <Button type='submit' color='inherit' variant='contained' disabled={disabled || !!busy.current || entry.saving || (!draft.pending && !ready)}>{entry.saving ? 'Saving feedback…' : draft.pending ? 'Retry save' : 'Save feedback'}</Button>
    </Stack>
  );
}
