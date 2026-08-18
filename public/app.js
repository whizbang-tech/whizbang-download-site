const releaseAPI = "https://api.github.com/repos/whizbang-tech/whizbang-downloads/releases/latest";
const releasesPage = "https://github.com/whizbang-tech/whizbang-downloads/releases";
const trustedDownloadPrefix = "https://github.com/whizbang-tech/whizbang-downloads/releases/download/";

function releaseAsset(release, suffix) {
  return release.assets?.find((asset) => asset.name?.endsWith(suffix));
}

function isTrustedAssetURL(url) {
  return typeof url === "string" && url.startsWith(trustedDownloadPrefix);
}

function setFallback() {
  document.querySelector("#release-status").textContent = "Current release available on GitHub";
  document.querySelector("#release-detail").textContent = "macOS 14 Sonoma or later";
  document.querySelector("#download-button").href = releasesPage;
  document.querySelector("#download-fallback").hidden = false;
}

async function loadLatestRelease() {
  try {
    const response = await fetch(releaseAPI, {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error(`GitHub release lookup failed: ${response.status}`);

    const release = await response.json();
    const dmg = releaseAsset(release, ".dmg");
    if (!dmg || !isTrustedAssetURL(dmg.browser_download_url)) throw new Error("No trusted DMG asset found");

    document.querySelector("#download-button").href = dmg.browser_download_url;
    document.querySelector("#download-button").setAttribute("download", "");
    document.querySelector("#release-status").textContent = `${release.name ?? release.tag_name} is ready`;
    document.querySelector("#release-detail").textContent = `${dmg.name} · macOS 14 Sonoma or later`;
  } catch (error) {
    console.warn("Unable to resolve current Whizbang release", error);
    setFallback();
  }
}

void loadLatestRelease();
