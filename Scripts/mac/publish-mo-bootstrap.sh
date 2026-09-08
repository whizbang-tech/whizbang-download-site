#!/bin/zsh
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  print -u2 "Run with sudo: sudo Scripts/mac/publish-mo-bootstrap.sh <Mo private release directory>"
  exit 1
fi

if [[ $# -ne 1 ]]; then
  print -u2 "Usage: sudo Scripts/mac/publish-mo-bootstrap.sh <Mo private release directory>"
  exit 1
fi

readonly source_release="${1:A}"
readonly source_manifest="${source_release}/release-manifest.json"
readonly public_root="/usr/local/whizbang-download-site/mo-releases"

test -d "${source_release}"
test -f "${source_manifest}"

metadata="$(node - "${source_manifest}" <<'NODE'
const { readFileSync } = require("node:fs");
const manifest = JSON.parse(readFileSync(process.argv[2], "utf8"));
const dmgNames = Object.keys(manifest.artifacts ?? {}).filter((name) => name.endsWith(".dmg"));
if (manifest.schemaVersion !== 1 || dmgNames.length !== 1) throw new Error("manifest must contain exactly one DMG");
if (manifest.verification?.developerID?.verified !== true) throw new Error("Developer ID verification is missing");
if (manifest.verification?.gatekeeper !== "accepted") throw new Error("Gatekeeper verification is missing");
if (manifest.verification?.stapling !== "validated") throw new Error("stapling verification is missing");
const dmgName = dmgNames[0];
const artifact = manifest.artifacts[dmgName];
const values = [manifest.releaseID, manifest.version, manifest.build, dmgName, artifact.sha256, artifact.bytes];
if (values.some((value) => value === undefined || value === null || String(value).includes("\t"))) throw new Error("manifest metadata is incomplete");
if (!/^[A-Za-z0-9._-]+$/.test(manifest.releaseID)) throw new Error("release ID is unsafe");
if (!/^[A-Za-z0-9._-]+\.dmg$/.test(dmgName)) throw new Error("DMG name is unsafe");
if (!Number.isInteger(manifest.build) || manifest.build < 1) throw new Error("build is invalid");
if (!Number.isInteger(artifact.bytes) || artifact.bytes < 1) throw new Error("artifact byte count is invalid");
if (!/^[0-9a-f]{64}$/.test(artifact.sha256)) throw new Error("artifact checksum is invalid");
process.stdout.write(values.join("\t"));
NODE
)"

IFS=$'\t' read -r release_id version build dmg_name expected_sha expected_bytes <<< "${metadata}"

readonly source_dmg="${source_release}/${dmg_name}"
readonly target_release="${public_root}/releases/${release_id}"
readonly target_dmg="${target_release}/${dmg_name}"
readonly target_metadata="${target_release}/release.json"

test -f "${source_dmg}"
actual_sha="$(shasum -a 256 "${source_dmg}" | awk '{print $1}')"
actual_bytes="$(stat -f '%z' "${source_dmg}")"
[[ "${actual_sha}" == "${expected_sha}" ]]
[[ "${actual_bytes}" == "${expected_bytes}" ]]

hdiutil verify "${source_dmg}" >/dev/null
xcrun stapler validate "${source_dmg}" >/dev/null
spctl --assess --type open --context context:primary-signature --verbose=2 "${source_dmg}" >/dev/null

install -d -o root -g wheel -m 0755 "${public_root}/releases"
if [[ -e "${target_release}" ]]; then
  existing_sha="$(shasum -a 256 "${target_dmg}" 2>/dev/null | awk '{print $1}')"
  [[ "${existing_sha}" == "${expected_sha}" ]] || {
    print -u2 "Refusing to overwrite immutable public release ${release_id}."
    exit 1
  }
else
  install -d -o root -g wheel -m 0755 "${target_release}"
  install -o root -g wheel -m 0644 "${source_dmg}" "${target_dmg}"
fi

node - "${target_metadata}" "${release_id}" "${version}" "${build}" "${dmg_name}" "${expected_sha}" "${expected_bytes}" <<'NODE'
const { writeFileSync } = require("node:fs");
const [output, releaseID, version, rawBuild, dmgName, sha256, rawBytes] = process.argv.slice(2);
const metadata = {
  schemaVersion: 1,
  releaseID,
  version,
  build: Number(rawBuild),
  bytes: Number(rawBytes),
  sha256,
  downloadURL: `/mo/releases/${releaseID}/${dmgName}`,
};
writeFileSync(output, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o644 });
NODE
chown root:wheel "${target_metadata}"
chmod 0644 "${target_metadata}"

next_link="${public_root}/current.next.$$"
ln -s "releases/${release_id}" "${next_link}"
rm -f "${public_root}/current"
mv "${next_link}" "${public_root}/current"

print "Published notarized Mo ${version} build ${build} as the public bootstrap release."
print "Public metadata: /mo/release.json"
print "Public DMG: /mo/releases/${release_id}/${dmg_name}"
