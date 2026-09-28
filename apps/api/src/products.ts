import type { Request, Response, Router } from "express";
import express from "express";
import { initializeDatabase, requireDatabase } from "./db.js";

const router: Router = express.Router();

function toProduct(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    name: String(row.name),
    sku: String(row.sku ?? ""),
    description: String(row.description ?? ""),
    price: Number(row.price),
    imageUrl: String(row.image_url ?? ""),
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls.map(String).filter(Boolean) : (row.image_url ? [String(row.image_url)] : []),
    stock: Number(row.stock),
    createdAt: String(row.created_at),
    promoDiscountPercent: row.promo_discount_percent == null ? null : Number(row.promo_discount_percent),
    promoPrice: row.promo_discount_percent == null ? null : Math.round(Number(row.price) * (1 - Number(row.promo_discount_percent) / 100) * 100) / 100,
  };
}

function readProductInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return { error: "Request body must be an object." as const };
  }

  const value = body as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const sku = typeof value.sku === "string" ? value.sku.trim().toUpperCase() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const imageUrl = typeof value.imageUrl === "string" ? value.imageUrl.trim() : "";
  const rawImageUrls = Array.isArray(value.imageUrls) ? value.imageUrls : [];
  const imageUrls = rawImageUrls.length ? rawImageUrls.map((x) => typeof x === "string" ? x.trim() : "").filter(Boolean) : (imageUrl ? [imageUrl] : []);
  const price = typeof value.price === "number" ? value.price : Number(value.price);
  const stock = typeof value.stock === "number" ? value.stock : Number(value.stock);

  if (!name) return { error: "Product name is required." as const };
  if (!sku) return { error: "SKU is required." as const };
  if (sku.length > 40) return { error: "SKU is too long." as const };
  if (!/^[A-Z0-9._-]+$/.test(sku)) return { error: "SKU faqat harf, raqam, -, _, . belgilaridan iborat bo'lishi mumkin." as const };
  if (name.length > 180) return { error: "Product name is too long." as const };
  if (!Number.isFinite(price) || price < 0) return { error: "Price must be a non-negative number." as const };
  if (!Number.isInteger(stock) || stock < 0) return { error: "Stock must be a non-negative integer." as const };
  if (imageUrls.length > 12) return { error: "Ko'pi bilan 12 ta rasm qo'shish mumkin." as const };
  if (imageUrls.some((url) => url.length > 2_000)) return { error: "Image URL is too long." as const };
  if (imageUrls.some((url) => !/^https?:\\/\\//i.test(url))) return { error: "Rasm URL'i http:// yoki https:// bilan boshlanishi kerak." as const };

  return { name, sku, description, price, stock, imageUrl: imageUrls[0] ?? "", imageUrls };
}

router.get("/", async (_req: Request, res: Response) => {
  try {
    await initializeDatabase();
    const db = requireDatabase();
    const result = await db.query(
      `SELECT p.id, p.name, p.sku, p.description, p.price, p.image_url, p.image_urls, p.stock, p.created_at,
              pr.discount_percent AS promo_discount_percent
       FROM marketplace_products p
       LEFT JOIN LATERAL (
         SELECT discount_percent FROM marketplace_promotions
         WHERE product_id=p.id AND active=TRUE AND starts_at <= NOW()
           AND (ends_at IS NULL OR ends_at > NOW())
         ORDER BY created_at DESC LIMIT 1
       ) pr ON TRUE
       ORDER BY created_at DESC, id DESC`,
    );
    res.json({ products: result.rows.map(toProduct) });
  } catch (error) {
    console.error("Failed to list products", error);
    res.status(503).json({ error: "DATABASE_UNAVAILABLE", message: "Product database is unavailable." });
  }
});

router.post("/", async (req: Request, res: Response) => {
  const input = readProductInput(req.body);
  if ("error" in input) {
    res.status(400).json({ error: "INVALID_PRODUCT", message: input.error });
    return;
  }

  try {
    await initializeDatabase();
    const db = requireDatabase();
    const result = await db.query(
      `INSERT INTO marketplace_products (name, sku, description, price, image_url, image_urls, stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, sku, description, price, image_url, image_urls, stock, created_at`,
      [input.name, input.sku, input.description, input.price, input.imageUrl, input.imageUrls, input.stock],
    );
    res.status(201).json({ product: toProduct(result.rows[0]) });
  } catch (error) {
    console.error("Failed to create product", error);
    res.status(503).json({ error: "DATABASE_UNAVAILABLE", message: "Product could not be saved." });
  }
});

export { router as productsRouter };


router.patch("/:id", async (req: Request, res: Response) => {
  const input = readProductInput(req.body);
  if ("error" in input) { res.status(400).json({ error: "INVALID_PRODUCT", message: input.error }); return; }
  try {
    const db = requireDatabase();
    const result = await db.query(
      `UPDATE marketplace_products SET name=$1, sku=$2, description=$3, price=$4, image_url=$5, image_urls=$6, stock=$7
       WHERE id=$8 RETURNING id, name, sku, description, price, image_url, image_urls, stock, created_at`,
      [input.name, input.sku, input.description, input.price, input.imageUrl, input.imageUrls, input.stock, req.params.id],
    );
    if (!result.rowCount) { res.status(404).json({ message: "Mahsulot topilmadi." }); return; }
    res.json({ product: toProduct(result.rows[0]) });
  } catch (error) { console.error("Product update failed", error); res.status(500).json({ message: "Mahsulotni yangilab bo'lmadi." }); }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = requireDatabase();
    const result = await db.query(`DELETE FROM marketplace_products WHERE id=$1 RETURNING id`, [req.params.id]);
    if (!result.rowCount) { res.status(404).json({ message: "Mahsulot topilmadi." }); return; }
    res.json({ ok: true, id: Number(result.rows[0].id) });
  } catch (error) { res.status(409).json({ message: "Mahsulotni o'chirib bo'lmadi. U buyurtma tarixida ishlatilgan bo'lishi mumkin." }); }
});

router.put("/:id/promotion", async (req: Request, res: Response) => {
  const discount = Number(req.body?.discountPercent);
  const endsAt = req.body?.endsAt ? new Date(String(req.body.endsAt)) : null;
  if (!Number.isFinite(discount) || discount <= 0 || discount >= 100) { res.status(400).json({ message: "Chegirma 1-99% oralig'ida bo'lishi kerak." }); return; }
  if (endsAt && Number.isNaN(endsAt.getTime())) { res.status(400).json({ message: "Aksiya sanasi noto'g'ri." }); return; }
  try {
    const db = requireDatabase();
    const product = await db.query(`SELECT id FROM marketplace_products WHERE id=$1`, [req.params.id]);
    if (!product.rowCount) { res.status(404).json({ message: "Mahsulot topilmadi." }); return; }
    await db.query(`UPDATE marketplace_promotions SET active=FALSE WHERE product_id=$1 AND active=TRUE`, [req.params.id]);
    const result = await db.query(
      `INSERT INTO marketplace_promotions (product_id, discount_percent, ends_at) VALUES ($1,$2,$3)
       RETURNING id, product_id AS "productId", discount_percent AS "discountPercent", starts_at AS "startsAt", ends_at AS "endsAt", active`,
      [req.params.id, discount, endsAt],
    );
    res.status(201).json({ promotion: result.rows[0] });
  } catch (error) { res.status(500).json({ message: "Aksiyani saqlab bo'lmadi." }); }
});

router.delete("/:id/promotion", async (req: Request, res: Response) => {
  try {
    const db = requireDatabase();
    await db.query(`UPDATE marketplace_promotions SET active=FALSE WHERE product_id=$1 AND active=TRUE`, [req.params.id]);
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ message: "Aksiyani o'chirib bo'lmadi." }); }
});
