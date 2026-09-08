import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = fileURLToPath(new URL(".", import.meta.url));
const publicDirectory = resolve(moduleDirectory, "public");
const defaultMoReleaseDirectory = "/usr/local/whizbang-download-site/mo-releases";
const host = process.env.WHIZBANG_DOWNLOAD_SITE_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.WHIZBANG_DOWNLOAD_SITE_PORT ?? "8091", 10);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".dmg": "application/x-apple-diskimage",
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
    if (requestPathname === "/mo" || requestPathname === "/mo/") {
      return "mo/index.html";
    }

    if (!requestPathname.startsWith("/mo/")) {
      return null;
    }

    const moCandidate = normalize(requestPathname.slice("/mo/".length));
    if (!moCandidate || moCandidate === "." || moCandidate.startsWith("..") || moCandidate.includes("\\")) {
      return null;
    }
    return `mo/${moCandidate}`;
  }

  const candidate = normalize(requestPathname.slice("/download/".length));
  if (!candidate || candidate === "." || candidate.startsWith("..") || candidate.includes("\\")) {
    return null;
  }
  return candidate;
}

function isInside(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

function moReleaseAssetPath(requestPathname, releaseDirectory) {
  if (requestPathname === "/mo/release.json") {
    return resolve(releaseDirectory, "current", "release.json");
  }

  const match = requestPathname.match(/^\/mo\/releases\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+\.dmg)$/);
  if (!match) return null;
  return resolve(releaseDirectory, "releases", match[1], match[2]);
}

export function createDownloadSiteServer({
  readAsset = readFile,
  moReleaseDirectory = process.env.MO_PUBLIC_RELEASE_ROOT ?? defaultMoReleaseDirectory,
} = {}) {
  const resolvedMoReleaseDirectory = resolve(moReleaseDirectory);

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

    if (requestURL.pathname === "/mo/health") {
      const body = JSON.stringify({ service: "whizbang-download-site", status: "ok", surface: "mo" });
      response.writeHead(200, responseHeaders("application/json; charset=utf-8", "no-store"));
      response.end(request.method === "HEAD" ? undefined : body);
      return;
    }

    const releaseAssetPath = moReleaseAssetPath(requestURL.pathname, resolvedMoReleaseDirectory);
    if (releaseAssetPath) {
      if (!isInside(resolvedMoReleaseDirectory, releaseAssetPath)) {
        response.writeHead(404, responseHeaders("text/plain; charset=utf-8", "no-store"));
        response.end("Not found\n");
        return;
      }

      try {
        const asset = await readAsset(releaseAssetPath);
        const isDiskImage = extname(releaseAssetPath) === ".dmg";
        const headers = responseHeaders(
          contentTypes[extname(releaseAssetPath)] ?? "application/octet-stream",
          isDiskImage ? "public, max-age=31536000, immutable" : "no-store",
        );
        if (isDiskImage) {
          headers["Content-Disposition"] = `attachment; filename="${releaseAssetPath.split(sep).at(-1)}"`;
        }
        response.writeHead(200, headers);
        response.end(request.method === "HEAD" ? undefined : asset);
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          response.writeHead(404, responseHeaders("text/plain; charset=utf-8", "no-store"));
          response.end("Not found\n");
          return;
        }
        response.writeHead(500, responseHeaders("text/plain; charset=utf-8", "no-store"));
        response.end("Unable to serve Mo release\n");
      }
      return;
    }

    const assetPath = assetPathFor(requestURL.pathname);
    if (!assetPath) {
      response.writeHead(404, responseHeaders("text/plain; charset=utf-8", "no-store"));
      response.end("Not found\n");
      return;
    }

    const resolvedAsset = resolve(publicDirectory, assetPath);
    if (!isInside(publicDirectory, resolvedAsset)) {
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
    console.log(`Whizbang download site listening on http://${host}:${port}/download and /mo`);
  });
}
