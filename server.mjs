import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = fileURLToPath(new URL(".", import.meta.url));
const publicDirectory = resolve(moduleDirectory, "public");
const host = process.env.WHIZBANG_DOWNLOAD_SITE_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.WHIZBANG_DOWNLOAD_SITE_PORT ?? "8091", 10);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function responseHeaders(contentType, cacheControl = "public, max-age=300") {
  return {
    "Cache-Control": cacheControl,
    "Content-Security-Policy": [
      "default-src 'self'",
      "connect-src 'self' https://api.github.com",
      "img-src 'self' data:",
      "style-src 'self'",
      "script-src 'self'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
    ].join("; "),
    "Content-Type": contentType,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

export function assetPathFor(requestPathname) {
  if (requestPathname === "/download" || requestPathname === "/download/") {
    return "index.html";
  }

  if (!requestPathname.startsWith("/download/")) {
    return null;
  }

  const candidate = normalize(requestPathname.slice("/download/".length));
  if (!candidate || candidate === "." || candidate.startsWith("..") || candidate.includes("\\")) {
    return null;
  }
  return candidate;
}

export function createDownloadSiteServer({ readAsset = readFile } = {}) {
  return createServer(async (request, response) => {
    const requestURL = new URL(request.url ?? "/", "http://localhost");

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, responseHeaders("text/plain; charset=utf-8", "no-store"));
      response.end("Method not allowed\n");
      return;
    }

    if (requestURL.pathname === "/download/health") {
      const body = JSON.stringify({ service: "whizbang-download-site", status: "ok" });
      response.writeHead(200, responseHeaders("application/json; charset=utf-8", "no-store"));
      response.end(request.method === "HEAD" ? undefined : body);
      return;
    }

    const assetPath = assetPathFor(requestURL.pathname);
    if (!assetPath) {
      response.writeHead(404, responseHeaders("text/plain; charset=utf-8", "no-store"));
      response.end("Not found\n");
      return;
    }

    const resolvedAsset = resolve(publicDirectory, assetPath);
    if (!resolvedAsset.startsWith(`${publicDirectory}/`) && resolvedAsset !== publicDirectory) {
      response.writeHead(404, responseHeaders("text/plain; charset=utf-8", "no-store"));
      response.end("Not found\n");
      return;
    }

    try {
      const asset = await readAsset(resolvedAsset);
      const contentType = contentTypes[extname(resolvedAsset)] ?? "application/octet-stream";
      response.writeHead(200, responseHeaders(contentType));
      response.end(request.method === "HEAD" ? undefined : asset);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        response.writeHead(404, responseHeaders("text/plain; charset=utf-8", "no-store"));
        response.end("Not found\n");
        return;
      }
      response.writeHead(500, responseHeaders("text/plain; charset=utf-8", "no-store"));
      response.end("Unable to serve download site\n");
    }
  });
}

// `import.meta.main` survives the `current` release symlink used by launchd.
// Comparing process.argv[1] with import.meta.url does not: Node resolves the
// module to its physical release path while argv preserves the symlink path.
if (import.meta.main) {
  const server = createDownloadSiteServer();
  server.listen(port, host, () => {
    console.log(`Whizbang download site listening on http://${host}:${port}/download`);
  });
}
