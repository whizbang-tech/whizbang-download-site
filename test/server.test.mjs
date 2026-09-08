import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assetPathFor, createDownloadSiteServer } from "../server.mjs";

test("maps only the intended Whizbang and Mo paths to public assets", () => {
  assert.equal(assetPathFor("/download"), "index.html");
  assert.equal(assetPathFor("/download/site.css"), "site.css");
  assert.equal(assetPathFor("/mo"), "mo/index.html");
  assert.equal(assetPathFor("/mo/mo.css"), "mo/mo.css");
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

test("serves the Mo page, health, current release metadata, and immutable disk image", async () => {
  const releaseRoot = await mkdtemp(join(tmpdir(), "mo-public-release-"));
  const releaseID = "mo-0.4.0-build-5";
  const releaseDirectory = join(releaseRoot, "releases", releaseID);
  await mkdir(releaseDirectory, { recursive: true });
  await writeFile(join(releaseDirectory, "Mo-0.4.0-5.dmg"), "signed-disk-image");
  await writeFile(join(releaseDirectory, "release.json"), JSON.stringify({
    releaseID,
    version: "0.4.0",
    build: 5,
    downloadURL: `/mo/releases/${releaseID}/Mo-0.4.0-5.dmg`,
  }));
  await mkdir(join(releaseRoot, "current"));
  await writeFile(join(releaseRoot, "current", "release.json"), await readFile(join(releaseDirectory, "release.json")));

  const server = createDownloadSiteServer({ moReleaseDirectory: releaseRoot });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  try {
    const page = await fetch(`http://127.0.0.1:${port}/mo`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /MacMagic/);

    const health = await fetch(`http://127.0.0.1:${port}/mo/health`);
    assert.deepEqual(await health.json(), { service: "whizbang-download-site", status: "ok", surface: "mo" });

    const release = await fetch(`http://127.0.0.1:${port}/mo/release.json`);
    assert.equal(release.headers.get("cache-control"), "no-store");
    assert.equal((await release.json()).releaseID, releaseID);

    const diskImage = await fetch(`http://127.0.0.1:${port}/mo/releases/${releaseID}/Mo-0.4.0-5.dmg`);
    assert.equal(diskImage.status, 200);
    assert.equal(diskImage.headers.get("content-type"), "application/x-apple-diskimage");
    assert.match(diskImage.headers.get("cache-control"), /immutable/);
    assert.match(diskImage.headers.get("content-disposition"), /Mo-0\.4\.0-5\.dmg/);

    const traversal = await fetch(`http://127.0.0.1:${port}/mo/releases/${releaseID}/not-a-dmg.txt`);
    assert.equal(traversal.status, 404);
  } finally {
    server.close();
    await once(server, "close");
    await rm(releaseRoot, { recursive: true, force: true });
  }
});
