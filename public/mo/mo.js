const releaseMetadataURL = "/mo/release.json";
const trustedDownloadPattern = /^\/mo\/releases\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\.dmg$/;

const statusElement = document.querySelector("#release-status");
const detailElement = document.querySelector("#release-detail");
const downloadButton = document.querySelector("#download-button");

function showPendingRelease() {
  statusElement.textContent = "Private beta release is being prepared";
  detailElement.textContent = "Apple silicon · macOS 14 Sonoma or later";
  downloadButton.classList.add("is-disabled");
  downloadButton.setAttribute("aria-disabled", "true");
  downloadButton.removeAttribute("download");
  downloadButton.href = "#";
}

function validRelease(release) {
  return release
    && typeof release.version === "string"
    && Number.isInteger(release.build)
    && typeof release.downloadURL === "string"
    && trustedDownloadPattern.test(release.downloadURL);
}

async function loadCurrentRelease() {
  try {
    const response = await fetch(releaseMetadataURL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Release lookup failed: ${response.status}`);

    const release = await response.json();
    if (!validRelease(release)) throw new Error("Release metadata is invalid");

    statusElement.textContent = `Mo ${release.version} is ready`;
    detailElement.textContent = `Build ${release.build} · Apple silicon · macOS 14 Sonoma or later`;
    downloadButton.href = release.downloadURL;
    downloadButton.setAttribute("download", "");
    downloadButton.removeAttribute("aria-disabled");
    downloadButton.classList.remove("is-disabled");
  } catch (error) {
    console.warn("Unable to resolve the current Mo release", error);
    showPendingRelease();
  }
}

downloadButton.addEventListener("click", (event) => {
  if (downloadButton.getAttribute("aria-disabled") === "true") event.preventDefault();
});

void loadCurrentRelease();
