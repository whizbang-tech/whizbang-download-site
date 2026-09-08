# Whizbang and Mo download site

The public first-install pages for Whizbang and Mo:

- `https://whizbang.quest/download` — Whizbang for Mac
- `https://whizbang.quest/mo` — Mo, MacMagic

## What it does

- serves a small static site from the Mac Studio on `127.0.0.1:8091`;
- is published through a narrow Cloudflare Tunnel path rule;
- asks GitHub's unauthenticated public Releases API for the current Whizbang DMG;
- sends the visitor directly to the immutable GitHub Release asset;
- falls back to the public releases page if GitHub metadata cannot be reached.

Mo uses a different release boundary because its source and release repository are private. The
site service can read only a narrow public bootstrap mirror containing a verified DMG and sanitized
release metadata. It cannot read Mo source, credentials, the private Sparkle feed, or the private
release repository.

GitHub Releases remains the only Whizbang binary host. This service never receives a GitHub release
token. The separate Mo publisher mirrors only the notarized bootstrap DMG selected by an operator.

## Local check

```bash
npm test
npm run check
npm start
curl http://127.0.0.1:8091/download/health
curl http://127.0.0.1:8091/mo/health
```

## Mac Studio installation

From a checked-out, reviewed release:

```bash
sudo Scripts/mac/install-service.sh
sudo Scripts/mac/deploy-release.sh
sudo Scripts/mac/configure-cloudflare-ingress.sh
Scripts/mac/service-status.sh
```

After a corrected Mo release has been signed, notarized, stapled, and installed into the private
release repository, promote that exact immutable generation separately:

```bash
sudo Scripts/mac/publish-mo-bootstrap.sh \
  "/Library/Application Support/MoPlatform/Production/PrivateReleases/releases/<release-id>"
```

The publisher rechecks the release manifest, checksum, byte count, disk image, notarization staple,
and Gatekeeper acceptance before copying only the DMG and sanitized metadata into the public mirror.
Do not publish build 4: it embeds the superseded `api.mo.whizbang.tech` endpoint.

`configure-cloudflare-ingress.sh` changes only the local tunnel configuration. It writes a timestamped backup and validates the candidate before restarting the tunnel. It intentionally does not edit Cloudflare WAF/Access policy; use narrowly scoped allow rules for `whizbang.quest/download` and `whizbang.quest/mo` only if the Cloudflare edge still returns 403.

## Rollback

Point `/usr/local/whizbang-download-site/current` at a retained release directory and restart `system/com.whizbang.download-site`. Service logs are kept independently at `/Library/Logs/WhizbangDownloadSite`. Do not alter `api.whizbang.quest` or `mail.whizbang.quest` tunnel rules.
