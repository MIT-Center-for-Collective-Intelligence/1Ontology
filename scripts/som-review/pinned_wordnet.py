"""Exact English verb lookup from a verified local corpus; no network or model calls.

This is an offline building block, not a WordNet alignment runner. The caller
must supply the verb explicitly; this module never infers it from a title.
"""

import hashlib
import io
import json
from pathlib import Path
import re
from types import MappingProxyType
import zipfile


DEFAULT_LOCK = Path(__file__).with_name("wordnet-corpus-lock.json")


def exact_lemma(verb):
    """Normalize case/word separators only, without stemming or synonyms."""
    if not isinstance(verb, str) or not verb.strip():
        raise ValueError("An explicit nonempty verb is required")
    return "_".join(verb.strip().lower().split())


def parse_verb_index(text):
    """Read every listed offset for each exact lemma in WordNet index.verb."""
    index = {}
    for line in text.splitlines():
        if not line or line[0].isspace():
            continue  # WordNet's license/header lines start with whitespace.
        fields = line.split()
        if len(fields) < 6 or fields[1] != "v":
            raise ValueError("Malformed WordNet verb index entry")
        lemma = fields[0]
        try:
            count, pointers = int(fields[2]), int(fields[3])
            offset_start = 6 + pointers
            if count < 1 or pointers < 0 or len(fields) != offset_start + count:
                raise ValueError("Invalid index field count")
            sense_count, tagged_count = map(int, fields[4 + pointers:6 + pointers])
            offsets = tuple(int(value) for value in fields[offset_start:])
        except (ValueError, IndexError) as exc:
            raise ValueError("Malformed WordNet verb index entry: " + lemma) from exc
        if (sense_count != count or not 0 <= tagged_count <= count
                or any(offset < 0 for offset in offsets)
                or len(set(offsets)) != count or lemma in index):
            raise ValueError("Inconsistent WordNet verb index entry: " + lemma)
        index[lemma] = offsets
    if not index:
        raise ValueError("The local WordNet verb index is empty")
    return index


class PinnedWordNet:
    """Own an immutable in-memory copy of the verified English corpus archive."""

    def __init__(self, archive, lock_path=DEFAULT_LOCK):
        lock_bytes = Path(lock_path).read_bytes()
        lock = json.loads(lock_bytes.decode("utf-8"))
        if (lock.get("schemaVersion") != "wordnet-corpus-lock-v1"
                or lock.get("archiveRoot") != "wordnet/"
                or not re.fullmatch(r"[a-f0-9]{64}", lock.get("archiveSha256", ""))
                or not lock.get("wordnetVersion") or not lock.get("nltkVersion")):
            raise ValueError("Invalid WordNet corpus lock")
        # Read once, then use these same bytes. Replacing the file after this
        # check cannot substitute an unverified corpus into an open reader.
        data = Path(archive).read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        if digest != lock["archiveSha256"]:
            raise ValueError("Local WordNet archive does not match the corpus lock")

        import nltk
        from nltk.corpus.reader.wordnet import WordNetCorpusReader
        from nltk.data import ZipFilePathPointer

        class EnglishArchiveReader(WordNetCorpusReader):
            def map_wn(self, version="wordnet"):
                # NLTK initializes an OMW cross-version map through its global
                # corpus loader even with an explicit root. English-only reads
                # need no multilingual mapping or second corpus.
                return None

        if nltk.__version__ != lock["nltkVersion"]:
            raise ValueError("Installed NLTK version does not match the corpus lock")
        self._zip = zipfile.ZipFile(io.BytesIO(data))
        self._closed = False
        try:
            self._index = parse_verb_index(
                self._zip.read(lock["archiveRoot"] + "index.verb").decode("utf-8")
            )
            self._reader = EnglishArchiveReader(
                ZipFilePathPointer(self._zip, lock["archiveRoot"]), None
            )
            if self._reader.get_version() != lock["wordnetVersion"]:
                raise ValueError("WordNet release does not match the corpus lock")
        except Exception:
            self.close()
            raise
        self.provenance = MappingProxyType({
            "wordnetVersion": lock["wordnetVersion"],
            "nltkVersion": lock["nltkVersion"],
            "archiveSha256": digest,
            "indexVerbSha256": hashlib.sha256(
                self._zip.read(lock["archiveRoot"] + "index.verb")
            ).hexdigest(),
            "lockSha256": hashlib.sha256(lock_bytes).hexdigest(),
        })

    def _require_open(self):
        if self._closed:
            raise ValueError("The pinned WordNet reader is closed")

    @staticmethod
    def _detail(synset):
        return {
            "id": synset.name(),
            "offset": synset.offset(),
            "pos": synset.pos(),
            "definition": synset.definition(),
            "lemmas": sorted(synset.lemma_names()),
            "examples": list(synset.examples()),
        }

    def lookup_exact_verb(self, verb):
        self._require_open()
        lemma = exact_lemma(verb)
        # Bypass synsets(), which expands inflections through _morphy(). For
        # example, synsets('saw', pos='v') also returns senses of 'see'.
        offsets = self._index.get(lemma, ())
        records = []
        for offset in offsets:
            synset = self._reader.synset_from_pos_and_offset("v", offset)
            if lemma not in {exact_lemma(name) for name in synset.lemma_names()}:
                raise ValueError("Corpus index/data disagreement for verb " + lemma)
            records.append(self._detail(synset))
        return {
            "schemaVersion": "wordnet-exact-verb-lookup-v1",
            "requestedVerb": verb,
            "exactLemma": lemma,
            "corpus": dict(self.provenance),
            "candidateOffsets": list(offsets),
            "candidates": records,
        }

    def resolve_inherited_verbs(self, synset_ids):
        """Preserve all inherited verb IDs, even when their lemmas differ.

        Suitability is a later judgment. Invalid references fail explicitly;
        they are not dropped or replaced with a nearby sense.
        """
        self._require_open()
        if not isinstance(synset_ids, (list, tuple)):
            raise ValueError("Inherited synset IDs must be an ordered list")
        records = []
        for requested_id in synset_ids:
            if not isinstance(requested_id, str) or not re.fullmatch(
                    r".+\.v\.[0-9]+", requested_id):
                raise ValueError("An inherited WordNet verb synset ID is required")
            try:
                synset = self._reader.synset(requested_id)
            except Exception as exc:
                raise ValueError("Unresolved inherited WordNet ID: " + requested_id) from exc
            records.append({"requestedId": requested_id, **self._detail(synset)})
        return {"corpus": dict(self.provenance), "inheritedSynsets": records}

    def close(self):
        self._zip.close()
        self._closed = True

    def __enter__(self):
        self._require_open()
        return self

    def __exit__(self, *_args):
        self.close()
