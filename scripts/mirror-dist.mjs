import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const app = process.argv[2];
if (!app || !["customer", "seller"].includes(app)) {
  throw new Error("Usage: node scripts/mirror-dist.mjs <customer|seller>");
}

const source = resolve("apps", app, "dist");
const target = resolve("dist");

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });

console.log(`Mirrored apps/${app}/dist -> dist for static hosting.`);
