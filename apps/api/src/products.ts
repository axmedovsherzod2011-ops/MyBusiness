import type { Request, Response, Router } from "express";
import express from "express";
import { initializeDatabase, requireDatabase } from "./db.js";

const router: Router = express.Router();

function toProduct(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    price: Number(row.price),
    imageUrl: String(row.image_url ?? ""),
    stock: Number(row.stock),
    createdAt: String(row.created_at),
  };
}

function readProductInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return { error: "Request body must be an object." as const };
  }

  const value = body as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const imageUrl = typeof value.imageUrl === "string" ? value.imageUrl.trim() : "";
  const price = typeof value.price === "number" ? value.price : Number(value.price);
  const stock = typeof value.stock === "number" ? value.stock : Number(value.stock);

  if (!name) return { error: "Product name is required." as const };
  if (name.length > 180) return { error: "Product name is too long." as const };
  if (!Number.isFinite(price) || price < 0) return { error: "Price must be a non-negative number." as const };
  if (!Number.isInteger(stock) || stock < 0) return { error: "Stock must be a non-negative integer." as const };
  if (imageUrl && imageUrl.length > 2_000) return { error: "Image URL is too long." as const };

  return { name, description, price, stock, imageUrl };
}

router.get("/", async (_req: Request, res: Response) => {
  try {
    await initializeDatabase();
    const db = requireDatabase();
    const result = await db.query(
      `SELECT id, name, description, price, image_url, stock, created_at
       FROM marketplace_products
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
      `INSERT INTO marketplace_products (name, description, price, image_url, stock)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, description, price, image_url, stock, created_at`,
      [input.name, input.description, input.price, input.imageUrl, input.stock],
    );
    res.status(201).json({ product: toProduct(result.rows[0]) });
  } catch (error) {
    console.error("Failed to create product", error);
    res.status(503).json({ error: "DATABASE_UNAVAILABLE", message: "Product could not be saved." });
  }
});

export { router as productsRouter };
