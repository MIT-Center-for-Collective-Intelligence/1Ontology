import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { relationshipRequest } from '../../lib/relationshipReview/client';
import type { BranchFamily, BranchSession } from '../../types/IBranchReview';
import type { RelationshipNode } from '../../types/IRelationshipReview';

function field(node: RelationshipNode, key: string): unknown {
  return (node as unknown as Record<string, unknown>)[key];
}

export function nodeId(node: RelationshipNode): string {
  const id = field(node, 'id');
  return typeof id === 'string' ? id : '';
}

export function nodeLabel(node: RelationshipNode): string {
  for (const key of ['title', 'label', 'name']) {
    const value = field(node, key);
    if (typeof value === 'string' && value.trim()) return value;
  }
  return nodeId(node) || 'Unnamed supplied record';
}

function description(node: RelationshipNode): string {
  for (const key of ['description', 'text', 'definition']) {
    const value = field(node, key);
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function suppliedHref(node: RelationshipNode): string | null {
  for (const key of ['href', 'url']) {
    const value = field(node, key);
    if (typeof value !== 'string') continue;
    if (value.startsWith('/') && !value.startsWith('//')) return value;
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' || url.protocol === 'http:') return value;
    } catch {
      // A supplied string is evidence, not an instruction or executable URL.
    }
  }
  return null;
}

export function NodeEvidence({ node, source = false }: { node: RelationshipNode; source?: boolean }) {
  const href = suppliedHref(node);
  return (
    <Stack spacing={0.5} sx={{ overflowWrap: 'anywhere' }}>
      <Typography variant='body2' sx={{ fontWeight: 600 }}>
        {href ? <a href={href} rel='noopener noreferrer'>{nodeLabel(node)}</a> : nodeLabel(node)}
      </Typography>
      <Typography variant='caption' color='text.secondary'>Source ID: {nodeId(node)}</Typography>
      {source && <Typography variant='caption'>Source record: context, not a proposed placement.</Typography>}
      {description(node) && <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap' }}>{description(node)}</Typography>}
      <details>
        <summary>Exact supplied record for {nodeLabel(node)}</summary>
        <Box component='pre' tabIndex={0} sx={{ maxHeight: 280, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 12, p: 1, bgcolor: 'action.hover' }}>
          {JSON.stringify(node, null, 2)}
        </Box>
      </details>
    </Stack>
  );
}

export function NodeList({ nodes, source = false }: { nodes: RelationshipNode[]; source?: boolean }) {
  if (!nodes.length) return <Typography variant='body2' color='text.secondary'>None supplied.</Typography>;
  return (
    <Box component='ul' sx={{ pl: 3, my: 1, '& > li': { mb: 1.5 } }}>
      {nodes.map((node, index) => <li key={`${nodeId(node)}-${index}`}><NodeEvidence node={node} source={source} /></li>)}
    </Box>
  );
}
type Page = {
  items: RelationshipNode[];
  total: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
};
type Neighborhood = {
  caseId: string;
  datasetVersion: string;
  datasetSha256: string;
  sourceSha256: string;
  focus: RelationshipNode;
  generalizations: RelationshipNode[];
  specializations: Page;
  sources: Page;
  siblings: Page;
  limitations: string[];
};

type Choice = { id: string; label: string };
const LIMIT = 8;

function nodesValid(value: unknown): value is RelationshipNode[] {
  return Array.isArray(value) && value.every((node) => node && typeof node === 'object' && nodeId(node) !== '');
}

function pageValid(value: Page | undefined, offset: number): boolean {
  if (!value || !nodesValid(value.items) || !Number.isSafeInteger(value.total) || value.total < 0 || value.offset !== offset || value.limit !== LIMIT || value.items.length > value.limit) return false;
  if (value.items.length && value.offset + value.items.length > value.total) return false;
  if (value.nextOffset === null) return true;
  return Number.isSafeInteger(value.nextOffset) && value.nextOffset > value.offset && value.nextOffset < value.total;
}

function range(label: string, page: Page): string {
  if (!page.total) return `${label}: 0 total`;
  if (!page.items.length) return `${label}: 0 shown at offset ${page.offset}; ${page.total} total`;
  return `${label}: showing ${page.offset + 1}–${page.offset + page.items.length} of ${page.total}`;
}

export default function BranchNeighborhood({
  session,
  family,
  requestedFocus,
}: {
  session: BranchSession;
  family: BranchFamily;
  requestedFocus?: { id: string; sequence: number };
}) {
  const [open, setOpen] = useState(false);
  const [focusId, setFocusId] = useState(family.id);
  const [activityOffset, setActivityOffset] = useState(0);
  const [sourceOffset, setSourceOffset] = useState(0);
  const [context, setContext] = useState<Neighborhood | null>(null);
  const [learned, setLearned] = useState<RelationshipNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(false);
  const sequence = useRef(0);

  const choices = useMemo(() => {
    const result = new Map<string, Choice>();
    result.set(family.id, { id: family.id, label: `${family.title} — higher Generalization` });
    const add = (node: RelationshipNode) => {
      const id = nodeId(node);
      if (id && !result.has(id)) result.set(id, { id, label: nodeLabel(node) });
    };
    family.generalizations.forEach(add);
    family.currentSpecializations.forEach(add);
    family.groups.forEach((group) => {
      add(group.node);
      group.members.forEach((member) => {
        add(member.node);
        member.currentGeneralizations.forEach(add);
      });
    });
    learned.forEach(add);
    return Array.from(result.values());
  }, [family, learned]);
  const choicesRef = useRef(choices);
  choicesRef.current = choices;

  const query = useMemo(() => ({
    caseId: family.id,
    datasetVersion: session.dataset.version,
    datasetSha256: session.datasetSha256,
    focusId,
    activityOffset,
    sourceOffset,
    limit: LIMIT,
  }), [family.id, session.dataset.version, session.datasetSha256, focusId, activityOffset, sourceOffset]);
  const key = JSON.stringify([session.reviewerKey, session.preview, query]);
  const active = useRef(key);
  active.current = key;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; ++sequence.current; };
  }, []);

  useEffect(() => {
    if (!requestedFocus) return;
    setFocusId(requestedFocus.id);
    setActivityOffset(0);
    setSourceOffset(0);
    setContext(null);
    setOpen(true);
  }, [requestedFocus?.id, requestedFocus?.sequence]);

  const load = useCallback(async () => {
    const requestSequence = ++sequence.current;
    setContext(null);
    setError('');
    if (!choicesRef.current.some((choice) => choice.id === query.focusId)) {
      setLoading(false);
      setError('The requested activity is not supplied by this family. Choose a supplied activity; no different focus has been substituted.');
      return;
    }
    setLoading(true);
    try {
      const result = await relationshipRequest('branch-context', query, session.preview);
      if (!alive.current || active.current !== key || sequence.current !== requestSequence) return;
      const value = result?.context as Neighborhood | undefined;
      if (!value || value.caseId !== query.caseId || value.datasetVersion !== query.datasetVersion || value.datasetSha256 !== query.datasetSha256 || value.sourceSha256 !== session.dataset.sourceSha256 || !value.focus || nodeId(value.focus) !== query.focusId || !nodesValid(value.generalizations) || !pageValid(value.specializations, query.activityOffset) || !pageValid(value.siblings, query.activityOffset) || !pageValid(value.sources, query.sourceOffset) || !Array.isArray(value.limitations) || !value.limitations.every((item) => typeof item === 'string')) {
        throw new Error('Unbound or invalid source context');
      }
      setContext(value);
      setLearned((previous) => {
        const byId = new Map(previous.map((node) => [nodeId(node), node]));
        [value.focus, ...value.generalizations].forEach((node) => byId.set(nodeId(node), node));
        return Array.from(byId.values());
      });
    } catch {
      if (alive.current && active.current === key && sequence.current === requestSequence) {
        setError('Current source context could not be loaded or verified for the selected activity. Retry context. Reading evidence does not save or change your feedback.');
      }
    } finally {
      if (alive.current && active.current === key && sequence.current === requestSequence) setLoading(false);
    }
  }, [key, query, session.preview, session.dataset.sourceSha256]);

  useEffect(() => {
    if (open) void load();
    else { ++sequence.current; setLoading(false); }
    return () => { ++sequence.current; };
  }, [open, load]);

  const nextOffsets = context ? [context.specializations.nextOffset, context.siblings.nextOffset].filter((offset): offset is number => typeof offset === 'number') : [];
  const nextActivity = nextOffsets.length ? Math.min(...nextOffsets) : null;

  return (
    <Box component='details' open={open} onToggle={(event) => setOpen(event.currentTarget.open)} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <summary>Optional activity neighborhood (current context)</summary>
      {open && (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Typography variant='body2'>These are current source neighbors, not newly validated placements. This optional view is paged; the complete family arrangement above is not.</Typography>
          <Box>
            <label htmlFor={`branch-focus-${family.id}`}>Activity to inspect</label>
            <Box component='select' id={`branch-focus-${family.id}`} value={focusId} onChange={(event) => {
              setFocusId(event.target.value);
              setActivityOffset(0);
              setSourceOffset(0);
              setContext(null);
            }} sx={{ display: 'block', width: '100%', mt: 1, p: 1, color: 'text.primary', bgcolor: 'background.paper', borderColor: 'divider' }}>
              {!choices.some((choice) => choice.id === focusId) && <option value={focusId}>Unknown requested activity: {focusId}</option>}
              {choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label} ({choice.id})</option>)}
            </Box>
          </Box>
          {loading && <Typography role='status'>Loading current source context…</Typography>}
          {error && <Alert severity='error' action={<Button color='inherit' disabled={loading} onClick={() => void load()}>Retry context</Button>}>{error}</Alert>}
          {context && (
            <>
              <Box component='section' aria-label='Verified focused activity'>
                <Typography component='h3' variant='h6'>Current context for {nodeLabel(context.focus)}</Typography>
                <NodeEvidence node={context.focus} />
              </Box>
              <Box component='section' aria-label='Generalizations of focused activity'>
                <Typography component='h4' variant='subtitle1'>Generalizations of focused activity ({context.generalizations.length})</Typography>
                <NodeList nodes={context.generalizations} />
              </Box>
              <Box component='section' aria-label='Current activity neighbors'>
                <Typography component='h4' variant='subtitle1'>{range('Specializations', context.specializations)}</Typography>
                <NodeList nodes={context.specializations.items} />
                <Typography component='h4' variant='subtitle1'>{range('Siblings', context.siblings)}</Typography>
                <Typography variant='body2' color='text.secondary'>Siblings share current Generalizations; they are not proposed placements.</Typography>
                <NodeList nodes={context.siblings.items} />
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                  <Button color='inherit' variant='outlined' disabled={loading || context.specializations.offset === 0} onClick={() => setActivityOffset(Math.max(0, context.specializations.offset - context.specializations.limit))}>Previous activity page</Button>
                  <Button color='inherit' variant='outlined' disabled={loading || nextActivity === null} onClick={() => { if (nextActivity !== null) setActivityOffset(nextActivity); }}>Next activity page</Button>
                </Stack>
              </Box>
              <Box component='section' aria-label='Source records for focused activity'>
                <Typography component='h4' variant='subtitle1'>{range('Source records', context.sources)}</Typography>
                <NodeList nodes={context.sources.items} source />
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                  <Button color='inherit' variant='outlined' disabled={loading || context.sources.offset === 0} onClick={() => setSourceOffset(Math.max(0, context.sources.offset - context.sources.limit))}>Previous source page</Button>
                  <Button color='inherit' variant='outlined' disabled={loading || context.sources.nextOffset === null} onClick={() => { if (context.sources.nextOffset !== null) setSourceOffset(context.sources.nextOffset); }}>Next source page</Button>
                </Stack>
              </Box>
              {!!context.limitations.length && <Alert severity='info'><Typography variant='subtitle2'>Limits of this source view</Typography><ul>{context.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></Alert>}
            </>
          )}
        </Stack>
      )}
    </Box>
  );
}
