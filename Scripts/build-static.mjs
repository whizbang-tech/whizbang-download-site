import { cp, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
await mkdir(`${root}/dist/download`, { recursive:true });
await cp(`${root}/public`, `${root}/dist/download`, { recursive:true });
await writeFile(`${root}/dist/_redirects`, "/ /download/ 302\n/download /download/ 301\n");
await writeFile(`${root}/dist/_headers`, `/*
  Content-Security-Policy: default-src 'self'; connect-src 'self' https://api.github.com; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
/download/*
  Cache-Control: public, max-age=300
`);
console.log("Cloudflare Pages output: dist/");
