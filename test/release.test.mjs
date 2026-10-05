import assert from "node:assert/strict";
import test from "node:test";
import { channelRelease } from "../public/release.js";
const metadata = { version:"3.0.0", build:14, minimumSystemVersion:"27.0", bundleIdentifier:"tech.whizbang.universal", sha256:"a".repeat(64), downloadURL:"https://github.com/whizbang-tech/whizbang-downloads/releases/download/v3-3.0.0-build.14/Whizbang-3.0.0-14.dmg" };
const release = (changes={}) => ({ tag_name:"v3-stable", draft:false, body:JSON.stringify({...metadata,...changes}) });
test("accepts only the v3 installer pinned to its immutable tag", () => { assert.equal(channelRelease(release()).build,14); });
test("rejects legacy, mismatched, malformed and untrusted releases", () => {
  for (const changes of [{version:"0.1.0"},{minimumSystemVersion:"14.0"},{build:13},{bundleIdentifier:"whizbangtech.whizbang-mac"},{downloadURL:"https://evil.example/app.dmg"},{downloadURL:metadata.downloadURL+"?redirect=evil"},{sha256:"invalid"}]) assert.throws(()=>channelRelease(release(changes)));
  assert.throws(()=>channelRelease({...release(),tag_name:"v0.1.0-build.13"}));
  assert.throws(()=>channelRelease({...release(),draft:true}));
  assert.throws(()=>channelRelease({...release(),body:"not json"}));
});
