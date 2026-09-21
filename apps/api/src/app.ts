import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { env, corsOrigins } from "./config.js";
import { checkDatabase } from "./db/health.js";

export const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false, limit: "256kb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: "mybusiness-api",
    version: env.APP_VERSION,
    timestamp: new Date().toISOString(),
  });
});

app.get("/ready", async (_req: Request, res: Response) => {
  try {
    await checkDatabase();
    res.status(200).json({ ok: true, database: "ready", version: env.APP_VERSION });
  } catch (error) {
    console.error("Database readiness check failed", error);
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.get("/api/v1", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ name: "M Cosmetics Marketplace API", version: "v1", release: env.APP_VERSION, status: "ready" });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "NOT_FOUND", message: "Запрошенный ресурс не найден." });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled application error", error);
  res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "Произошла непредвиденная ошибка." });
});
