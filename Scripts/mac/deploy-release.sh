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

if [[ ! -d "${release_root}" ]]; then
  install -d -o root -g wheel -m 0755 "${release_root}"
  ditto "${source_root}/public" "${release_root}/public"
  install -o root -g wheel -m 0644 "${source_root}/server.mjs" "${release_root}/server.mjs"
  install -o root -g wheel -m 0644 "${source_root}/package.json" "${release_root}/package.json"
fi

ln -sfn "${release_root}" "${current_link}.next"
mv -f "${current_link}.next" "${current_link}"
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
