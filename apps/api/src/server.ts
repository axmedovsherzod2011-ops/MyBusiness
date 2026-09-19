import { app } from "./app.js";
import { env } from "./config.js";
import { pool } from "./db/index.js";

const server = app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`MyBusiness API listening on port ${env.PORT}`);
});

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}; shutting down gracefully...`);
  server.close(async () => {
    if (pool) {
      await pool.end();
    }
    process.exit(0);
  });
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
