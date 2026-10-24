import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Alert, Box, Button, ScopedCssBaseline, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import ReviewTheme from './ReviewTheme';
import ThemeModeToggle from './ThemeModeToggle';
import RelationshipPeerFeedback from './RelationshipPeerFeedback';
import BranchFeedbackForm from './BranchFeedbackForm';
import BranchNeighborhood, { NodeEvidence, NodeList, nodeId, nodeLabel } from './BranchNeighborhood';
import { relationshipRequest } from '../../lib/relationshipReview/client';
import type { BranchDataset, BranchFamily, BranchGroup, BranchMember, BranchSession } from '../../types/IBranchReview';
import type { RelationshipFeedback, RelationshipNode } from '../../types/IRelationshipReview';

type Expansion = { all: boolean; sequence: number };
type TraceEnvelope = { trace: unknown; caseId: string; datasetVersion: string; datasetSha256: string };

function accountIdentity(state: unknown): string | undefined {
  const value = state as Record<string, unknown> | null;
  if (!value) return undefined;
  for (const key of ['user', 'authUser', 'currentUser']) {
    const user = value[key] as Record<string, unknown> | null;
    if (user && typeof user === 'object') {
      for (const idKey of ['uid', 'id', 'userId']) {
        if (typeof user[idKey] === 'string' && user[idKey]) return `${key}:${user[idKey]}`;
      }
    }
  }
  for (const key of ['uid', 'userId']) if (typeof value[key] === 'string' && value[key]) return `${key}:${value[key]}`;
  return undefined;
}

function sessionValid(session: BranchSession, preview: boolean, requestedVersion?: string): boolean {
  const data = session?.dataset;
  return !!data && data.schemaVersion === 'generalization-branch-review-v1' && typeof data.version === 'string' && (!requestedVersion || data.version === requestedVersion) && typeof session.reviewerKey === 'string' && !!session.reviewerKey && session.preview === preview && /^[a-f0-9]{64}$/i.test(session.datasetSha256 ?? '') && !!session.feedback && typeof session.feedback === 'object' && typeof session.legacy?.version === 'string' && /^[a-f0-9]{64}$/i.test(session.legacy.sha256 ?? '') && Array.isArray(data.families) && data.families.every((family) => typeof family.id === 'string' && !!family.id && Array.isArray(family.generalizations) && Array.isArray(family.currentSpecializations) && Array.isArray(family.currentSourceRecords) && Array.isArray(family.sourceCaseIds) && Array.isArray(family.remainingQuestions) && Array.isArray(family.groups) && family.groups.every((group) => !!group.node && !!nodeId(group.node) && typeof group.eligible === 'boolean' && Array.isArray(group.remainingQuestions) && Array.isArray(group.members) && group.members.every((member) => !!member.node && !!nodeId(member.node) && ['include', 'hold', 'exclude'].includes(member.decision) && Array.isArray(member.currentGeneralizations) && Array.isArray(member.sourceRecords))));
}

function hasProposals(family: BranchFamily) {
  return family.groups.some((group) => group.eligible);
}

function counts(groups: BranchGroup[]) {
  const members = groups.flatMap((group) => group.members);
  return {
    groups: groups.length,
    eligible: groups.filter((group) => group.eligible).length,
    include: members.filter((member) => member.decision === 'include').length,
    hold: members.filter((member) => member.decision === 'hold').length,
    exclude: members.filter((member) => member.decision === 'exclude').length,
    records: members.length,
    proposed: groups.filter((group) => group.eligible).reduce((total, group) => total + group.members.filter((member) => member.decision === 'include').length, 0),
  };
}

function Disclosure({ title, expansion, children }: { title: string; expansion: Expansion; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(expansion.all); }, [expansion.all, expansion.sequence]);
  return <Box component='details' open={open} onToggle={(event) => setOpen(event.currentTarget.open)} sx={{ mt: 1 }}>
    <summary>{title}</summary>
    {open && <Box sx={{ mt: 1 }}>{children}</Box>}
  </Box>;
}

function Questions({ questions }: { questions: string[] }) {
  return questions.length ? <ul>{questions.map((question, index) => <li key={index}><Typography variant='body2' sx={{ whiteSpace: 'pre-wrap' }}>{question}</Typography></li>)}</ul> : <Typography variant='body2' color='text.secondary'>None supplied.</Typography>;
}

function Member({ member, eligible, expansion, inspect }: { member: BranchMember; eligible: boolean; expansion: Expansion; inspect: (id: string) => void }) {
  const proposed = eligible && member.decision === 'include';
  const status = member.decision === 'hold' ? 'Held for further review - not a proposed Specialization' : member.decision === 'exclude' ? 'Excluded from this proposal - kept for reference' : proposed ? 'Proposed Specialization - provisional' : 'Candidate Specialization - not a proposed change';
  return <Box component='li' sx={{ p: 2, mb: 2, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
    <Stack spacing={1}>
      <NodeEvidence node={member.node} />
      <Typography variant='body2' sx={{ fontWeight: 700 }}>{status}</Typography>
      <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap' }}>Reason: {member.reason}</Typography>
      {member.titleDependency === 'none-observed' ? <Typography variant='caption' color='text.secondary'>No title dependency observed in the supplied review.</Typography> : <Alert severity='warning'>
        <Typography variant='body2' sx={{ fontWeight: 600 }}>Provisional - recheck after title changes or activity splits</Typography>
        <Typography variant='body2'>{member.titleDependency === 'requires-title-clarification' ? 'This activity needs title clarification before any placement can be settled. Recheck after clarification or an activity split.' : 'Any placement depends on the activity title. Recheck after title changes or activity splits.'}</Typography>
      </Alert>}
      {member.nounEvidenceNote && <Disclosure title='Noun evidence details' expansion={expansion}><Typography variant='body2' sx={{ whiteSpace: 'pre-wrap' }}>{member.nounEvidenceNote}</Typography></Disclosure>}
      <Box>
        <Typography component='h6' variant='subtitle2'>Current Generalizations ({member.currentGeneralizations.length})</Typography>
        <Typography variant='caption' color='text.secondary'>These other current links are context, not newly validated or removed by this proposal.</Typography>
        <NodeList nodes={member.currentGeneralizations} />
      </Box>
      <Disclosure title={`Source descriptions for ${nodeLabel(member.node)} (${member.sourceRecords.length})`} expansion={expansion}>
        <Typography variant='body2'>Read the relevant named activity within a compound O*NET description. A source record is not itself a proposed Specialization.</Typography>
        <NodeList nodes={member.sourceRecords} source />
      </Disclosure>
      <Button type='button' color='inherit' variant='outlined' sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' }, whiteSpace: 'normal' }} onClick={() => inspect(nodeId(member.node))}>Open neighboring activities for {nodeLabel(member.node)}</Button>
    </Stack>
  </Box>;
}

function Group({ group, expansion, inspect }: { group: BranchGroup; expansion: Expansion; inspect: (id: string) => void }) {
  const count = counts([group]);
  const proposedMembers = group.members.filter((member) => group.eligible && member.decision === 'include');
  const referenceCount = count.records - proposedMembers.length;
  const sections: { decision: BranchMember['decision']; title: string }[] = [
    { decision: 'include', title: 'Candidate Specializations - not proposed changes' },
    { decision: 'hold', title: 'Held activities - not proposed changes' },
    { decision: 'exclude', title: 'Excluded activities - not proposed changes' },
  ];
  return <Box component='article' aria-label={`Specialization group ${nodeLabel(group.node)}`} sx={{ p: { xs: 1.5, sm: 2 }, mb: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
    <Stack spacing={1.5}>
      <Typography component='h4' variant='h6'>{nodeLabel(group.node)}</Typography>
      <NodeEvidence node={group.node} />
      <Alert severity={group.eligible ? 'info' : 'warning'}>{group.eligible ? 'Provisional group - review the proposed Specializations together.' : 'Kept for reference - no proposed changes in this group.'}</Alert>
      <Typography sx={{ whiteSpace: 'pre-wrap' }}>{group.summary}</Typography>
      <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap' }}>Coherence note: {group.coherence}</Typography>
      <Button type='button' color='inherit' variant='outlined' sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' }, whiteSpace: 'normal' }} onClick={() => inspect(nodeId(group.node))}>Open neighboring activities for {nodeLabel(group.node)}</Button>
      {group.eligible && <Box component='section' aria-label={`Proposed Specializations in ${nodeLabel(group.node)}`}>
        <Typography component='h5' variant='subtitle1'>Proposed Specializations</Typography>
        {proposedMembers.length ? <Box component='ul' sx={{ listStyle: 'none', p: 0 }}>{proposedMembers.map((member, index) => <Member key={`${nodeId(member.node)}-${index}`} member={member} eligible={group.eligible} expansion={expansion} inspect={inspect} />)}</Box> : <Typography variant='body2' color='text.secondary'>None supplied.</Typography>}
      </Box>}
      {referenceCount > 0 && <Disclosure title={`Other candidates kept for reference (${referenceCount})`} expansion={expansion}>
        <Typography variant='body2'>These activities are not proposed changes. The original candidate decisions and all supporting evidence are retained here.</Typography>
        {sections.filter((section) => !group.eligible || section.decision !== 'include').map((section) => {
          const members = group.members.filter((member) => member.decision === section.decision);
          return members.length ? <Box component='section' aria-label={`${section.title} in ${nodeLabel(group.node)}`} key={section.decision}>
            <Typography component='h5' variant='subtitle1'>{section.title} ({members.length})</Typography>
            <Box component='ul' sx={{ listStyle: 'none', p: 0 }}>{members.map((member, index) => <Member key={`${nodeId(member.node)}-${index}`} member={member} eligible={group.eligible} expansion={expansion} inspect={inspect} />)}</Box>
          </Box> : null;
        })}
      </Disclosure>}
      <Disclosure title={`Questions and technical details for this group (${group.remainingQuestions.length} questions)`} expansion={expansion}>
        <Typography variant='body2'>Review status: {group.eligible ? 'eligible' : 'not ready'}. {count.records} member records - {count.include} include - {count.hold} hold - {count.exclude} exclude - {count.proposed} proposed memberships.</Typography>
        <Questions questions={group.remainingQuestions} />
      </Disclosure>
    </Stack>
  </Box>;
}

function Audit({ session, family }: { session: BranchSession; family: BranchFamily }) {
  const [open, setOpen] = useState(false);
  const [trace, setTrace] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(false);
  const sequence = useRef(0);
  const query = useMemo(() => ({ caseId: family.id, datasetVersion: session.dataset.version, datasetSha256: session.datasetSha256 }), [family.id, session.dataset.version, session.datasetSha256]);
  const key = JSON.stringify([session.reviewerKey, session.preview, query]);
  const active = useRef(key);
  active.current = key;
  useEffect(() => { alive.current = true; return () => { alive.current = false; ++sequence.current; }; }, []);
  const load = useCallback(async () => {
    const requestSequence = ++sequence.current;
    setLoading(true);
    setError('');
    try {
      const value: TraceEnvelope = await relationshipRequest('branch-trace', query, session.preview);
      if (!alive.current || active.current !== key || sequence.current !== requestSequence) return;
      if (!value || value.caseId !== query.caseId || value.datasetVersion !== query.datasetVersion || value.datasetSha256 !== query.datasetSha256 || value.trace === null || value.trace === undefined) throw new Error('Unbound agent trace');
      setTrace(value.trace);
    } catch {
      if (alive.current && active.current === key && sequence.current === requestSequence) setError('Agents and prompts could not be loaded or verified for this family. Retry audit. Your feedback has not changed.');
    } finally {
      if (alive.current && active.current === key && sequence.current === requestSequence) setLoading(false);
    }
  }, [key, query, session.preview]);
  useEffect(() => {
    if (open && trace === null && !error && !loading) void load();
  }, [open, trace, error, loading, load]);
  const data = session.dataset;
  const packageCounts = counts(data.families.flatMap((item) => item.groups));
  const familyCounts = counts(family.groups);
  const sourceCases = new Set(data.families.flatMap((item) => item.sourceCaseIds)).size;
  const distinctMembers = new Set(data.families.flatMap((item) => item.groups.flatMap((group) => group.members.map((member) => nodeId(member.node))))).size;
  const metadata: [string, string][] = [
    ['Package title', data.title], ['Schema', data.schemaVersion], ['Dataset version', data.version], ['Dataset SHA-256', session.datasetSha256], ['Created', data.createdAt],
    ['Model', data.model], ['Model version', data.modelVersion], ['Reasoning', data.reasoning], ['Funding route', data.fundingRoute],
    ['Source application', data.sourceApp], ['Source captured', data.sourceCapturedAt], ['Source rechecked', data.sourceRecheckedAt], ['Source SHA-256', data.sourceSha256],
    ['Prior dataset version', data.priorDatasetVersion], ['Prior dataset SHA-256', data.priorDatasetSha256],
  ];
  const exactStyle = { maxHeight: 440, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12, p: 1.5, bgcolor: 'action.hover' } as const;
  return <Box component='details' open={open} onToggle={(event) => setOpen(event.currentTarget.open)} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
    <summary>Agents and prompts used for this proposal</summary>
    {open && <Stack spacing={2} sx={{ mt: 2 }}>
      <Typography variant='body2'>This disclosure contains exact author and critic requests and results, provenance and alias maps. Same-model author and critical reviews are not independent human checks; model agreement is not human accuracy or approval.</Typography>
      <Box>
        <Typography component='h3' variant='subtitle1'>Exact package counts</Typography>
        <Typography variant='body2'>{data.families.length} higher-level activities - {packageCounts.groups} candidate groups - {packageCounts.eligible} eligible - {packageCounts.groups - packageCounts.eligible} not ready - {sourceCases} earlier source cases</Typography>
        <Typography variant='body2'>{packageCounts.records} member records ({packageCounts.include} include, {packageCounts.hold} hold, {packageCounts.exclude} exclude), representing {distinctMembers} distinct activities. An activity can occur in more than one group. {packageCounts.proposed} memberships are provisional proposals in eligible groups.</Typography>
      </Box>
      <Box>
        <Typography component='h3' variant='subtitle1'>Exact counts for {family.title}</Typography>
        <Typography variant='body2'>{familyCounts.groups} candidate groups - {familyCounts.eligible} eligible - {familyCounts.groups - familyCounts.eligible} not ready - {familyCounts.records} member records ({familyCounts.include} include, {familyCounts.hold} hold, {familyCounts.exclude} exclude) - {familyCounts.proposed} proposed memberships</Typography>
      </Box>
      <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap' }}>Title review note: {data.titleStatusNote}</Typography>
      {data.scopeNote && <Typography sx={{ whiteSpace: 'pre-wrap' }}>{data.scopeNote}</Typography>}
      {data.nounNote && <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap' }}>{data.nounNote}</Typography>}
      <Box component='dl' sx={{ m: 0, '& dt': { fontWeight: 600 }, '& dd': { ml: 0, mb: 1, overflowWrap: 'anywhere' } }}>{metadata.map(([label, value]) => <Box key={label}><dt>{label}</dt><dd>{value}</dd></Box>)}</Box>
      <Box><Typography component='h3' variant='subtitle1'>Exact author prompt</Typography><Box component='pre' tabIndex={0} aria-label='Exact author prompt' sx={exactStyle}>{data.prompt}</Box></Box>
      <Box><Typography component='h3' variant='subtitle1'>Exact critic prompts ({data.criticPrompts.length})</Typography>{data.criticPrompts.map((prompt, index) => <Box component='pre' tabIndex={0} aria-label={`Exact critic prompt ${index + 1}`} sx={exactStyle} key={index}>{prompt}</Box>)}</Box>
      {loading && <Typography role='status'>Loading exact agent trace…</Typography>}
      {error && <Alert severity='error' action={<Button color='inherit' disabled={loading} onClick={() => void load()}>Retry audit</Button>}>{error}</Alert>}
      {trace !== null && <Box><Typography component='h3' variant='subtitle1'>Exact agent requests, results and source provenance</Typography><Box component='pre' tabIndex={0} aria-label='Exact agent trace' sx={exactStyle}>{JSON.stringify(trace, null, 2)}</Box></Box>}
    </Stack>}
  </Box>;
}

function mergeFeedback(previous: Record<string, RelationshipFeedback>, incoming: Record<string, RelationshipFeedback>) {
  const next = { ...previous };
  Object.entries(incoming).forEach(([id, feedback]) => {
    if (!next[id] || feedback.revision > next[id].revision) next[id] = feedback;
  });
  return next;
}

export default function BranchReview({ preview = false }: { preview?: boolean }) {
  const router = useRouter();
  const [authState] = useAuth();
  const rawVersion = router.query.version;
  const requestedVersion = Array.isArray(rawVersion) ? rawVersion[0] : rawVersion;
  const rawFamily = router.query.family;
  const requestedFamily = Array.isArray(rawFamily) ? rawFamily[0] : rawFamily;
  const ready = preview || (authState.isAuthInitialized && authState.isAuthenticated);
  // The fallback observes the auth-state object itself rather than assuming an
  // undocumented account field. A changed account invalidates reads immediately.
  const account = preview ? 'local-preview' : accountIdentity(authState) ?? authState;
  const target = useMemo(() => ({ preview, requestedVersion, account, ready }), [preview, requestedVersion, account, ready]);
  const active = useRef(target);
  active.current = target;
  const alive = useRef(false);
  const readSeq = useRef(0);
  const [loaded, setLoaded] = useState<{ target: typeof target; session: BranchSession } | null>(null);
  const [status, setStatus] = useState<{ target: typeof target; loading: boolean; error: string } | null>(null);
  const [familyId, setFamilyId] = useState('');
  const [search, setSearch] = useState('');
  const [showReferenceActivities, setShowReferenceActivities] = useState(false);
  const [expansion, setExpansion] = useState<Expansion>({ all: false, sequence: 0 });
  const [focusRequest, setFocusRequest] = useState<{ familyId: string; id: string; sequence: number } | undefined>();
  const [legacyCase, setLegacyCase] = useState<{ familyId: string; id: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const session = loaded?.target === target ? loaded.session : null;
  const data = session?.dataset;
  const orderedFamilies = useMemo(() => [...(data?.families ?? [])].sort((left, right) => Number(hasProposals(right)) - Number(hasProposals(left))), [data]);
  const family = orderedFamilies.find((item) => item.id === familyId) ?? orderedFamilies[0];
  const currentStatus = status?.target === target ? status : { loading: true, error: '' };

  useEffect(() => { alive.current = true; return () => { alive.current = false; ++readSeq.current; }; }, []);
  const load = useCallback(async () => {
    if (!ready || !router.isReady) return;
    const sequence = ++readSeq.current;
    setStatus({ target, loading: true, error: '' });
    try {
      const next: BranchSession = await relationshipRequest('branch-session', requestedVersion ? { datasetVersion: requestedVersion } : {}, preview);
      if (!alive.current || active.current !== target || sequence !== readSeq.current) return;
      if (!sessionValid(next, preview, requestedVersion)) throw new Error('Unbound branch package');
      setFamilyId((previous) => next.dataset.families.find((item) => item.id === requestedFamily)?.id ?? next.dataset.families.find((item) => item.id === previous)?.id ?? next.dataset.families.find(hasProposals)?.id ?? next.dataset.families[0]?.id ?? '');
      setLoaded((previous) => ({ target, session: previous?.target === target && previous.session.datasetSha256 === next.datasetSha256 && previous.session.reviewerKey === next.reviewerKey ? { ...next, feedback: mergeFeedback(previous.session.feedback, next.feedback) } : next }));
      setStatus({ target, loading: false, error: '' });
    } catch {
      if (alive.current && active.current === target && sequence === readSeq.current) setStatus({ target, loading: false, error: 'The Generalization family package could not be loaded or verified for this account and version. Retry loading the package. Retained drafts are not discarded.' });
    }
  }, [target, ready, router.isReady, requestedVersion, requestedFamily, preview]);
  useEffect(() => { void load(); return () => { ++readSeq.current; }; }, [load]);
  useEffect(() => { heading.current?.focus(); }, [family?.id, session?.datasetSha256, session?.reviewerKey]);

  function navigate(id: string) {
    setFamilyId(id);
    setFocusRequest(undefined);
    setLegacyCase(null);
  }

  function acceptLatest(next: BranchSession) {
    if (!alive.current || active.current !== target || !session || next.reviewerKey !== session.reviewerKey || next.datasetSha256 !== session.datasetSha256 || next.dataset.version !== session.dataset.version || next.preview !== session.preview) return;
    setLoaded((previous) => previous?.target === target ? { target, session: { ...next, feedback: mergeFeedback(previous.session.feedback, next.feedback) } } : previous);
  }

  function acceptSaved(answer: RelationshipFeedback) {
    if (!alive.current || active.current !== target || !session || answer.datasetVersion !== session.dataset.version || !session.dataset.families.some((item) => item.id === answer.caseId)) return;
    setLoaded((previous) => previous?.target === target && previous.session.reviewerKey === session.reviewerKey && previous.session.datasetSha256 === session.datasetSha256 ? { target, session: { ...previous.session, feedback: mergeFeedback(previous.session.feedback, { [answer.caseId]: answer }) } } : previous);
  }

  const packageCounts = data ? counts(data.families.flatMap((item) => item.groups)) : null;
  const proposedFamilies = orderedFamilies.filter(hasProposals);
  const navigationFamilies = showReferenceActivities ? orderedFamilies : orderedFamilies.filter((item) => hasProposals(item) || item.id === family?.id);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleFamilies = navigationFamilies.filter((item) => !normalizedSearch || [item.title, item.id, ...item.groups.flatMap((group) => [nodeLabel(group.node), ...group.members.map((member) => nodeLabel(member.node))]), ...item.currentSpecializations.map(nodeLabel)].some((text) => text.toLocaleLowerCase().includes(normalizedSearch)));
  const familyIndex = family ? navigationFamilies.findIndex((item) => item.id === family.id) : -1;
  const familyCounts = family ? counts(family.groups) : null;
  const inspect = (id: string) => { if (family) setFocusRequest((previous) => ({ familyId: family.id, id, sequence: (previous?.sequence ?? 0) + 1 })); };
  const knownNodes = new Map<string, RelationshipNode>();
  family?.groups.forEach((group) => group.members.forEach((member) => knownNodes.set(nodeId(member.node), member.node)));
  family?.currentSpecializations.forEach((node) => knownNodes.set(nodeId(node), node));
  const isolatedKey = session ? JSON.stringify([session.preview, session.reviewerKey, session.dataset.version, session.datasetSha256]) : '';

  return <ReviewTheme><ScopedCssBaseline>
    <Head><title>Review Generalizations</title><meta name='robots' content='noindex,nofollow' /></Head>
    <Box component='main' sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary', py: { xs: 3, md: 5 }, px: { xs: 2, md: 4 }, overflowWrap: 'anywhere' }}>
      <Stack spacing={3} sx={{ maxWidth: 1120, mx: 'auto' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent='space-between' alignItems='flex-start' gap={2}>
          <Box><Typography variant='overline'>Society of Mind · Ontology review</Typography><Typography component='h1' variant='h4' sx={{ mt: 1 }}>Review Generalizations</Typography></Box>
          <ThemeModeToggle showLabel />
        </Stack>
        <Stack spacing={1} sx={{ maxWidth: 900 }}>
          <Typography>Review the proposed Specializations together under each higher-level activity. Open the source descriptions or neighboring activities when helpful.</Typography>
          <Typography>A Specialization should be a kind of its Generalization. An activity can have several Generalizations; its other current links remain visible and are not removed by this proposal.</Typography>
          <Typography>This page records feedback only, not ontology changes. Current neighbors are context, not newly validated links.</Typography>
        </Stack>
        {!ready && <Typography role='status'>Loading your account…</Typography>}
        {currentStatus.error && <Alert severity='error' action={<Button color='inherit' onClick={() => void load()}>Retry loading package</Button>}>{currentStatus.error}</Alert>}
        {ready && currentStatus.loading && <Typography role='status'>{session ? 'Refreshing the package; drafts are retained…' : 'Loading Generalizations...'}</Typography>}
        {session && data && packageCounts && <>
          <Typography variant='body2'>Reviewing as {session.reviewerLabel}</Typography>
          <Typography>{proposedFamilies.length} higher-level activities with proposals - {packageCounts.eligible} proposed groups</Typography>
          <Alert severity='warning'>All proposed placements are provisional. Recheck title-dependent placements after title changes or activity splits, regardless of group feedback.</Alert>
          <Alert severity='info'><Stack spacing={1}><Typography>Earlier individual feedback stays separate and does not approve this proposed arrangement.</Typography><Button color='inherit' variant='outlined' href={`/review/relationships?version=${encodeURIComponent(session.legacy.version)}`}>Open earlier individual review</Button><Button color='inherit' href={`/review/relationships/branches?version=${encodeURIComponent(data.version)}`}>Direct link to this Generalization review package</Button></Stack></Alert>
          <Box component='nav' aria-label='Generalizations'>
            <Typography component='h2' variant='h6'>Choose a higher-level activity</Typography>
            <TextField fullWidth label='Find a Generalization or activity' value={search} onChange={(event) => setSearch(event.target.value)} sx={{ my: 2 }} />
            <Typography variant='body2'>Search filters the list, not the arrangement. Previous and Next browse activities with proposals unless reference activities are shown; the open activity stays available.</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 1, mb: 2 }}>
              <Button color='inherit' variant='outlined' aria-expanded={showReferenceActivities} onClick={() => setShowReferenceActivities((previous) => !previous)} sx={{ whiteSpace: 'normal' }}>{showReferenceActivities ? 'Hide activities with no proposed changes' : 'Show activities with no proposed changes'}</Button>
              {search && <Button color='inherit' onClick={() => setSearch('')}>Clear search</Button>}
            </Stack>
            <Stack component='ul' spacing={1} sx={{ listStyle: 'none', p: 0 }}>
              {visibleFamilies.map((item) => { const count = counts(item.groups); return <li key={item.id}><Button color='inherit' fullWidth variant={family?.id === item.id ? 'contained' : 'outlined'} aria-current={family?.id === item.id ? 'step' : undefined} aria-label={`Review Generalization ${item.title}`} onClick={() => navigate(item.id)} sx={{ justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal' }}>{item.title} - {count.eligible ? `${count.eligible} proposed group${count.eligible === 1 ? '' : 's'}` : 'No proposed changes - kept for reference'}</Button></li>; })}
            </Stack>
            {!visibleFamilies.length && <Typography role='status'>No matching activities. Clear search or show activities with no proposed changes to browse the retained candidates.</Typography>}
          </Box>
          {family && familyCounts ? <>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button color='inherit' variant='outlined' disabled={familyIndex <= 0} onClick={() => navigate(navigationFamilies[familyIndex - 1].id)}>Previous activity</Button>
              <Typography role='status'>Activity {familyIndex + 1} of {navigationFamilies.length}</Typography>
              <Button color='inherit' variant='outlined' disabled={familyIndex >= navigationFamilies.length - 1} onClick={() => navigate(navigationFamilies[familyIndex + 1].id)}>Next activity</Button>
            </Stack>
            <Box component='section' aria-label='Higher Generalization'>
              <Typography component='h2' variant='h5' tabIndex={-1} ref={heading}>Generalization: {family.title}</Typography>
              <Typography variant='caption' color='text.secondary'>Source ID: {family.id}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{family.description}</Typography>
              <Disclosure title='Original assessment and scope' expansion={expansion}>
                <Typography variant='body2'>This original assessment preceded the additional checks. Only the proposed groups below are offered for a judgment; other candidates remain separate.</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{family.summary}</Typography>
                {family.scopeNote && <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{family.scopeNote}</Typography>}
              </Disclosure>
              <Typography component='h3' variant='subtitle1' sx={{ mt: 2 }}>Current Generalizations of this activity ({family.generalizations.length})</Typography>
              <NodeList nodes={family.generalizations} />
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
              <Button color='inherit' variant='outlined' onClick={() => setExpansion((previous) => ({ all: true, sequence: previous.sequence + 1 }))}>Expand supporting details</Button>
              <Button color='inherit' variant='outlined' onClick={() => setExpansion((previous) => ({ all: false, sequence: previous.sequence + 1 }))}>Collapse supporting details</Button>
            </Stack>
            <Box component='section' aria-label='Complete proposed arrangement'>
              <Typography component='h3' variant='h6'>Proposed arrangement</Typography>
              <Typography sx={{ my: 2 }}>Review each proposed group and its Specializations together under this Generalization. The complete proposed arrangement is shown without paging. Other candidates are kept below for reference, not as proposed changes.</Typography>
              <Box component='section' aria-label='Proposed Specialization groups'>
                <Typography component='h3' variant='subtitle1'>Proposed groups ({familyCounts.eligible})</Typography>
                {!familyCounts.eligible && <Alert severity='info'>This Generalization has no proposed changes. Other candidates remain available for reference. Any saved feedback stays visible below; new judgments are disabled.</Alert>}
                {family.groups.filter((group) => group.eligible).map((group) => <Group key={group.id} group={group} expansion={expansion} inspect={inspect} />)}
              </Box>
              {family.groups.length > familyCounts.eligible && <Disclosure key={`${isolatedKey}:${family.id}:reference-groups`} title={`Other candidates kept for reference (${family.groups.length - familyCounts.eligible} groups)`} expansion={expansion}>
                <Typography sx={{ my: 2 }}>These groups are not proposed changes. All held, excluded and other candidate activities and their source evidence are retained for inspection.</Typography>
                {family.groups.filter((group) => !group.eligible).map((group) => <Group key={group.id} group={group} expansion={expansion} inspect={inspect} />)}
              </Disclosure>}
            </Box>
            <Box component='section' aria-label='Current links and neighboring activities' sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Typography component='h3' variant='h6'>Current links and neighboring activities</Typography>
              <Typography>Current links are context, not proposed changes or newly validated links. This review does not remove them.</Typography>
              <Disclosure key={`${isolatedKey}:${family.id}:direct-links`} title={`Current direct Specializations (${family.currentSpecializations.length})`} expansion={expansion}>
                <NodeList nodes={family.currentSpecializations} />
              </Disclosure>
              <Disclosure key={`${isolatedKey}:${family.id}:source-descriptions`} title={`Current source descriptions (${family.currentSourceRecords.length})`} expansion={expansion}><Typography variant='body2'>Source descriptions are evidence and may combine activities. They are separate from current Specializations and proposed placements.</Typography><NodeList nodes={family.currentSourceRecords} source /></Disclosure>
              <BranchNeighborhood key={`${isolatedKey}:${family.id}:context`} session={session} family={family} requestedFocus={focusRequest?.familyId === family.id ? focusRequest : undefined} />
            </Box>
            <Disclosure title={`Remaining questions for this Generalization (${family.remainingQuestions.length})`} expansion={expansion}><Questions questions={family.remainingQuestions} /></Disclosure>
            <BranchFeedbackForm key={isolatedKey} session={session} family={family} disabled={currentStatus.loading || !!currentStatus.error || familyCounts.eligible === 0} onSaved={acceptSaved} onLatestSession={acceptLatest} />
            <RelationshipPeerFeedback session={session} caseId={family.id} readAction='branch-peer-feedback' saveAction='branch-save-peer' refreshKey={session.feedback[family.id]?.revision ?? 0} />
            <Box component='section' aria-label='Earlier individual judgments'>
              <details><summary>Inspect earlier individual judgments ({family.sourceCaseIds.length})</summary><Stack spacing={1} sx={{ mt: 1 }}><Typography>Earlier judgments about individual activities stay separate from this proposed arrangement and do not approve it. Responding to comments does not submit a new judgment about the original activity.</Typography>{family.sourceCaseIds.map((id) => <Button key={id} type='button' color='inherit' variant='outlined' onClick={() => setLegacyCase({ familyId: family.id, id })}>Inspect earlier individual judgment for {knownNodes.has(id) ? nodeLabel(knownNodes.get(id)!) : id}</Button>)}</Stack></details>
              {legacyCase?.familyId === family.id && <Box sx={{ mt: 2, p: 2, border: 1, borderColor: 'divider' }}>
                <Typography component='h3' variant='h6'>Earlier individual judgment — not family approval</Typography>
                <Typography variant='body2'>Activity source ID: {legacyCase.id}</Typography>
                <RelationshipPeerFeedback key={`${isolatedKey}:legacy:${legacyCase.id}`} caseId={legacyCase.id} session={{ dataset: { version: session.legacy.version }, datasetSha256: session.legacy.sha256, reviewerKey: session.reviewerKey, preview: session.preview, peerReviewer: session.peerReviewer, canViewPeerFeedback: session.canViewPeerFeedback }} />
                <Button color='inherit' onClick={() => setLegacyCase(null)}>Close earlier judgment</Button>
              </Box>}
            </Box>
            <Audit key={`${isolatedKey}:${family.id}:audit`} session={session} family={family} />
          </> : <Typography>No families were supplied in this package.</Typography>}
        </>}
      </Stack>
    </Box>
  </ScopedCssBaseline></ReviewTheme>;
}
