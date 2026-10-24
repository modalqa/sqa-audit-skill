#!/usr/bin/env bash
# Local quality and security gate: syntax, tests, dependency audit, and secret scan.
#
# Usage:
#   scripts/check.sh                  full check, including a secret scan of the whole git history
#   scripts/check.sh --staged         fast check for pre-commit: scans only staged changes
#   scripts/check.sh --install-hook   install this script as the git pre-commit hook (--staged mode)

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

MIN_NODE_MAJOR=22
# High-signal credential formats only, to keep false positives near zero.
SECRET_PATTERN='AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{60,}|glpat-[A-Za-z0-9_-]{20}|xox[abprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9_-]{32,}|sk_live_[A-Za-z0-9]{24,}|AIza[0-9A-Za-z_-]{35}|-----BEGIN [A-Z ]*PRIVATE KEY-----'

mode="full"
case "${1:-}" in
  "") ;;
  --staged) mode="staged" ;;
  --install-hook)
    hook="$(git rev-parse --git-path hooks)/pre-commit"
    if [ -e "$hook" ]; then
      echo "A pre-commit hook already exists at $hook; not overwriting it." >&2
      exit 1
    fi
    printf '#!/usr/bin/env bash\nexec "$(git rev-parse --show-toplevel)/scripts/check.sh" --staged\n' > "$hook"
    chmod +x "$hook"
    echo "Installed pre-commit hook at $hook"
    exit 0
    ;;
  *)
    echo "Unknown option: $1" >&2
    sed -n '4,7p' "$0" >&2
    exit 2
    ;;
esac

failures=0
step() { printf '\n==> %s\n' "$1"; }
fail() { echo "FAIL: $1" >&2; failures=$((failures + 1)); }

step "Node.js version"
if ! command -v node >/dev/null 2>&1; then
  fail "node is not installed (need ${MIN_NODE_MAJOR} or later)"
else
  major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$major" -lt "$MIN_NODE_MAJOR" ]; then
    fail "node $(node --version) is older than ${MIN_NODE_MAJOR}"
  else
    echo "node $(node --version)"
  fi
fi

step "JavaScript syntax"
while IFS= read -r file; do
  node --check "$file" || fail "syntax error in $file"
done < <(git ls-files '*.cjs' '*.mjs' '*.js')

step "Tests"
node --test 'skills/**/*.test.cjs' || fail "tests failed"

step "Dependency vulnerabilities"
manifests="$(git ls-files '*package.json' | grep -v node_modules || true)"
audited=0
for manifest in $manifests; do
  if node -e 'const p=require(process.argv[1]);process.exit(Object.keys({...p.dependencies,...p.devDependencies,...p.optionalDependencies}).length?0:1)' "$ROOT/$manifest"; then
    audited=1
    if ! command -v npm >/dev/null 2>&1; then
      fail "npm is required to audit $manifest"
    elif ! (cd "$(dirname "$manifest")" && npm audit --audit-level=high); then
      fail "npm audit reported high or critical vulnerabilities in $manifest"
    fi
  fi
done
[ "$audited" -eq 0 ] && echo "No third-party dependencies declared; nothing to audit."

step "Secret scan ($mode)"
# Report locations only (file:line or commit), never the matched value.
EXCLUDE=':!scripts/check.sh'
if [ "$mode" = "staged" ]; then
  locations="$(git grep --cached -nE "$SECRET_PATTERN" -- . "$EXCLUDE" | cut -d: -f1,2 || true)"
else
  locations="$(git grep -nE "$SECRET_PATTERN" -- . "$EXCLUDE" | cut -d: -f1,2 || true)"
  history="$(git log --all -p --no-color --format='@@COMMIT %h' -- . "$EXCLUDE" \
    | grep -E "^@@COMMIT |$SECRET_PATTERN" \
    | awk '/^@@COMMIT /{commit=$2; next} {print "commit " commit}' | sort -u || true)"
  locations="$(printf '%s\n%s' "$locations" "$history" | sed '/^$/d')"
fi
if [ -n "$locations" ]; then
  echo "$locations" | sed 's/^/  match at /' >&2
  fail "credential-shaped value found. Rotate the credential first, then remove it from the code (and history if committed)."
else
  echo "No credential-shaped values found."
fi

echo
if [ "$failures" -gt 0 ]; then
  echo "check.sh: $failures check(s) failed" >&2
  exit 1
fi
echo "check.sh: all checks passed"
