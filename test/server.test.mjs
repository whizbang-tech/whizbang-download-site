import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { assetPathFor, createDownloadSiteServer } from "../server.mjs";

test("maps only the intended download paths to public assets", () => {
  assert.equal(assetPathFor("/download"), "index.html");
  assert.equal(assetPathFor("/download/site.css"), "site.css");
  assert.equal(assetPathFor("/other"), null);
  assert.equal(assetPathFor("/download/../../secret"), null);
});

test("serves health without a cache and rejects paths outside download", async () => {
  const server = createDownloadSiteServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  try {
    const health = await fetch(`http://127.0.0.1:${port}/download/health`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("cache-control"), "no-store");
    assert.deepEqual(await health.json(), { service: "whizbang-download-site", status: "ok" });

    const outside = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(outside.status, 404);
  } finally {
    server.close();
    await once(server, "close");
  }
});
