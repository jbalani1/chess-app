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
# eslint exits non-zero on errors and zero on warnings. This repo carries a
# backlog of pre-existing warnings; failing the gate on those would block every
# change forever, so trust the exit code and only surface the errors.
if (cd "$WEB" && npx eslint src > /tmp/agent_lint.log 2>&1); then
  WARN_COUNT="$(grep -ciE '[0-9]+:[0-9]+ +warning' /tmp/agent_lint.log || true)"
  ok "no errors (${WARN_COUNT} pre-existing warnings)"
else
  grep -iE '[0-9]+:[0-9]+ +error' /tmp/agent_lint.log | head -15
  bad "eslint reported errors"
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
# Runs before the production build on purpose: both `next dev` and `next build`
# write to .next, and building underneath a running dev server corrupts it.
# Clear the port first so a stray server from an interactive session cannot
# make the gate fail for the wrong reason.
lsof -ti:3411 2>/dev/null | xargs kill -9 2>/dev/null || true
if (cd "$WEB" && node scripts/smoke.mjs); then
  ok "all pages render cleanly"
else
  bad "one or more pages failed to render"
fi

step "Production build"
if (cd "$WEB" && npm run build > /tmp/agent_build.log 2>&1); then
  ok "next build succeeded"
else
  tail -30 /tmp/agent_build.log
  bad "next build failed"
fi


printf '\n'
if [ "$FAILED" -eq 0 ]; then
  echo "VERIFY: PASS"
else
  echo "VERIFY: FAIL"
fi
exit "$FAILED"
