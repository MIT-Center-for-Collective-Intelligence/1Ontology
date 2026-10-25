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
    def test_branch_package_is_staged_and_copied_into_both_image_stages(self):
        dockerfile = (ROOT / "Dockerfile").read_text()
        self.assertIn("COPY scripts/deployment/branch-review-package.json ./scripts/deployment/branch-review-package.json", dockerfile)
        self.assertIn("COPY --from=builder /app/scripts/deployment/branch-review-package.json ./scripts/deployment/branch-review-package.json", dockerfile)
        self.assertIn("COPY --from=builder --chown=nextjs:nodejs /app/src/lib/relationshipReview/branch-data ./src/lib/relationshipReview/branch-data", dockerfile)
        cloudbuild = (ROOT / "cloudbuild.yaml").read_text()
        self.assertLess(cloudbuild.index("python3 scripts/deployment/stage_relationship_package.py"),
                        cloudbuild.index("python3 scripts/deployment/stage_branch_package.py"))
        self.assertLess(cloudbuild.index("python3 scripts/deployment/stage_branch_package.py"),
                        cloudbuild.index("docker build -t"))

    def test_cloudbuild_provisions_node_before_private_package_staging(self):
        steps = re.split(r"(?m)^  - name: ", (ROOT / "cloudbuild.yaml").read_text())[1:]
        provision_index = next(i for i, step in enumerate(steps)
                               if step.startswith('"node:18.20.8-bookworm-slim"\n'))
        staging_index = next(i for i, step in enumerate(steps)
                             if "python3 scripts/deployment/stage_relationship_package.py" in step)
        self.assertLess(provision_index, staging_index)
        # Without waitFor overrides, Cloud Build waits for all preceding steps.
        self.assertNotIn("waitFor:", "\n".join(steps[:staging_index + 1]))
        provision = steps[provision_index]
        staging = steps[staging_index]
        for step in (provision, staging):
            self.assertIn("    entrypoint: bash\n", step)
            self.assertIn('      - "-ceu"\n', step)
        mkdir = "mkdir -p /workspace/.cloudbuild-tools/bin"
        copy = "cp /usr/local/bin/node /workspace/.cloudbuild-tools/bin/node"
        self.assertLess(provision.index(mkdir), provision.index(copy))
        self.assertTrue(staging.startswith('"gcr.io/google.com/cloudsdktool/cloud-sdk"\n'))
        # Cloud Build's $$ preserves runtime expansion of the existing SDK PATH.
        export = 'export PATH="/workspace/.cloudbuild-tools/bin:$$PATH"'
        self.assertLess(staging.index(export), staging.index("node --version"))
        for command in (
                "python3 scripts/deployment/stage_relationship_package.py",
                "python3 scripts/deployment/stage_quick_title_package.py",
                "python3 -m unittest discover -s scripts/deployment -p 'test_*.py'"):
            self.assertLess(staging.index("node --version"), staging.index(command))
        self.assertIn(".cloudbuild-tools/", (ROOT / ".dockerignore").read_text().splitlines())

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
