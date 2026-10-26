import copy
import hashlib
import json
from pathlib import Path
import unittest
from stage_title_followup_package import validate


class FollowupStagingTests(unittest.TestCase):
    def setUp(self):
        root=Path(__file__).resolve().parents[2]
        self.raw=(root/'src/lib/titleValidation/data/followup-batches-v1.json').read_bytes()
        self.manifest=json.loads(Path(__file__).with_name('title-followup-package.json').read_bytes())

    def test_exact_package_and_hash_rejection(self):
        validate(self.raw,self.manifest)
        with self.assertRaises(ValueError):validate(self.raw+b' ',self.manifest)

    def test_no_repeated_pages_flagged_or_multiple_description_activities(self):
        for mutation in ['page','flagged','multiple','repeat_title','count']:
            data=json.loads(self.raw)
            first=data['batches'][0]['sources']['pages'][0]
            if mutation=='page':data['batches'][1]['sources']['pages'][0]['id']=first['id']
            elif mutation=='flagged':first['activities'][0]['flagged']=True
            elif mutation=='multiple':first['activities'][0]['supportingDescriptionCount']=2
            elif mutation=='repeat_title':first['activities'][0]['proposals'].append(copy.deepcopy(first['activities'][0]['proposals'][0]))
            else:data['batches'][0]['anchorCaseIds'].pop()
            raw=json.dumps(data).encode();manifest={**self.manifest,'bundleSha256':hashlib.sha256(raw).hexdigest()}
            with self.subTest(mutation=mutation),self.assertRaises(ValueError):validate(raw,manifest)


if __name__=='__main__':unittest.main()
