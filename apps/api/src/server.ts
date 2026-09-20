import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { app } from "./app.js";
import { env } from "./config.js";
import { pool } from "./db/index.js";

const execFileAsync = promisify(execFile);

async function prepareDatabase() {
  await pool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_bonus boolean NOT NULL DEFAULT false`);
  console.log("Order bonus schema migration checked.");

  if (!env.DB_AUTO_PUSH) return;

  console.log("DB_AUTO_PUSH=true; synchronizing Drizzle schema before startup...");
  const { stdout, stderr } = await execFileAsync(
    "pnpm",
    ["--filter", "@mybusiness/api", "exec", "drizzle-kit", "push", "--force"],
    { cwd: process.cwd(), env: process.env, maxBuffer: 10 * 1024 * 1024 },
  );

  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.log(stderr.trim());
  console.log("Database schema synchronization completed.");
}

async function start() {
  try {
    await prepareDatabase();

    const server = app.listen(env.PORT, "0.0.0.0", () => {
      console.log("MyBusiness API listening on 0.0.0.0:" + env.PORT + " (" + env.NODE_ENV + ")");
    });

    let shuttingDown = false;
    const shutdown = (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log("Received " + signal + "; shutting down gracefully...");
      server.close(async (error) => {
        if (error) {
          console.error("HTTP server shutdown failed", error);
          process.exitCode = 1;
        }
        try {
          await pool.end();
        } catch (poolError) {
          console.error("Database pool shutdown failed", poolError);
          process.exitCode = 1;
        } finally {
          process.exit();
        }
      });
      setTimeout(() => {
        console.error("Graceful shutdown timed out; forcing exit");
        process.exit(1);
      }, 25000).unref();
    };

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("API startup failed", error);
    await pool.end().catch(() => undefined);
    process.exit(1);
  }
}

void start();
