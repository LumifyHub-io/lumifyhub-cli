#!/usr/bin/env bash
# Publish lumifyhub-cli to npm as the `lumifyhub` npm account, then tag and push.
#
#   npm run release            # publish the version already in package.json
#   npm run release -- 0.7.0   # bump to 0.7.0, commit "Release 0.7.0", publish
#   NPM_OTP=123456 npm run release   # if the token can't bypass the account's 2FA
#
# The package is owned by the `lumifyhub` npm account, not saadnvd1. The token
# comes from tokenvault (`npm` / "lumifyhub publish token") and is only ever
# written to a temp npmrc that is deleted on exit.
set -euo pipefail
cd "$(dirname "$0")/.."

NPM_ACCOUNT=lumifyhub
TV_DESC="lumifyhub publish token"
name=$(node -p "require('./package.json').name")

die() { echo "release: $*" >&2; exit 1; }

[ -z "$(git status --porcelain)" ] || die "working tree is not clean"
[ "$(git branch --show-current)" = main ] || die "not on main"
git fetch -q origin main
[ -z "$(git log --oneline HEAD..origin/main)" ] || die "behind origin/main; pull first"

if [ $# -gt 0 ]; then
  npm version "$1" --no-git-tag-version >/dev/null
  git commit -qam "Release $1"
fi
version=$(node -p "require('./package.json').version")

if npm view "$name@$version" version >/dev/null 2>&1; then
  die "$name@$version is already on npm; pass a new version"
fi

npm run -s typecheck
npm test
npm run -s build

rc=$(mktemp)
trap 'rm -f "$rc"' EXIT
token=$(tv get npm "$TV_DESC") || die "no tokenvault entry: npm / $TV_DESC"
printf '//registry.npmjs.org/:_authToken=%s\n' "$token" > "$rc"
unset token

who=$(npm whoami --userconfig "$rc" 2>/dev/null) || die "the $TV_DESC token is rejected by npm"
[ "$who" = "$NPM_ACCOUNT" ] || die "token is for '$who', expected '$NPM_ACCOUNT'"

otp=()
[ -n "${NPM_OTP:-}" ] && otp=(--otp "$NPM_OTP")
if ! npm publish --userconfig "$rc" "${otp[@]}"; then
  die "publish failed. A 2FA error means the token must be a granular access token
  with 'Bypass two-factor authentication' on (npmjs.com, $NPM_ACCOUNT account), or rerun
  with NPM_OTP=<6-digit code> npm run release"
fi
[ "$(npm view "$name" version)" = "$version" ] || echo "release: warning, npm does not show $version yet" >&2

git tag -a "v$version" -m "v$version"
git push -q origin main "v$version"
echo "Published $name@$version as $NPM_ACCOUNT, tagged v$version"
