#!/usr/bin/env bash
set -euo pipefail

# Production is built by the GitHub main Cloud Build trigger, never this checkout.
# Never upload an uncommitted standalone build or delete rollback images.
cat >&2 <<'MESSAGE'
Local production deployment is disabled.
Commit the complete tested change (including required review datasets), push a PR,
and merge it into main. The ontology Cloud Build trigger deploys that exact commit.
See docs/deployment.md for verification and rollback instructions.
MESSAGE
exit 1
