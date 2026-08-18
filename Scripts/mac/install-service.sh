#!/bin/zsh
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  print -u2 "Run with sudo: sudo Scripts/mac/install-service.sh"
  exit 1
fi

readonly service_user="_whizbang_download"
readonly site_root="/usr/local/whizbang-download-site"
readonly log_root="/Library/Logs/Whizbang/download-site"
readonly plist_path="/Library/LaunchDaemons/com.whizbang.download-site.plist"
readonly source_root="${0:A:h:h:h}"

if ! dscl . -read "/Users/${service_user}" >/dev/null 2>&1; then
  readonly uid="349"
  # dscl returns success even when a search has no rows, so inspect its output
  # rather than its exit status before claiming the dedicated UID is occupied.
  existing_uid_user="$(dscl . -search /Users UniqueID "${uid}" 2>/dev/null || true)"
  if [[ -n "${existing_uid_user}" ]]; then
    print -u2 "Refusing to create ${service_user}: UID ${uid} is already in use. Choose a new dedicated service UID."
    exit 1
  fi
  dscl . -create "/Users/${service_user}"
  dscl . -create "/Users/${service_user}" RealName "Whizbang Download Site"
  dscl . -create "/Users/${service_user}" UniqueID "${uid}"
  dscl . -create "/Users/${service_user}" PrimaryGroupID 20
  dscl . -create "/Users/${service_user}" NFSHomeDirectory /var/empty
  dscl . -create "/Users/${service_user}" UserShell /usr/bin/false
  dscl . -create "/Users/${service_user}" IsHidden 1
  # A launchd-only account with /usr/bin/false needs no usable password.
  # Avoid `dscl -passwd '*': recent macOS releases reject that placeholder
  # under the local password-quality policy.
fi

install -d -o root -g wheel -m 0755 "${site_root}/releases"
install -d -o "${service_user}" -g staff -m 0750 "${log_root}"
install -o root -g wheel -m 0644 "${source_root}/deploy/com.whizbang.download-site.plist" "${plist_path}"
plutil -lint "${plist_path}"

print "Installed service account and LaunchDaemon. Deploy a release next with:"
print "  sudo ${source_root}/Scripts/mac/deploy-release.sh"
