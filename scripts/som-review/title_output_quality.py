"""Read-only lexical checks, not a semantic judge or an ontology editor.

Compare proposals only within the SAME source record. Different verbs and
different evidence records are never silently merged. Original text/IDs survive.
"""
import collections
import hashlib
import json
import re
import unicodedata

VERSION = 'title-output-quality-v1'


def normalized_title(text):
    return ' '.join(unicodedata.normalize('NFKC', text).casefold().split())


def tokens(text):
    return re.findall(r"[^\W_]+(?:['’][^\W_]+)?", normalized_title(text))


def _clause(text, markers):
    match = re.search(r'\b(' + '|'.join(markers) + r')\b\s+(.+)', text, re.I)
    return normalized_title(match.group(0)) if match else ''


def audit_pages(pages, single_description_only=True):
    findings, activity_ids, with_proposals = [], set(), set()
    question_count = page_count = 0
    for page in sorted(pages, key=lambda p: p['id']):
        entries = []
        for a in page['activities']:
            if single_description_only and a['supportingDescriptionCount'] != 1:
                continue
            activity_ids.add(a['id'])
            if a['proposals']:
                with_proposals.add(a['id'])
            for p in a['proposals']:
                entries.append(dict(proposalId=p['id'], activityId=a['id'],
                    originalTitle=a['currentTitle'], title=p['title']))
        if not entries:
            continue
        page_count += 1
        question_count += len(entries)

        def add(kind, rows, explanation, level='candidate'):
            rows = sorted(rows, key=lambda r: r['proposalId'])
            identity = [VERSION, page['id'], kind, [r['proposalId'] for r in rows]]
            findings.append(dict(id=hashlib.sha256(json.dumps(identity).encode()).hexdigest(),
                kind=kind, level=level, sourcePageId=page['id'],
                sourceId=page.get('sourceId', ''), description=page['description'],
                proposals=rows, explanation=explanation,
                humanReviewRequired=True, automaticChange=False))

        exact, word_order, parallel = collections.defaultdict(list), collections.defaultdict(list), collections.defaultdict(list)
        by_verb = collections.defaultdict(list)
        for e in entries:
            t = tokens(e['title'])
            exact[normalized_title(e['title'])].append(e)
            if t:
                # Keep the leading verb and word multiplicities. Similarity is
                # only a screening flag: word order can change the meaning.
                word_order[(t[0], tuple(sorted(t[1:])))].append(e)
                parallel[normalized_title(e['title']).split(' ', 1)[-1]].append(e)
                by_verb[t[0]].append(e)
        for rows in exact.values():
            if len(rows) > 1:
                add('exact_title_repeat', rows,
                    'The same displayed title occurs more than once for this source. Check the activity IDs and evidence before any consolidation.', 'exact')
        for rows in word_order.values():
            if len({normalized_title(r['title']) for r in rows}) > 1:
                add('possible_word_order_duplicate', rows,
                    'Same leading verb and words in a different order. Check meaning; this is not proof of duplication.')
        for rows in parallel.values():
            if len({tokens(r['title'])[0] for r in rows}) > 1:
                add('parallel_distinct_verbs', rows,
                    'The remaining wording matches but the leading verbs differ. Preserve the actions separately unless an expert explicitly decides otherwise.', 'context')
        for rows in by_verb.values():
            if len({r['activityId'] for r in rows}) < 2:
                continue
            clauses = [_clause(r['title'], ['using', 'with', 'by', 'through']) for r in rows]
            if any(clauses) and len(set(clauses)) > 1:
                add('parallel_method_wording', rows,
                    'Titles with the same verb differ in whether or how they state a method. Check which source details apply to EACH activity; do not copy equipment to a different activity automatically.')
        purposes = [(r, _clause(r['title'], ['to', 'for'])) for r in entries]
        # Different verbs may legitimately share a purpose. Flag wording variants
        # only when the visible purpose clauses share at least three words.
        variants = collections.defaultdict(list)
        for r, clause in purposes:
            if clause:
                variants[clause].append(r)
        variant_items = sorted(variants.items())
        for i, (left, left_rows) in enumerate(variant_items):
            for right, right_rows in variant_items[i+1:]:
                # Ignore the purpose introducer (to/for), while retaining
                # meaningful words such as improve, prevent, and NOT.
                l, r = set(tokens(left)[1:]), set(tokens(right)[1:])
                if len(l & r) >= 3 and len(l & r) / len(l | r) >= .6:
                    add('parallel_purpose_wording', left_rows + right_rows,
                        'Similar purpose clauses use different wording. Check whether a common, source-supported phrasing would retain the meaning. No replacement is generated by this check.')
    return dict(version=VERSION,
        scope='single-description' if single_description_only else 'all-linked',
        pagesChecked=page_count, activitiesChecked=len(activity_ids), titlesChecked=question_count,
        activitiesWithProposals=len(with_proposals),
        activitiesWithoutProposals=len(activity_ids - with_proposals),
        counts=dict(sorted(collections.Counter(f['kind'] for f in findings).items())),
        interpretation='Exact repeats are surface-text matches. All other findings are lexical screening candidates, not semantic errors or accuracy estimates. Different verbs remain distinct. No proposals, reviews, timing, or ontology records are changed.',
        findings=findings)


def assert_no_within_activity_repeats(pages):
    """Fail a NEW package build on duplicate display titles within an activity."""
    report = audit_pages(pages, single_description_only=False)
    for f in report['findings']:
        if f['kind'] == 'exact_title_repeat':
            ids = [r['activityId'] for r in f['proposals']]
            if len(ids) != len(set(ids)):
                raise ValueError('Repeated title within an activity: ' + f['sourcePageId'])
    return report


def single_source_pages(frozen_cases, saved_proposals):
    """Join by original nodeId/evidenceNodeId, never by similar source text."""
    proposal_map = {}
    for r in saved_proposals:
        node_id = r['case']['nodeId']
        if node_id in proposal_map:
            raise ValueError('Duplicate saved case: ' + node_id)
        proposal_map[node_id] = r
    pages = {}
    for case in frozen_cases:
        if len(case['descriptions']) != 1:
            continue
        d = case['descriptions'][0]
        page = pages.setdefault(d['evidenceNodeId'], dict(id=d['evidenceNodeId'],
            sourceId=d['oNetId'], description=d['text'], activities=[]))
        if page['description'] != d['text']:
            raise ValueError('Conflicting text for an evidenceNodeId')
        saved = proposal_map.get(case['nodeId'])
        if saved and saved['case'] != case:
            raise ValueError('Saved proposal source differs: ' + case['nodeId'])
        groups = saved['exactProposalValue']['groups'] if saved else []
        proposals = []
        for i, group in enumerate(groups):
            if d['number'] not in group['descriptionNumbers']:
                raise ValueError('Single-source group does not cover its source')
            proposals.append(dict(id=f"{case['nodeId']}--{i}", title=group['title']))
        page['activities'].append(dict(id=case['nodeId'], currentTitle=case['title'],
            supportingDescriptionCount=1, proposals=proposals))
    return list(pages.values())
