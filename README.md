# Whizbang v3 download site

The Mo-branded first-install page for `https://whizbang.quest/download`. Requires **macOS 27 or later**.

## Static hosting

```sh
npm run check
npm run build
npx wrangler pages deploy dist --project-name whizbang-download-site --branch main
```

`dist/download/` contains the self-contained page and approved Mo assets. `dist/_headers` applies CSP and security headers on Cloudflare Pages; `_redirects` maps the root to `/download/`. Deploy by direct upload, without automatic Git push builds. Configure the Pages custom domain only after reviewing existing whizbang.quest DNS and routes with Marshal. Cloudflare login/account access and DNS/tunnel cutover are separate live actions. API and mail subdomains must remain untouched. Static hosting removes the Mac Studio's availability from the installer path.

No v3 has been published by this source change. Until the `v3-stable` channel exists and passes identity checks, the page shows an unavailable state with a disabled download action. It never falls back to the retired native app.

## Release discovery

The page reads `https://api.github.com/repos/whizbang-tech/whizbang-downloads/releases/tags/v3-stable` without credentials. That release's JSON body records the current verified v3 installer, version/build, minimum OS, bundle identity and SHA-256. Only `tech.whizbang.universal`, versions 3.x.y, builds >=14, macOS 27.0 and an exact immutable GitHub DMG URL are accepted. Release scripts in Whizbang publish these records after signing, notarization and anonymous checksum verification. Binary hosting remains GitHub Releases; the website holds no credentials or installer bytes.

## Local preview

```sh
WHIZBANG_DOWNLOAD_SITE_PORT=18091 npm start
```

Open `http://127.0.0.1:18091/download`. The Node server is a local preview and historical service adapter, not a requirement for Cloudflare Pages. Existing historical Mac service/tunnel scripts remain for rollback reference; do not run them as part of static deployment.

## Brand provenance

`public/brand/` copies the approved Mo color mark, app icon and outlined wordmark from Whizbang `Brand/Whizbang`, source main 69e8012. Colors follow the approved palette: Warm Paper, Plum Ink, Mo Teal and Ember Coral. No system font file is redistributed.
