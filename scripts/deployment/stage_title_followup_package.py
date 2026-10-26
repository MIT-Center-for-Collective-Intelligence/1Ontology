"""Stage an immutable private follow-up package; never overwrite an older package."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
import unicodedata

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / 'src/lib/titleValidation/data/followup-batches-v1.json'


def validate(raw, manifest):
    if len(raw) > 8 * 1024 * 1024 or hashlib.sha256(raw).hexdigest() != manifest['bundleSha256']:
        raise ValueError('Follow-up package hash/size mismatch')
    data = json.loads(raw)
    if data['version'] != manifest['version'] or [b['number'] for b in data['batches']] != [2, 3, 4]:
        raise ValueError('Follow-up package version/batches mismatch')
    seen_anchors, seen_pages = set(), set()
    for batch in data['batches']:
        anchors = batch['anchorCaseIds']
        pages = batch['sources']['pages']
        if len(anchors) != 25 or len(set(anchors)) != 25 or len(pages) != 25:
            raise ValueError('Follow-up batch must contain 25 distinct source pages')
        if seen_anchors.intersection(anchors):
            raise ValueError('Repeated anchor across follow-up batches')
        seen_anchors.update(anchors)
        if set(anchors) != {a for p in pages for a in p['anchorCaseIds']}:
            raise ValueError('Follow-up anchors do not match pages')
        for page in pages:
            if page['id'] in seen_pages:
                raise ValueError('Repeated source page across follow-up batches')
            seen_pages.add(page['id'])
            question_ids, titles = set(), set()
            for activity in page['activities']:
                if activity['supportingDescriptionCount'] != 1 or activity['flagged']:
                    raise ValueError('Ineligible activity in follow-up review')
                for proposal in activity['proposals']:
                    normalized = ' '.join(unicodedata.normalize('NFKC', proposal['title']).casefold().split())
                    if proposal['id'] in question_ids or normalized in titles:
                        raise ValueError('Repeated question/title within source page')
                    question_ids.add(proposal['id']); titles.add(normalized)
        if sum(len(a['proposals']) for p in pages for a in p['activities']) != manifest['questionsByBatch'][str(batch['number'])]:
            raise ValueError('Follow-up question count mismatch')
    return data


def main():
    manifest = json.loads(Path(__file__).with_name('title-followup-package.json').read_text())
    if not re.fullmatch(r'gs://ontology-41607_cloudbuild/quick-title-review/[a-f0-9]{64}\.json', manifest['gcsUri']):
        raise ValueError('Unapproved follow-up storage location')
    if TARGET.exists():
        validate(TARGET.read_bytes(), manifest)
    else:
        with tempfile.TemporaryDirectory() as directory:
            downloaded = Path(directory) / 'package.json'
            subprocess.check_call(['gcloud', 'storage', 'cp', manifest['gcsUri'], str(downloaded), '--quiet'])
            raw = downloaded.read_bytes(); validate(raw, manifest)
            with TARGET.open('xb') as output: output.write(raw)
            TARGET.chmod(0o600)
    print(json.dumps({'titleFollowupPackageStaged': True, 'bundleSha256': manifest['bundleSha256']}))


if __name__ == '__main__': main()
