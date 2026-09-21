import { app } from "./app.js";

const port = Number(process.env.PORT ?? 10000);

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Marketplace API listening on 0.0.0.0:${port}`);
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`Received ${signal}; shutting down gracefully...`);

  server.close((error) => {
    if (error) {
      console.error("HTTP server shutdown failed", error);
      process.exitCode = 1;
    }
    process.exit();
  });

  setTimeout(() => {
    console.error("Graceful shutdown timed out; forcing exit");
    process.exit(1);
  }, 25000).unref();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
