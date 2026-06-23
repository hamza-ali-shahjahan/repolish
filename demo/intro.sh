#!/usr/bin/env bash
# Opening hero card for the demo GIF — the repolish wordmark, tagline, and what it does.
dir="$(cd "$(dirname "$0")/.." && pwd)"
b=$'\e[1m'; c=$'\e[36m'; m=$'\e[35m'; d=$'\e[2m'; r=$'\e[0m'
echo
printf '%s' "$c"
bun run "$dir/bin/repolish.ts" --banner repolish | sed 's/^/  /'
printf '%s' "$r"
echo
echo "  ${m}repo polish in one command${r}"
echo
echo "  Point it at any repo and get:"
echo
echo "    ${b}1.${r} a ${b}premium README draft${r}  ${d}— wordmark, verifiable badges, real quick-start${r}"
echo "    ${b}2.${r} a ${b}no-BS honesty pass${r}   ${d}— flags overclaims the repo can't back up${r}"
echo
echo "  ${d}polish that stays honest.${r}"
echo
