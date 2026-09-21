import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";

const appVersion = process.env.APP_VERSION ?? "0.1.0";
const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const app: Express = express();

app.disable("x-powered-by");
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false, limit: "256kb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: "marketplace-api",
    version: appVersion,
    timestamp: new Date().toISOString(),
  });
});

app.get("/ready", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, version: appVersion });
});

app.get("/api/v1", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    name: "Marketplace API",
    version: "v1",
    release: appVersion,
    status: "foundation-ready",
  });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "NOT_FOUND", message: "Resource not found." });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled application error", error);
  res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "Internal server error." });
});
