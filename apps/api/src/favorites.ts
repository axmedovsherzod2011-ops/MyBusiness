import type { Express, Request, Response } from "express";
import { requireDatabase } from "./db.js";

async function customerIdFromToken(req: Request): Promise<number | null> {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const db = requireDatabase();
  const result = await db.query("SELECT id FROM customer_users WHERE auth_token=$1 LIMIT 1", [token]);
  return result.rowCount ? Number(result.rows[0].id) : null;
}

export function registerFavoriteRoutes(app: Express): void {
  app.get("/api/v1/favorites", async (req: Request, res: Response) => {
    try {
      const customerId = await customerIdFromToken(req);
      if (!customerId) { res.status(401).json({ message: "Kirish talab qilinadi." }); return; }
      const db = requireDatabase();
      const result = await db.query(
        "SELECT product_id AS \"productId\" FROM customer_favorites WHERE customer_user_id=$1 ORDER BY created_at DESC",
        [customerId],
      );
      res.setHeader("Cache-Control", "no-store");
      res.json({ favorites: result.rows.map((x: { productId: number | string }) => Number(x.productId)) });
    } catch (error) {
      console.error("Favorites list failed", error);
      res.status(500).json({ message: "Sevimlilarni yuklab bo'lmadi." });
    }
  });

  app.put("/api/v1/favorites/:productId", async (req: Request, res: Response) => {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId) || productId < 1) { res.status(400).json({ message: "Noto'g'ri mahsulot." }); return; }
    try {
      const customerId = await customerIdFromToken(req);
      if (!customerId) { res.status(401).json({ message: "Kirish talab qilinadi." }); return; }
      const db = requireDatabase();
      const product = await db.query("SELECT id FROM marketplace_products WHERE id=$1 LIMIT 1", [productId]);
      if (!product.rowCount) { res.status(404).json({ message: "Mahsulot topilmadi." }); return; }
      const existing = await db.query("SELECT 1 FROM customer_favorites WHERE customer_user_id=$1 AND product_id=$2", [customerId, productId]);
      if (existing.rowCount) {
        await db.query("DELETE FROM customer_favorites WHERE customer_user_id=$1 AND product_id=$2", [customerId, productId]);
        res.json({ productId, liked: false });
      } else {
        await db.query("INSERT INTO customer_favorites (customer_user_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [customerId, productId]);
        res.json({ productId, liked: true });
      }
    } catch (error) {
      console.error("Favorite toggle failed", error);
      res.status(500).json({ message: "Sevimlini saqlab bo'lmadi." });
    }
  });
}
