#!/bin/zsh
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  print -u2 "Run with sudo: sudo Scripts/mac/configure-cloudflare-ingress.sh"
  exit 1
fi

readonly config_path="/usr/local/etc/cloudflared/config.yml"
readonly backup_path="${config_path}.before-download-site.$(date +%Y%m%d%H%M%S)"
readonly download_marker="# Whizbang public download site (WIZ-1450)."
readonly mo_marker="# Mo public download site."

test -f "${config_path}"
if grep -Fq "${download_marker}" "${config_path}" && grep -Fq "${mo_marker}" "${config_path}"; then
  print "Cloudflare Whizbang and Mo download-site ingress is already configured."
  exit 0
fi

cp -p "${config_path}" "${backup_path}"
tmp_path="$(mktemp "${config_path}.XXXXXX")"
trap 'rm -f "${tmp_path}"' EXIT

awk -v download_marker="${download_marker}" -v mo_marker="${mo_marker}" '
  index($0, download_marker) { has_download = 1 }
  index($0, mo_marker) { has_mo = 1 }
  /^  - service: http_status:404$/ && !inserted {
    if (!has_download) {
      print "  " download_marker
      print "  - hostname: whizbang.quest"
      print "    path: ^/download(?:/.*)?$"
      print "    service: http://127.0.0.1:8091"
      print "    originRequest:"
      print "      httpHostHeader: whizbang.quest"
    }
    if (!has_mo) {
      print "  " mo_marker
      print "  - hostname: whizbang.quest"
      print "    path: ^/mo(?:/.*)?$"
      print "    service: http://127.0.0.1:8091"
      print "    originRequest:"
      print "      httpHostHeader: whizbang.quest"
    }
    inserted = 1
  }
  { print }
  END { if (!inserted) exit 2 }
' "${config_path}" > "${tmp_path}"

cloudflared tunnel --config "${tmp_path}" ingress validate
install -o root -g wheel -m 0644 "${tmp_path}" "${config_path}"
launchctl kickstart -k system/com.cloudflare.cloudflared

print "Configured Cloudflare Tunnel path ingress. Backup: ${backup_path}"
print "Cloudflare WAF/Access still needs narrowly scoped allow rules for /download and /mo if the edge returns 403."
