"""Package a five-case, read-only usability pilot from the frozen completed cohort."""
import argparse,collections,hashlib,json,pathlib
parser=argparse.ArgumentParser();parser.add_argument('--source',required=True);parser.add_argument('--prompt',required=True);args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[2]
source=pathlib.Path(args.source);prompt=pathlib.Path(args.prompt)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(source)=='bd06d1dcb000b2ff36b93fde5f960180d36ccfbaa93c487ef0fd12eb5227579e','Frozen source changed; create a reviewed new version instead of overwriting the pilot.'
rows=json.loads(source.read_text());usable=[r for r in rows if r['status']!='Exception']
assert len(rows)==10845 and len(usable)==10820
assert dict(collections.Counter(r['status']for r in usable))=={'Keep':657,'Clarify':9579,'Split':584}
seed='human-title-prepilot-20261015-v1'
selected=[]
for outcome,count in [('Keep',2),('Clarify',2),('Split',1)]:
    selected+=sorted((r for r in usable if r['status']==outcome),key=lambda r:hashlib.sha256((seed+r['nodeId']).encode()).hexdigest())[:count]
selected.sort(key=lambda r:hashlib.sha256((seed+'order'+r['nodeId']).encode()).hexdigest())
cases=[{'id':r['nodeId'],'nodeId':r['nodeId'],'currentTitle':r['originalTitle'],'description':r['description'],'sourceId':r['oNetId'],'outcome':r['status'],'modelTitles':r['proposedTitles'],'modelReason':r['overallReason']}for r in selected]
assert all(len(c['modelTitles'])>=1 and c['description']for c in cases)
value={'version':seed,'cases':cases,'scientificPrompt':prompt.read_text(),'provenance':{
 'purpose':'Five-case staff usability try-out. Not a finalized validation sample or authorization to apply proposals.',
 'selection':'Deterministic hash selection within model-output types: 2 Keep, 2 Clarify, 1 Split. Intentionally unrepresentative proportions.',
 'sourceSha256':sha(source),'scientificPromptSha256':sha(prompt),'model':'gpt-6.1-sol','modelReasoningEffort':'high',
 'fundingRoute':'Native ChatGPT on oneman@mit.edu; user states personally funded allocation. Not ACCESS or MIT-funded inference.',
 'cohort':{'singleDescriptionPopulation':10845,'usable':10820,'excluded':25,'keep':657,'clarify':9579,'split':584},
 'generation':'Retained completed title proposals; no new model inference or ontology change. Original artifacts and reviews remain unchanged.',
 'originalSourceSnapshotSha256':'c67761cfc3bfe00483b98e4d302eda7b6007db8163fe59ea86827e90773cd3b2',
 'fullProposalCsvSha256':'e6aadf45a8032e20d1eb52730362cdcbc1fec1a8f04ce912c566e74c85166a39',
 'preExposure':'Some team members have seen prior outputs. This try-out must not be described as an unbiased, independent accuracy evaluation.'}}
assert value['provenance']['scientificPromptSha256']=='e91ac67ba14a088131acb4d681f4a57a983b6f6e26d7ce655971bc0719f556b4'
out=root/'src/lib/titleValidation/data/prepilot-v1.json';out.parent.mkdir(parents=True,exist_ok=True)
with out.open('x')as f:json.dump(value,f,ensure_ascii=False,indent=2)
print(json.dumps({'path':str(out),'cases':len(cases),'sha256':sha(out),'selectedTitles':[c['currentTitle']for c in cases]}))
