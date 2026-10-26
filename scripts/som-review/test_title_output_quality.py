import copy
import unittest
import tempfile
import pathlib
import subprocess
import sys
import json
import hashlib
from title_output_quality import audit_pages, assert_no_within_activity_repeats, single_source_pages


def page(*titles):
    return dict(id='source', sourceId='onet', description='Supplied source text',
        activities=[dict(id=str(i),currentTitle=t.split()[0]+' object',supportingDescriptionCount=1,
            proposals=[dict(id=f'{i}--0', title=t)]) for i,t in enumerate(titles)])


class QualityChecks(unittest.TestCase):
    def test_exact_repeats_preserve_ids_and_input(self):
        p=page('Deliver paper proofs', '  DELIVER  paper proofs '); old=copy.deepcopy(p)
        f=audit_pages([p])['findings'];self.assertEqual([x['kind'] for x in f],['exact_title_repeat'])
        self.assertEqual(len(f[0]['proposals']),2);self.assertEqual(p,old)

    def test_distinct_verbs_are_context_not_duplicates(self):
        f=audit_pages([page('Calculate interest errors using computers','Review interest errors using computers')])['findings']
        self.assertEqual([x['kind'] for x in f],['parallel_distinct_verbs'])
        self.assertEqual(f[0]['level'],'context')

    def test_keep_split_types_distinct(self):
        self.assertEqual(audit_pages([page('Deliver advertising proofs for approval','Deliver illustrative proofs for approval')])['findings'],[])

    def test_method_omission_same_verb_and_separate_objects(self):
        f=audit_pages([page('Spread herbicides using hand spreaders','Spread insecticide')])['findings']
        self.assertEqual([x['kind'] for x in f],['parallel_method_wording'])
        self.assertFalse(f[0]['automaticChange'])

    def test_different_verbs_do_not_inherit_tools(self):
        self.assertEqual(audit_pages([page('Mix fertilizer','Spray fertilizer using sprayers')])['findings'],[])

    def test_purpose_for_versus_to_improve(self):
        f=audit_pages([page('Install ducts to improve heating and cooling efficiency','Seal ducts for heating and cooling efficiency')])['findings']
        self.assertIn('parallel_purpose_wording',[x['kind'] for x in f])

    def test_same_title_different_sources_not_duplicate(self):
        a=page('Inspect equipment');b=copy.deepcopy(a);b['id']='other'
        self.assertEqual(audit_pages([a,b])['findings'],[])

    def test_prepositions_are_checked_for_same_and_different_verbs_without_merging(self):
        same = audit_pages([page('Insert wires in molds','Insert wires into molds')])
        self.assertIn('possible_preposition_duplicate',same['counts'])
        parallel = audit_pages([page('Insert wires into molds','Adjust wires in molds')])
        self.assertIn('parallel_preposition_wording',parallel['counts'])
        self.assertTrue(all(not f['automaticChange'] for f in same['findings']+parallel['findings']))
        self.assertEqual(audit_pages([page('Insert wires into molds','Adjust wires into molds')])['counts'],{'parallel_distinct_verbs':1})

    def test_word_order_never_automatically_merged(self):
        f=audit_pages([page('Send report to client','Send client to report')])['findings']
        self.assertEqual(f[0]['kind'],'possible_word_order_duplicate')
        self.assertTrue(f[0]['humanReviewRequired']);self.assertFalse(f[0]['automaticChange'])

    def test_multi_description_excluded_but_new_build_gate_catches_repeat(self):
        p=page('Inspect equipment','Inspect equipment');p['activities'][1]['supportingDescriptionCount']=2
        self.assertEqual(audit_pages([p])['findings'],[])
        p['activities'][0]['proposals'].append(dict(id='extra',title='Inspect equipment'))
        with self.assertRaises(ValueError):assert_no_within_activity_repeats([p])

    def test_missing_input_and_same_source_conflict_fail_closed(self):
        c=dict(nodeId='n', title='Inspect equipment', descriptions=[dict(number=1,text='A',oNetId='1',evidenceNodeId='s')])
        r=dict(case=c,exactProposalValue={'groups':[dict(title='Inspect equipment',descriptionNumbers=[1])]})
        self.assertEqual(single_source_pages([c],[r])[0]['activities'][0]['proposals'][0]['id'],'n--0')
        with self.assertRaises(ValueError):single_source_pages([c],[r,r])
        other=copy.deepcopy(c);other['nodeId']='m';other['descriptions'][0]['text']='B'
        with self.assertRaises(ValueError):single_source_pages([c,other],[r])

    def test_no_semantic_or_cross_record_merging(self):
        self.assertEqual(audit_pages([page('Accept proposal','Reject proposal','Select proposal')])['counts'],{'parallel_distinct_verbs':1})

    def test_stable_findings_order(self):
        a=page('Inspect equipment','INSPECT equipment');b=copy.deepcopy(a);b['id']='b'
        self.assertEqual(audit_pages([a,b]),audit_pages([b,a]))

    def test_cli_pins_and_no_overwrite(self):
        script=pathlib.Path(__file__).with_name('audit-title-output-quality.py')
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory);source=root/'source.json';pins=root/'pins.json';out=root/'out'
            source.write_text(json.dumps({'pages':[page('Inspect equipment')]}))
            pins.write_text(json.dumps({'sources':{str(source.resolve()):hashlib.sha256(source.read_bytes()).hexdigest()}}))
            cmd=[sys.executable,str(script),'--source-pages',str(source),'--pins',str(pins),'--output-dir',str(out)]
            self.assertEqual(subprocess.run(cmd,capture_output=True).returncode,0)
            before=(out/'quality-report.json').read_bytes()
            self.assertNotEqual(subprocess.run(cmd,capture_output=True).returncode,0)
            self.assertEqual((out/'quality-report.json').read_bytes(),before)
            source.write_text('{}');self.assertNotEqual(subprocess.run(cmd,capture_output=True).returncode,0)
            self.assertEqual((out/'quality-report.json').read_bytes(),before)

    def test_omitted_outputs_are_counted_not_invented(self):
        p=page('Inspect equipment');p['activities'][0]['proposals']=[]
        result=audit_pages([p]);self.assertEqual(result['activitiesWithoutProposals'],1)
        self.assertEqual(result['titlesChecked'],0)


if __name__=='__main__': unittest.main()
