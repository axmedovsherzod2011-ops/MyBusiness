import type { Express, Request, Response } from "express";
import { initializeDatabase, requireDatabase } from "./db.js";

function toBanner(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    desktopImageUrl: String(row.desktop_image_url ?? ""),
    mobileImageUrl: String(row.mobile_image_url ?? ""),
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
  };
}

export function registerBannerRoutes(app: Express): void {
  app.get("/api/v1/banners", async (_req: Request, res: Response) => {
    try {
      await initializeDatabase();
      const db = requireDatabase();
      const result = await db.query(`SELECT id, desktop_image_url, mobile_image_url, active, sort_order, created_at
        FROM marketplace_banners WHERE active=TRUE ORDER BY sort_order ASC, created_at DESC, id DESC`);
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      res.json({ banners: result.rows.map(toBanner) });
    } catch (error) {
      console.error("Failed to list banners", error);
      res.status(503).json({ message: "Bannerlarni yuklab bo'lmadi." });
    }
  });

  app.get("/api/v1/banners/manage", async (_req: Request, res: Response) => {
    try {
      await initializeDatabase();
      const db = requireDatabase();
      const result = await db.query(`SELECT id, desktop_image_url, mobile_image_url, active, sort_order, created_at
        FROM marketplace_banners ORDER BY sort_order ASC, created_at DESC, id DESC`);
      res.json({ banners: result.rows.map(toBanner) });
    } catch (error) {
      res.status(503).json({ message: "Bannerlarni yuklab bo'lmadi." });
    }
  });

  app.post("/api/v1/banners", async (req: Request, res: Response) => {
    const desktopImageUrl = typeof req.body?.desktopImageUrl === "string" ? req.body.desktopImageUrl.trim() : "";
    const mobileImageUrl = typeof req.body?.mobileImageUrl === "string" ? req.body.mobileImageUrl.trim() : "";
    const sortOrder = Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : 0;
    if (!/^https?:\/\//i.test(desktopImageUrl) || !/^https?:\/\//i.test(mobileImageUrl)) {
      res.status(400).json({ message: "Desktop va mobile banner rasmlari kerak." }); return;
    }
    try {
      await initializeDatabase();
      const db = requireDatabase();
      const result = await db.query(`INSERT INTO marketplace_banners
        (desktop_image_url, mobile_image_url, active, sort_order)
        VALUES ($1,$2,TRUE,$3)
        RETURNING id, desktop_image_url, mobile_image_url, active, sort_order, created_at`,
        [desktopImageUrl, mobileImageUrl, sortOrder]);
      res.status(201).json({ banner: toBanner(result.rows[0]) });
    } catch (error) {
      console.error("Failed to create banner", error);
      res.status(500).json({ message: "Bannerni saqlab bo'lmadi." });
    }
  });

  app.patch("/api/v1/banners/:id", async (req: Request, res: Response) => {
    try {
      await initializeDatabase();
      const db = requireDatabase();
      const current = await db.query(`SELECT * FROM marketplace_banners WHERE id=$1`, [req.params.id]);
      if (!current.rowCount) { res.status(404).json({ message: "Banner topilmadi." }); return; }
      const row = current.rows[0];
      const active = typeof req.body?.active === "boolean" ? req.body.active : Boolean(row.active);
      const sortOrder = req.body?.sortOrder == null ? Number(row.sort_order) : Number(req.body.sortOrder);
      const result = await db.query(`UPDATE marketplace_banners SET active=$1, sort_order=$2 WHERE id=$3
        RETURNING id, desktop_image_url, mobile_image_url, active, sort_order, created_at`, [active, sortOrder, req.params.id]);
      res.json({ banner: toBanner(result.rows[0]) });
    } catch (error) {
      res.status(500).json({ message: "Bannerni yangilab bo'lmadi." });
    }
  });

  app.delete("/api/v1/banners/:id", async (req: Request, res: Response) => {
    try {
      await initializeDatabase();
      const db = requireDatabase();
      const result = await db.query(`DELETE FROM marketplace_banners WHERE id=$1 RETURNING id`, [req.params.id]);
      if (!result.rowCount) { res.status(404).json({ message: "Banner topilmadi." }); return; }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Bannerni o'chirib bo'lmadi." });
    }
  });
}