import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";

const app = process.argv[2];
if (!app || !["customer", "seller"].includes(app)) {
  throw new Error("Usage: node scripts/mirror-dist.mjs <customer|seller>");
}

const appRoot = resolve(process.cwd());
const source = resolve(appRoot, "dist");

// Cloudflare Pages may be configured to publish apps/<app> rather than
// apps/<app>/dist. Copy the already-built static files into that directory.
// Do not touch repository-level dist: customer and seller build in parallel.
await cp(source, appRoot, { recursive: true, force: true });

console.log(`Published ${app}/dist into apps/${app} for static hosting.`);
