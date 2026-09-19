import cors from "cors";
import express, { type Express, type Request, type Response } from "express";
import { env } from "./config.js";
import { checkDatabase } from "./db/health.js";
import { authRouter } from "./auth/routes.js";

export const app: Express = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: "mybusiness-api",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

app.get("/ready", async (_req: Request, res: Response) => {
  try {
    await checkDatabase();
    res.status(200).json({ ok: true, database: "ready" });
  } catch (error) {
    console.error("Database readiness check failed", error);
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.get("/api/v1", (_req: Request, res: Response) => {
  res.json({
    name: "MyBusiness API",
    version: "v1",
    status: "ready",
  });
});

app.use("/api/v1/auth", authRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: "The requested resource was not found.",
  });
});

app.use((error: unknown, _req: Request, res: Response, _next: unknown) => {
  console.error("Unhandled application error", error);
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
  });
});
