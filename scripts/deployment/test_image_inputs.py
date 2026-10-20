"""Catch missing explicit container inputs before the expensive image build."""
from pathlib import Path, PurePosixPath
import posixpath
import re
import shlex
import unittest

ROOT = Path(__file__).resolve().parents[2]


def verify_review_modules(dockerfile):
    copied = {}
    for line in dockerfile.splitlines():
        if not line.startswith("COPY ") or "--from=" in line:
            continue
        tokens = shlex.split(line)[1:]
        destination = tokens[-1]
        for source in tokens[:-1]:
            if not source.startswith("scripts/som-review/") or not source.endswith(".mjs"):
                continue
            target = PurePosixPath(destination)
            if destination.endswith("/"):
                target = target / PurePosixPath(source).name
            copied[str(target)] = ROOT / source
    commands = " ".join(line for line in dockerfile.splitlines() if line.startswith("RUN node --test "))
    for target, source in copied.items():
        for dependency in re.findall(r'(?:from\s*|import\s*\()["\'](\.[^"\']+\.mjs)["\']', source.read_text()):
            resolved = posixpath.normpath(str(PurePosixPath(target).parent / dependency))
            if resolved not in copied:
                raise ValueError("Container omits module dependency: " + resolved)
        if target.endswith(".test.mjs") and target not in commands:
            raise ValueError("Container omits Node test execution: " + target)


class ReviewImageInputsTests(unittest.TestCase):
    def test_all_review_module_dependencies_and_tests_are_in_the_image(self):
        verify_review_modules((ROOT / "Dockerfile").read_text())

    def test_missing_atomic_dependency_is_caught_before_build(self):
        text = (ROOT / "Dockerfile").read_text()
        text = "\n".join(line for line in text.splitlines() if not line.startswith("COPY scripts/som-review/validate-atomic-relationship-release.mjs "))
        with self.assertRaisesRegex(ValueError, "omits module dependency"):
            verify_review_modules(text)

    def test_copying_a_test_without_running_it_is_rejected(self):
        text = (ROOT / "Dockerfile").read_text()
        text = "\n".join(line.replace(" scripts/som-review/validate-atomic-relationship-release.test.mjs", "") if line.startswith("RUN node --test ") else line for line in text.splitlines())
        with self.assertRaisesRegex(ValueError, "omits Node test execution"):
            verify_review_modules(text)


if __name__ == "__main__":
    unittest.main()
