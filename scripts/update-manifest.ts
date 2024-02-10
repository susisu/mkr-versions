import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";
import github from "@actions/github";
import type tc from "@actions/tool-cache";
import type octokit from "@octokit/types";
import semver from "semver";
import { diffStringsUnified } from "jest-diff";

async function main(): Promise<void> {
  const token = process.env["GITHUB_TOKEN"];
  if (!token) {
    throw new Error("GITHUB_TOKEN must be defined");
  }
  const test = process.argv[2] === "test";

  const releases = await listReleases(token);
  const manifest = generateManifest(releases);
  if (test) {
    await testManifest(manifest);
  } else {
    await writeManifest(manifest);
  }
}

type Release = octokit.Endpoints["GET /repos/{owner}/{repo}/releases"]["response"]["data"][number];
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
  return releases.flatMap((release) => {
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
    // eslint-disable-next-line @typescript-eslint/naming-convention
    release_url: release.html_url,
    files: release.assets.flatMap((asset) => convertAsset(asset)),
  };
}

function convertAsset(asset: Asset): readonly tc.IToolReleaseFile[] {
  const targets = getTargets(asset);
  return targets.map((target) => ({
    filename: asset.name,
    platform: target.platform,
    arch: target.arch,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    download_url: asset.browser_download_url,
  }));
}

type Target = Readonly<{
  platform: string;
  arch: string;
}>;

const archiveExts: readonly string[] = ["tar.gz", "zip"];

const platformsMap: ReadonlyMap<string, readonly string[]> = new Map([
  ["linux", ["linux"]],
  ["darwin", ["darwin"]],
  ["windows", ["win32"]],
]);

const archsMap: ReadonlyMap<string, readonly string[]> = new Map([
  ["arm", ["arm"]],
  ["arm64", ["arm64"]],
  ["386", ["ia32"]],
  ["amd64", ["x64"]],
]);

function getTargets(asset: Asset): readonly Target[] {
  const r = /^mkr_([^.]+)_([^.]+)\.(.+)$/.exec(asset.name);
  if (!r) {
    return [];
  }
  const [, p, a, x] = r;
  if (!archiveExts.includes(x)) {
    return [];
  }
  const platforms = platformsMap.get(p) ?? [];
  const archs = archsMap.get(a) ?? [];
  return platforms.flatMap((platform) => archs.map((arch) => ({ platform, arch })));
}

function dumpManifest(manifest: Manifest): string {
  return (
    JSON.stringify(
      [...manifest].sort((a, b) => semver.compare(b.version, a.version)),
      undefined,
      "  ",
    ) + "\n"
  );
}

const filename = url.fileURLToPath(import.meta.url);
const manifestFile = path.resolve(path.dirname(filename), "..", "versions-manifest.json");

async function testManifest(manifest: Manifest): Promise<void> {
  const json = dumpManifest(manifest);
  const content = await fs.readFile(manifestFile, "utf-8");
  if (json !== content) {
    // eslint-disable-next-line no-console
    console.error(diffStringsUnified(content, json));
    throw new Error("manifest did not match");
  }
}

async function writeManifest(manifest: Manifest): Promise<void> {
  const json = dumpManifest(manifest);
  await fs.writeFile(manifestFile, json, "utf-8");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(String(err));
  process.exitCode = 1;
});
