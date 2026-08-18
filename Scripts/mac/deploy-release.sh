#!/bin/zsh
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  print -u2 "Run with sudo: sudo Scripts/mac/deploy-release.sh"
  exit 1
fi

readonly source_root="${0:A:h:h:h}"
readonly site_root="/usr/local/whizbang-download-site"
readonly revision="$(git -C "${source_root}" rev-parse --verify HEAD)"
readonly release_root="${site_root}/releases/${revision}"
readonly current_link="${site_root}/current"
readonly service_label="com.whizbang.download-site"

test -f "${source_root}/server.mjs"
test -d "${source_root}/public"
node --check "${source_root}/server.mjs"
node --check "${source_root}/public/app.js"

if [[ -d "${release_root}" && ( ! -f "${release_root}/server.mjs" || ! -f "${release_root}/package.json" || ! -d "${release_root}/public" ) ]]; then
  incomplete_root="${release_root}.incomplete.$(date +%Y%m%d%H%M%S)"
  mv "${release_root}" "${incomplete_root}"
  print "Quarantined incomplete release at ${incomplete_root}."
fi

if [[ ! -d "${release_root}" ]]; then
  install -d -o root -g wheel -m 0755 "${release_root}"
  ditto "${source_root}/public" "${release_root}/public"
  install -o root -g wheel -m 0644 "${source_root}/server.mjs" "${release_root}/server.mjs"
  install -o root -g wheel -m 0644 "${source_root}/package.json" "${release_root}/package.json"
fi

test -f "${release_root}/server.mjs"
test -f "${release_root}/package.json"
test -d "${release_root}/public"

# macOS mv follows an existing symlink to a directory. Remove the old link
# explicitly so the new link replaces it rather than landing inside its target.
rm -f "${current_link}"
ln -s "${release_root}" "${current_link}"
launchctl kickstart -k "system/${service_label}"

for attempt in {1..20}; do
  if curl --fail --silent --show-error "http://127.0.0.1:8091/download/health" >/dev/null; then
    print "Download site healthy on revision ${revision}."
    exit 0
  fi
  sleep 1
done

print -u2 "Download site did not become healthy; current symlink remains at ${current_link}."
exit 1
