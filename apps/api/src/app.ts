import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { checkDatabaseConnection, initializeDatabase } from "./db.js";
import { productsRouter } from "./products.js";
import { registerTelegramAuthRoutes } from "./telegram-auth.js";
import { registerOrderRoutes } from "./orders.js";
import { registerChatRoutes } from "./chats.js";

const appVersion = process.env.APP_VERSION ?? "0.1.0";
const corsOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "https://mybusiness-9h9.pages.dev",
  "https://mybusiness.axmedovsherzod2011.workers.dev",
  ...corsOrigins,
]);

export const app: Express = express();

app.disable("x-powered-by");
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin is not allowed."));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false, limit: "256kb" }));

app.get("/health", async (_req: Request, res: Response) => {
  const database = await checkDatabaseConnection();
  res.status(database ? 200 : 503).json({
    ok: database,
    service: "marketplace-api",
    database: database ? "connected" : "unavailable",
    version: appVersion,
    timestamp: new Date().toISOString(),
  });
});

app.get("/ready", async (_req: Request, res: Response) => {
  const database = await checkDatabaseConnection();
  res.status(database ? 200 : 503).json({
    ok: database,
    database: database ? "connected" : "unavailable",
    version: appVersion,
  });
});

app.get("/api/v1", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    name: "Marketplace API",
    version: "v1",
    release: appVersion,
    status: "marketplace-ready",
  });
});

registerTelegramAuthRoutes(app);
registerOrderRoutes(app);
registerChatRoutes(app);

app.use("/api/v1/products", productsRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "NOT_FOUND", message: "Resource not found." });
});

app.use((_error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled application error");
  res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "Internal server error." });
});

void initializeDatabase().catch((error) => {
  console.error("Database initialization failed", error);
});
