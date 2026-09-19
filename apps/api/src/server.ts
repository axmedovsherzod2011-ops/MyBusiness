import { app } from "./app.js";
import { env } from "./config.js";
import { pool } from "./db/index.js";

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
