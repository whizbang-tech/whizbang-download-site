export const releaseAPI = "https://api.github.com/repos/whizbang-tech/whizbang-downloads/releases/tags/v3-stable";
const downloadPrefix = "https://github.com/whizbang-tech/whizbang-downloads/releases/download/";
export function channelRelease(release) {
  if (release.draft || release.tag_name !== "v3-stable") throw new Error("Not the v3 channel");
  const current = JSON.parse(release.body);
  if (current.bundleIdentifier !== "tech.whizbang.universal" || current.minimumSystemVersion !== "27.0" ||
      !/^3\.\d+\.\d+$/.test(current.version) || !Number.isSafeInteger(current.build) || current.build < 14) {
    throw new Error("Incompatible Whizbang release");
  }
  const tag = `v3-${current.version}-build.${current.build}`;
  const asset = `Whizbang-${current.version}-${current.build}.dmg`;
  if (current.downloadURL !== `${downloadPrefix}${tag}/${asset}` || !/^[a-f0-9]{64}$/.test(current.sha256)) {
    throw new Error("Untrusted installer location");
  }
  return { ...current, releaseURL: `https://github.com/whizbang-tech/whizbang-downloads/releases/tag/${tag}` };
}
