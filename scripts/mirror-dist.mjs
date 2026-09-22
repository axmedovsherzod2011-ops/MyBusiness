import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const app = process.argv[2];
if (!app || !["customer", "seller"].includes(app)) {
  throw new Error("Usage: node scripts/mirror-dist.mjs <customer|seller>");
}

const appRoot = resolve(process.cwd());
const source = resolve(appRoot, "dist");
const repoRoot = resolve(appRoot, "../..");
const rootTarget = resolve(repoRoot, "dist");

await rm(rootTarget, { recursive: true, force: true });
await mkdir(rootTarget, { recursive: true });
await cp(source, rootTarget, { recursive: true });

// Also make apps/<app>/ itself contain the built static site.
// This covers Cloudflare Pages configurations that use apps/<app>
// as the output directory.
await cp(source, appRoot, { recursive: true });

console.log(`Mirrored ${app}/dist -> root dist and apps/${app}/ for static hosting.`);
