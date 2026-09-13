#!/bin/bash
#
# The gate every autonomous change must pass before a PR is opened.
#
# Exits non-zero on the first failure, and the daily agent treats that as
# "throw the branch away". Run it by hand any time: scripts/verify.sh
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$REPO/web"
WORKER="$REPO/worker"
FAILED=0

step() { printf '\n=== %s\n' "$1"; }
ok()   { printf '  PASS  %s\n' "$1"; }
bad()  { printf '  FAIL  %s\n' "$1"; FAILED=1; }

step "TypeScript"
if (cd "$WEB" && ./node_modules/.bin/tsc --noEmit 2>&1 | tail -20); then
  ok "no type errors"
else
  bad "tsc reported errors"
fi

step "ESLint"
LINT_OUT="$(cd "$WEB" && npx eslint src 2>&1)"
if [ -z "$LINT_OUT" ]; then
  ok "clean"
else
  echo "$LINT_OUT" | tail -25
  bad "eslint reported problems"
fi

step "Production build"
if (cd "$WEB" && npm run build > /tmp/agent_build.log 2>&1); then
  ok "next build succeeded"
else
  tail -30 /tmp/agent_build.log
  bad "next build failed"
fi

step "Python syntax"
PY="$WORKER/venv/bin/python"
if [ -x "$PY" ]; then
  SYNTAX_ERR=0
  for f in "$WORKER"/*.py; do
    "$PY" -c "import ast,sys; ast.parse(open(sys.argv[1]).read())" "$f" 2>/dev/null \
      || { echo "  syntax error: $(basename "$f")"; SYNTAX_ERR=1; }
  done
  [ "$SYNTAX_ERR" -eq 0 ] && ok "all worker scripts parse" || bad "worker syntax errors"
else
  echo "  (skipped — no venv)"
fi

# Smoke test: every page must render without a page error or a failing API call.
# This is the check that catches the things type-checking cannot, and it is why
# the broken /openings and /positions routes were found.
step "Page smoke test"
if (cd "$WEB" && node scripts/smoke.mjs); then
  ok "all pages render cleanly"
else
  bad "one or more pages failed to render"
fi

printf '\n'
if [ "$FAILED" -eq 0 ]; then
  echo "VERIFY: PASS"
else
  echo "VERIFY: FAIL"
fi
exit "$FAILED"
