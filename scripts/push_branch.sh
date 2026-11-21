#!/usr/bin/env bash
# Commit and push work to a topic branch without touching main.
#
# Usage: scripts/push_branch.sh <branch> "<commit message>" [paths...]
#   <branch>  e.g. feat/master-table. If it doesn't exist yet it is created from
#             the latest origin/main. If a teammate already pushed it, their
#             commits are pulled in first, so nothing of theirs is overwritten.
#   paths     files or folders to commit (default: everything changed).
#
# Refuses to push to main/master, and refuses to commit anything that looks
# like an API token (a .neon_token file or a JWT-shaped string).
set -euo pipefail

usage='usage: scripts/push_branch.sh <branch> "<message>" [paths...]'
branch=${1:?$usage}
msg=${2:?$usage}
shift 2
case "$branch" in
  main | master) echo "Refusing to push to $branch. Use a topic branch." >&2; exit 1 ;;
esac

cd "$(git rev-parse --show-toplevel)"
git fetch --quiet origin

if [ "$(git branch --show-current)" != "$branch" ]; then
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git switch --quiet "$branch"
  elif git show-ref --verify --quiet "refs/remotes/origin/$branch"; then
    git switch --quiet --track "origin/$branch"
  else
    git switch --quiet -c "$branch" origin/main
  fi
fi
if git show-ref --verify --quiet "refs/remotes/origin/$branch"; then
  git pull --quiet --rebase --autostash origin "$branch"
fi

if [ $# -gt 0 ]; then git add -- "$@"; else git add -A; fi
if git diff --cached --quiet; then
  echo "Nothing to commit on $branch."
  exit 0
fi
if git diff --cached --name-only | grep -q 'neon_token' ||
  git diff --cached -U0 | grep -qE '^\+.*eyJ[A-Za-z0-9_-]{20,}\.'; then
  echo "The staged changes look like they contain an API token. Nothing was committed." >&2
  git reset --quiet
  exit 1
fi

git commit --quiet -m "$msg"
git push --quiet -u origin "$branch"
repo=$(git remote get-url origin | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')
echo "Pushed $(git log --oneline -1) to $branch"
echo "Compare or open a PR: https://github.com/$repo/compare/main...$branch"
