import type { Request, Response } from "express";
import { requireDatabase } from "./db.js";

export async function getCustomerId(req: Request): Promise<number | null> {
  const header = req.header("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token || token.length > 200) return null;
  const db = requireDatabase();
  const result = await db.query(
    "SELECT id FROM customer_users WHERE auth_token=$1 LIMIT 1",
    [token],
  );
  return result.rowCount ? Number(result.rows[0].id) : null;
}

export async function requireCustomer(req: Request, res: Response): Promise<number | null> {
  const id = await getCustomerId(req);
  if (!id) {
    res.status(401).json({ error: "AUTH_REQUIRED", message: "Kirish talab qilinadi." });
    return null;
  }
  res.setHeader("Cache-Control", "no-store");
  return id;
}
