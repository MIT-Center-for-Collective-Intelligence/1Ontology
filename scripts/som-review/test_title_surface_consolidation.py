import copy
import unittest
from title_output_quality import consolidate_surface_duplicates


class SurfaceConsolidationTests(unittest.TestCase):
    def fixture(self):
        return [dict(id='source-a',activities=[
            dict(id='a',currentTitle='Monitor Application',proposals=[dict(id='a--0',title='Monitor email applications')]),
            dict(id='b',currentTitle='Monitor Software',proposals=[dict(id='b--0',title='  Monitor EMAIL applications ')]),
            dict(id='c',currentTitle='Review Software',proposals=[dict(id='c--0',title='Review email applications')]),
        ])]

    def test_exact_surface_repeat_becomes_one_question_with_all_original_ids(self):
        original=self.fixture();before=copy.deepcopy(original)
        pages,decisions=consolidate_surface_duplicates(original)
        self.assertEqual(original,before)
        self.assertEqual(len(decisions),1)
        primary=pages[0]['activities'][0]['proposals'][0]
        self.assertEqual(primary['sourceProposalIds'],['a--0','b--0'])
        self.assertEqual(primary['sourceActivityIds'],['a','b'])
        self.assertEqual(pages[0]['activities'][1]['representedByProposalId'],'a--0')
        self.assertEqual(pages[0]['activities'][2]['proposals'][0]['title'],'Review email applications')
        self.assertFalse(decisions[0]['ontologyMerge'])

    def test_preposition_difference_and_distinct_sources_are_not_auto_merged(self):
        pages=[dict(id='source-a',activities=[dict(id='a',currentTitle='Insert Wire',proposals=[dict(id='a--0',title='Insert wire in mold'),dict(id='a--1',title='Insert wire into mold')])]),
               dict(id='source-b',activities=[dict(id='b',currentTitle='Insert Wire',proposals=[dict(id='b--0',title='Insert wire in mold')])])]
        output,decisions=consolidate_surface_duplicates(pages)
        self.assertEqual(output,pages)
        self.assertEqual(decisions,[])


if __name__=='__main__':unittest.main()
