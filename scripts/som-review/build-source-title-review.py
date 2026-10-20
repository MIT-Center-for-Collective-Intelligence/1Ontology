"""Join frozen proposals to checked O*NET generalization edges; no inference/writes to DB."""
import argparse, collections, hashlib, json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--delivery', type=Path, required=True)
parser.add_argument('--proposals', type=Path, required=True)
parser.add_argument('--cohort', type=Path, required=True)
parser.add_argument('--graph', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
cohort = json.loads(args.cohort.read_text())
assert sha(args.cohort) == 'bd06d1dcb000b2ff36b93fde5f960180d36ccfbaa93c487ef0fd12eb5227579e'
pins = json.loads((args.cohort.parent/'single-description-counts.json').read_text())['sources']
assert sha(args.delivery) == pins[str(args.delivery)]
assert sha(args.proposals) == pins[str(args.proposals)]
frozen = {c['nodeId']:c for c in map(json.loads,args.delivery.open())}
proposals = {p['case']['nodeId']:p for p in map(json.loads,args.proposals.open())}
original = root/'src/lib/titleValidation/data/quick-v1.json'
sample = json.loads(original.read_text())
by_id = {c['nodeId']:c for c in cohort}
source_ids = {by_id[c['id']]['evidenceNodeId'] for c in sample['cases']}
edges = collections.defaultdict(list)
for c in frozen.values():
    for d in c['descriptions']:
        if d['evidenceNodeId'] in source_ids: edges[d['evidenceNodeId']].append((c,d))
graph = json.loads(args.graph.read_text())
pages = []
for source in sorted(source_ids):
    live = {n['id'] for group in graph[source]['generalizations'] for n in group['nodes']}
    assert live == {c['nodeId'] for c,d in edges[source]}
    assert graph[source]['deleted'] is False
    assert graph[source]['appName'] == 'final-hierarchy-with-o*net'
    assert all(graph[source]['title'] == d['exactSourceTitle'] for c,d in edges[source])
    activities = []
    for c,d in sorted(edges[source],key=lambda cd:(cd[0]['title'].casefold(),cd[0]['nodeId'])):
        p = proposals.get(c['nodeId'])
        if p: assert p['case'] == c
        value = p['exactProposalValue'] if p else None
        groups = [dict(id=f"{c['nodeId']}--{i}", title=g['title'], reason=g['reason'], groupNumber=i+1)
                  for i,g in enumerate(value['groups']) if d['number'] in g['descriptionNumbers']] if value else []
        assert not value or groups
        activities.append(dict(id=c['nodeId'],currentTitle=c['title'],proposals=groups,
            modelReason=value['reason'] if value else '',
            flagged=bool(value and any('human review' in t.casefold() or 'tentative' in t.casefold() for t in [value['reason'],*[g['reason'] for g in value['groups']]])),
            evidenceDescriptionNumber=d['number'], supportingDescriptionCount=len(c['descriptions'])))
    descriptions={d['text'] for c,d in edges[source]}
    assert len(descriptions)==1
    pages.append(dict(id=source,sourceId=edges[source][0][1]['oNetId'],description=next(iter(descriptions)),activities=activities,
        anchorCaseIds=sorted(c['id'] for c in sample['cases'] if by_id[c['id']]['evidenceNodeId']==source)))
data=dict(version='source-title-review-20261020-v2',pages=pages,
    provenance=dict(quickBundleSha256=sha(original),frozenSourceSha256=sha(args.delivery),exactProposalsSha256=sha(args.proposals),sourceGraphSha256=sha(args.graph),
        sourceLinkRule='Exact evidenceNodeId; every direct generalization checked against the production source-node snapshot. Titles joined by original nodeId and original description number, never by text similarity.',
        modelCalls=0, missingProposalRule='Show the linked activity and explicitly report no saved proposal; never invent or rate a nonexistent title.'))
target=root/'src/lib/titleValidation/data/source-pages-v2.json'
with target.open('x') as f:f.write(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
digest=sha(target)
manifest=dict(version=data['version'],pages=len(pages),activities=sum(len(p['activities']) for p in pages),
    missingProposals=sum(not a['proposals'] for p in pages for a in p['activities']),bundleSha256=digest,
    gcsUri=f'gs://ontology-41607_cloudbuild/quick-title-review/{digest}.json')
with (root/'scripts/deployment/source-title-review-package.json').open('x') as f:f.write(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest))
