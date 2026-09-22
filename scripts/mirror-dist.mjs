import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const app = process.argv[2];
if (!app || !["customer", "seller"].includes(app)) {
  throw new Error("Usage: node scripts/mirror-dist.mjs <customer|seller>");
}

const appRoot = resolve(process.cwd());
const source = resolve(appRoot, "dist");
const repoRoot = resolve(appRoot, "../..");
const target = resolve(repoRoot, "dist");

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });

console.log(`Mirrored ${app}/dist -> root dist for static hosting.`);
