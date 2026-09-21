import cors from "cors";
import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 10000);

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",").map((v) => v.trim()) ?? true }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, service: "marketplace-api" }));
app.get("/ready", (_req, res) => res.json({ ready: true }));
app.get("/api/v1", (_req, res) => res.json({
  name: "Marketplace API",
  version: "v1",
  status: "foundation-ready"
}));

app.listen(port, "0.0.0.0", () => {
  console.log(`Marketplace API listening on port ${port}`);
});
