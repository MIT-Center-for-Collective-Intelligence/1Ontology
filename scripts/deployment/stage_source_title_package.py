"""Stage the private source-grouped title package without overwriting evidence."""
import hashlib,json,re,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def validate(raw,manifest):
    if len(raw)>8*1024*1024 or hashlib.sha256(raw).hexdigest()!=manifest['bundleSha256']:
        raise ValueError('Source-page package hash/size mismatch')
    data=json.loads(raw)
    if data['version']!=manifest['version'] or len(data['pages'])!=manifest['pages'] or len({p['id'] for p in data['pages']})!=len(data['pages']):
        raise ValueError('Source-page coverage mismatch')
    if sum(len(p['activities']) for p in data['pages'])!=manifest['activities']:
        raise ValueError('Source-page activity coverage mismatch')
    if sum(not a['proposals'] for p in data['pages'] for a in p['activities'])!=manifest['missingProposals']:
        raise ValueError('Source-page missing-output count mismatch')
def main():
    manifest=json.loads(Path(__file__).with_name('source-title-review-package.json').read_bytes())
    if not re.fullmatch(r'gs://ontology-41607_cloudbuild/quick-title-review/[a-f0-9]{64}\.json',manifest['gcsUri']):
        raise ValueError('Unapproved source-page storage location')
    target=ROOT/'src/lib/titleValidation/data/source-pages-v2.json'
    if target.exists(): validate(target.read_bytes(),manifest)
    else:
        with tempfile.TemporaryDirectory() as directory:
            downloaded=Path(directory)/'package.json'
            subprocess.check_call(['gcloud','storage','cp',manifest['gcsUri'],str(downloaded),'--quiet'])
            raw=downloaded.read_bytes();validate(raw,manifest)
            target.parent.mkdir(parents=True,exist_ok=True)
            with target.open('xb') as output:output.write(raw)
            target.chmod(0o600)
    print(json.dumps({'sourceTitlePackageStaged':True,'version':manifest['version'],'bundleSha256':manifest['bundleSha256']}))
if __name__=='__main__':main()
