# Whizbang download site

The public first-install page for Whizbang at `https://whizbang.quest/download`.

## What it does

- serves a small static site from the Mac Studio on `127.0.0.1:8091`;
- is published through a narrow Cloudflare Tunnel path rule;
- asks GitHub's unauthenticated public Releases API for the current Whizbang DMG;
- sends the visitor directly to the immutable GitHub Release asset;
- falls back to the public releases page if GitHub metadata cannot be reached.

GitHub Releases remains the only binary host. This service never receives a release token and never mirrors the DMG.

## Local check

```bash
npm test
npm run check
npm start
curl http://127.0.0.1:8091/download/health
```

## Mac Studio installation

From a checked-out, reviewed release:

```bash
sudo Scripts/mac/install-service.sh
sudo Scripts/mac/deploy-release.sh
sudo Scripts/mac/configure-cloudflare-ingress.sh
Scripts/mac/service-status.sh
```

`configure-cloudflare-ingress.sh` changes only the local tunnel configuration. It writes a timestamped backup and validates the candidate before restarting the tunnel. It intentionally does not edit Cloudflare WAF/Access policy; use a narrowly scoped allow rule for `whizbang.quest/download` only if the Cloudflare edge still returns 403.

## Rollback

Point `/usr/local/whizbang-download-site/current` at a retained release directory and restart `system/com.whizbang.download-site`. Service logs are kept independently at `/Library/Logs/WhizbangDownloadSite`. Do not alter `api.whizbang.quest` or `mail.whizbang.quest` tunnel rules.
