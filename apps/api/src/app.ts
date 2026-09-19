import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { env, corsOrigins } from "./config.js";
import { checkDatabase } from "./db/health.js";
import { authRouter } from "./auth/routes.js";
import { dataRouter } from "./data/routes.js";
import { lookupRouter } from "./data/lookup.js";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function rateLimit(max: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + env.RATE_LIMIT_WINDOW_MS });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
      return res.status(429).json({ error: "RATE_LIMITED", message: "Слишком много запросов. Повторите попытку немного позже." });
    }
    return next();
  };
}

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, env.RATE_LIMIT_WINDOW_MS);
cleanup.unref();

export const app: Express = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((req, res, next) => {
  res.setHeader("X-Request-ID", req.header("X-Request-ID")?.trim() || randomUUID());
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (env.NODE_ENV === "production") res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

app.use(cors({
  origin: (origin, callback) => !origin || corsOrigins.includes(origin)
    ? callback(null, true)
    : callback(new Error("Источник CORS не разрешён.")),
  credentials: false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  maxAge: 86400,
}));

app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false, limit: "256kb" }));
app.use(rateLimit(env.RATE_LIMIT_MAX));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, service: "mybusiness-api", version: env.APP_VERSION, timestamp: new Date().toISOString() });
});

app.get("/ready", async (_req: Request, res: Response) => {
  try {
    await checkDatabase();
    res.status(200).json({ ok: true, database: "ready", version: env.APP_VERSION });
  } catch (error) {
    console.error("Не удалось проверить готовность базы данных", error);
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.get("/api/v1", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ name: "API МойБизнес", version: "v1", release: env.APP_VERSION, status: "ready" });
});

app.use("/api/v1/auth", rateLimit(env.AUTH_RATE_LIMIT_MAX), authRouter);
app.use("/api/v1/data", dataRouter);
app.use("/api/v1/lookups", rateLimit(60), lookupRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "NOT_FOUND", message: "Запрошенный ресурс не найден." });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Произошла непредвиденная ошибка приложения", error);
  if (error instanceof Error && error.message === "Источник CORS не разрешён.") {
    return res.status(403).json({ error: "CORS_FORBIDDEN", message: "Источник не разрешён." });
  }
  return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "Произошла непредвиденная ошибка." });
});
