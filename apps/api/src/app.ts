import cors from "cors";
import express, { type Express } from "express";
import { env } from "./config.js";
import { checkDatabase } from "./db/health.js";

export const app: Express = express();

app.disable("x-powered-by");
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "mybusiness-api",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

app.get("/ready", async (_req, res) => {
  try {
    await checkDatabase();
    res.status(200).json({ ok: true, database: "ready" });
  } catch (error) {
    console.error("Database readiness check failed", error);
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.get("/api/v1", (_req, res) => {
  res.json({ name: "MyBusiness API", version: "v1" });
});

app.use((_req, res) => {
  res.status(404).json({ error: "NOT_FOUND" });
});
