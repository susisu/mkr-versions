import * as fs from "fs/promises";
import * as path from "path";
import * as github from "@actions/github";
import type * as tc from "@actions/tool-cache";
import type { Endpoints } from "@octokit/types";
import * as semver from "semver";

async function main(): Promise<void> {
  const token = process.env["GITHUB_TOKEN"];
  if (!token) {
    throw new Error("GITHUB_TOKEN must be defined");
  }
  const releases = await listReleases(token);
  const manifest = generateManifest(releases);
  await writeManifest(manifest);
}

type Release = Endpoints["GET /repos/{owner}/{repo}/releases"]["response"]["data"][number];
type Asset = Release["assets"][number];

async function listReleases(token: string): Promise<Release[]> {
  const oktokit = github.getOctokit(token);
  const releases = await oktokit.paginate("GET /repos/{owner}/{repo}/releases", {
    owner: "mackerelio",
    repo: "mkr",
  });
  return releases;
}

type Manifest = readonly tc.IToolRelease[];

function generateManifest(releases: readonly Release[]): Manifest {
  return releases.flatMap(release => {
    const toolRelease = convertRelease(release);
    return toolRelease ? [toolRelease] : [];
  });
}

function convertRelease(release: Release): tc.IToolRelease | undefined {
  if (release.draft) {
    return undefined;
  }
  const version = semver.clean(release.tag_name);
  if (!version) {
    return undefined;
  }
  return {
    version,
    stable: !release.prerelease,
    release_url: release.html_url,
    files: release.assets.flatMap(asset => {
      const file = convertAsset(asset);
      return file ? [file] : [];
    }),
  };
}

function convertAsset(asset: Asset): tc.IToolReleaseFile | undefined {
  const info = getAssetInfo(asset);
  if (!info) {
    return undefined;
  }
  return {
    filename: asset.name,
    platform: info.platform,
    arch: info.arch,
    download_url: asset.browser_download_url,
  };
}

type AssetInfo = Readonly<{
  platform: string;
  arch: string;
}>;

const archiveExts: readonly string[] = ["tar.gz", "zip"];

const platformMap: ReadonlyMap<string, string> = new Map([
  ["linux", "linux"],
  ["darwin", "darwin"],
  ["windows", "win32"],
]);

const archMap: ReadonlyMap<string, string> = new Map([
  ["arm", "arm"],
  ["arm64", "arm64"],
  ["386", "ia32"],
  ["amd64", "x64"],
]);

function getAssetInfo(asset: Asset): AssetInfo | undefined {
  const r = /^mkr_([^.]+)_([^.]+)\.(.+)$/.exec(asset.name);
  if (!r) {
    return undefined;
  }
  const [, p, a, x] = r;
  if (!archiveExts.includes(x)) {
    return undefined;
  }
  const platform = platformMap.get(p);
  if (!platform) {
    return undefined;
  }
  const arch = archMap.get(a);
  if (!arch) {
    return undefined;
  }
  return { platform, arch };
}

async function writeManifest(manifest: Manifest): Promise<void> {
  const file = path.resolve(__dirname, "..", "versions-manifest.json");
  const content =
    JSON.stringify(
      [...manifest].sort((a, b) => semver.compare(b.version, a.version)),
      undefined,
      "  "
    ) + "\n";
  await fs.writeFile(file, content, "utf-8");
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(String(err));
  process.exitCode = 1;
});
