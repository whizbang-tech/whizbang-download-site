import { channelRelease, releaseAPI } from "./release.js";
const button = document.querySelector("#download-button");
async function loadRelease() {
  try {
    const response = await fetch(releaseAPI, { cache:"no-store", headers:{Accept:"application/vnd.github+json"}, signal:AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Release unavailable");
    const release = channelRelease(await response.json());
    button.href = release.downloadURL;
    button.removeAttribute("aria-disabled");
    document.querySelector("#release-status").textContent = `Whizbang ${release.version} is ready`;
    document.querySelector("#release-detail").textContent = `Build ${release.build} · Requires macOS 27 or later`;
    const notes = document.querySelector("#release-notes");
    notes.href = release.releaseURL; notes.textContent = "Release notes ↗";
  } catch {
    document.querySelector("#release-status").textContent = "Whizbang v3 download is not available yet";
    document.querySelector("#download-fallback").hidden = false;
    button.removeAttribute("href"); button.setAttribute("aria-disabled", "true");
  }
}
void loadRelease();
