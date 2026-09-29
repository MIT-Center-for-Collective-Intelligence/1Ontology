"""Offline tests. Set WORDNET_ARCHIVE to run against the pinned local corpus."""

import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from pinned_wordnet import DEFAULT_LOCK, PinnedWordNet, exact_lemma, parse_verb_index


class IndexTests(unittest.TestCase):
    def test_exact_spelling_normalizes_only_case_and_word_separators(self):
        self.assertEqual(exact_lemma("  Give   Up  "), "give_up")
        self.assertEqual(exact_lemma("saw"), "saw")
        self.assertEqual(exact_lemma("sawing"), "sawing")
        for value in (None, "", " \n", 42):
            with self.subTest(value=value), self.assertRaises(ValueError):
                exact_lemma(value)

    def test_reads_every_offset_without_morphology_or_reordering(self):
        index = parse_verb_index(
            "  License/header\n"
            "saw v 1 1 @ 1 0 00012345\n"
            "see v 2 2 @ ~ 2 1 00054321 00022222\n"
        )
        self.assertEqual(index, {"saw": (12345,), "see": (54321, 22222)})

    def test_rejects_missing_duplicate_or_inconsistent_index_entries(self):
        lines = ["", "word n 1 0 1 0 00000001", "word v 2 0 2 0 00000001",
                 "word v 1 0 2 0 00000001", "word v 1 0 1 2 00000001",
                 "word v 2 0 2 0 00000001 00000001",
                 "word v 1 0 1 0 -1", "word v x 0 1 0 00000001",
                 "word v 1 0 1 0 00000001\nword v 1 0 1 0 00000002"]
        for text in lines:
            with self.subTest(text=text), self.assertRaises(ValueError):
                parse_verb_index(text)

    def test_unverified_archive_is_rejected_before_nltk_reader_creation(self):
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "changed.zip"
            archive.write_bytes(b"not the pinned corpus")
            with self.assertRaisesRegex(ValueError, "does not match the corpus lock"):
                PinnedWordNet(archive)


@unittest.skipUnless(os.environ.get("WORDNET_ARCHIVE"), "Set WORDNET_ARCHIVE for corpus integration tests")
class PinnedCorpusTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.archive = Path(os.environ["WORDNET_ARCHIVE"])
        cls.corpus = PinnedWordNet(cls.archive)

    @classmethod
    def tearDownClass(cls):
        cls.corpus.close()

    def test_saw_does_not_expand_to_see(self):
        packet = self.corpus.lookup_exact_verb("saw")
        self.assertEqual([x["id"] for x in packet["candidates"]], ["saw.v.01"])
        self.assertTrue(all("saw" in x["lemmas"] for x in packet["candidates"]))

    def test_inflected_and_unknown_words_do_not_trigger_fallback(self):
        self.assertEqual(self.corpus.lookup_exact_verb("sawing")["candidates"], [])
        self.assertEqual(self.corpus.lookup_exact_verb("not_a_wordnet_verb_zyx")["candidates"], [])

    def test_lowercase_index_preserves_original_lemma_capitalization(self):
        packet = self.corpus.lookup_exact_verb("agenise")
        self.assertTrue(packet["candidates"])
        self.assertTrue(any("Agenise" in item["lemmas"] for item in packet["candidates"]))

    def test_multiword_verbs_retain_all_exact_index_entries(self):
        with zipfile.ZipFile(self.archive) as source:
            # Independent direct read of the corpus index, not the helper parser.
            line = next(line for line in source.read("wordnet/index.verb").decode().splitlines()
                        if line.startswith("give_up v "))
        fields = line.split()
        expected = [int(x) for x in fields[-int(fields[2]):]]
        packet = self.corpus.lookup_exact_verb("Give Up")
        self.assertEqual(packet["candidateOffsets"], expected)
        self.assertEqual([x["offset"] for x in packet["candidates"]], expected)
        self.assertTrue(all("give_up" in x["lemmas"] for x in packet["candidates"]))

    def test_every_exact_verb_index_offset_is_returned_once(self):
        with zipfile.ZipFile(self.archive) as source:
            lines = source.read("wordnet/index.verb").decode().splitlines()
        checked = 0
        for line in lines:
            if not line or line[0].isspace():
                continue
            fields = line.split()
            expected = [int(x) for x in fields[-int(fields[2]):]]
            packet = self.corpus.lookup_exact_verb(fields[0])
            self.assertEqual(packet["candidateOffsets"], expected, fields[0])
            self.assertEqual([x["offset"] for x in packet["candidates"]], expected, fields[0])
            self.assertEqual(len(packet["candidates"]), int(fields[2]), fields[0])
            checked += 1
        self.assertGreater(checked, 10000)

    def test_unrelated_inherited_verb_is_preserved_for_later_judgment(self):
        # The lookup for 'saw' must not silently discard an inherited 'see'.
        requested = ["see.v.01", "saw.v.01", "see.v.01"]
        result = self.corpus.resolve_inherited_verbs(requested)
        self.assertEqual([x["requestedId"] for x in result["inheritedSynsets"]], requested)
        self.assertEqual(len(result["inheritedSynsets"]), 3)

    def test_invalid_inherited_references_fail_without_partial_result(self):
        for ids in (["see.v.01", "missing_zyx.v.01"], ["dog.n.01"], "see.v.01"):
            with self.subTest(ids=ids), self.assertRaises(ValueError):
                self.corpus.resolve_inherited_verbs(ids)

    def test_provenance_matches_verified_bytes_and_is_not_mutable(self):
        packet = self.corpus.lookup_exact_verb("saw")
        self.assertEqual(packet["corpus"]["archiveSha256"], hashlib.sha256(self.archive.read_bytes()).hexdigest())
        self.assertEqual(packet["corpus"]["lockSha256"], hashlib.sha256(DEFAULT_LOCK.read_bytes()).hexdigest())
        self.assertEqual(packet["corpus"]["wordnetVersion"], "3.0")
        packet["corpus"]["wordnetVersion"] = "tampered"
        self.assertEqual(self.corpus.lookup_exact_verb("saw")["corpus"]["wordnetVersion"], "3.0")
        with self.assertRaises(TypeError):
            self.corpus.provenance["wordnetVersion"] = "tampered"

    def test_reader_uses_the_verified_archive_snapshot(self):
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / "wordnet.zip"
            archive.write_bytes(self.archive.read_bytes())
            with PinnedWordNet(archive) as corpus:
                archive.write_bytes(b"replacement after verification")
                self.assertEqual(corpus.lookup_exact_verb("saw")["candidates"][0]["id"], "saw.v.01")
            with self.assertRaisesRegex(ValueError, "closed"):
                corpus.lookup_exact_verb("saw")

    def test_version_mismatches_fail_closed(self):
        import nltk
        with patch.object(nltk, "__version__", "different"):
            with self.assertRaisesRegex(ValueError, "NLTK version"):
                PinnedWordNet(self.archive)
        with tempfile.TemporaryDirectory() as temporary:
            lock = json.loads(DEFAULT_LOCK.read_text())
            lock["wordnetVersion"] = "different"
            lock_path = Path(temporary) / "lock.json"
            lock_path.write_text(json.dumps(lock))
            with self.assertRaisesRegex(ValueError, "WordNet release"):
                PinnedWordNet(self.archive, lock_path)

    def test_does_not_consult_global_corpora_or_download_resources(self):
        with patch("nltk.data.find", side_effect=AssertionError("Global corpus lookup")), \
                patch("nltk.download", side_effect=AssertionError("Corpus download")):
            with PinnedWordNet(self.archive) as corpus:
                self.assertEqual(corpus.lookup_exact_verb("saw")["candidates"][0]["id"], "saw.v.01")
                self.assertEqual(corpus.resolve_inherited_verbs(["see.v.01"])["inheritedSynsets"][0]["id"], "see.v.01")


if __name__ == "__main__":
    unittest.main()
