import type { Express, Request, Response } from "express";
import { requireDatabase } from "./db.js";

const allowedStatuses = ["new","confirmed","preparing","shipping","completed","cancelled"] as const;

export function registerOrderRoutes(app: Express): void {
  app.get("/api/v1/orders", async (_req: Request, res: Response) => {
    try {
      const db = requireDatabase();
      const result = await db.query(
        `SELECT o.id, o.customer_user_id AS "customerUserId", o.customer_name AS "customerName",
                o.customer_phone AS "customerPhone", o.status, o.total,
                o.payment_method AS "paymentMethod", o.delivery_address AS "deliveryAddress",
                o.created_at AS "createdAt", o.updated_at AS "updatedAt",
                COALESCE(json_agg(json_build_object(
                  'id', i.id, 'productId', i.product_id, 'productName', i.product_name,
                  'price', i.price, 'quantity', i.quantity
                ) ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
         FROM marketplace_orders o
         LEFT JOIN marketplace_order_items i ON i.order_id=o.id
         GROUP BY o.id
         ORDER BY o.created_at DESC LIMIT 200`,
      );
      res.json({ orders: result.rows });
    } catch (error) {
      console.error("Orders list failed", error);
      res.status(500).json({ message: "Buyurtmalarni yuklab bo'lmadi." });
    }
  });

  app.get("/api/v1/orders/:id", async (req: Request, res: Response) => {
    try {
      const db = requireDatabase();
      const result = await db.query(
        `SELECT o.id, o.customer_user_id AS "customerUserId", o.customer_name AS "customerName",
                o.customer_phone AS "customerPhone", o.status, o.total,
                o.created_at AS "createdAt", o.updated_at AS "updatedAt",
                COALESCE(json_agg(json_build_object(
                  'id', i.id, 'productId', i.product_id, 'productName', i.product_name,
                  'price', i.price, 'quantity', i.quantity
                ) ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
         FROM marketplace_orders o
         LEFT JOIN marketplace_order_items i ON i.order_id = o.id
         WHERE o.id = $1
         GROUP BY o.id`,
        [req.params.id],
      );
      if (!result.rowCount) { res.status(404).json({ message: "Buyurtma topilmadi." }); return; }
      res.json({ order: result.rows[0] });
    } catch (error) {
      console.error("Order lookup failed", error);
      res.status(500).json({ message: "Buyurtmani yuklab bo'lmadi." });
    }
  });

  app.post("/api/v1/orders", async (req: Request, res: Response) => {
    const body = req.body ?? {};
    const items = Array.isArray(body.items) ? body.items : [];
    const customerName = String(body.customerName ?? "").trim();
    const customerPhone = String(body.customerPhone ?? "").trim();
    const customerUserId = body.customerUserId ? Number(body.customerUserId) : null;
    const paymentMethod = String(body.paymentMethod ?? "cash").trim() || "cash";
    const deliveryAddress = String(body.deliveryAddress ?? "").trim();
    if (!items.length || !customerName || !customerPhone || !["cash","card","debt"].includes(paymentMethod)) {
      res.status(400).json({ message: "Mijoz va buyurtma mahsulotlari kerak." });
      return;
    }
    const db = requireDatabase();
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const ids = items.map((x: any) => Number(x.productId)).filter(Number.isInteger);
      const products = await client.query(
        `SELECT p.id, p.name, p.price, p.stock,
           (SELECT discount_percent FROM marketplace_promotions
            WHERE product_id=p.id AND active=TRUE AND starts_at <= NOW()
              AND (ends_at IS NULL OR ends_at > NOW())
            ORDER BY created_at DESC LIMIT 1) AS promo_discount_percent
         FROM marketplace_products p
         WHERE p.id = ANY($1::bigint[]) FOR UPDATE`,
        [ids],
      );
      const byId = new Map(products.rows.map((p: any) => [Number(p.id), p]));
      let total = 0;
      const normalized: Array<{productId:number;name:string;price:number;quantity:number}> = [];
      for (const item of items) {
        const product = byId.get(Number(item.productId));
        const quantity = Math.floor(Number(item.quantity));
        if (!product || !Number.isFinite(quantity) || quantity < 1 || quantity > Number(product.stock)) {
          throw new Error("Mahsulot qoldig'i yetarli emas yoki mahsulot topilmadi.");
        }
        const unitPrice = Number(product.price) * (product.promo_discount_percent == null ? 1 : 1 - Number(product.promo_discount_percent) / 100);
        total += unitPrice * quantity;
        normalized.push({ productId: Number(product.id), name: product.name, price: Math.round(unitPrice * 100) / 100, quantity });
      }
      const order = await client.query(
        `INSERT INTO marketplace_orders (customer_user_id, customer_name, customer_phone, status, total, payment_method, delivery_address)
         VALUES ($1,$2,$3,'new',$4,$5,$6) RETURNING id, customer_name AS "customerName",
         customer_phone AS "customerPhone", status, total, payment_method AS "paymentMethod", delivery_address AS "deliveryAddress", created_at AS "createdAt"`,
        [customerUserId, customerName, customerPhone, total, paymentMethod, deliveryAddress],
      );
      for (const item of normalized) {
        await client.query(
          `INSERT INTO marketplace_order_items (order_id, product_id, product_name, price, quantity)
           VALUES ($1,$2,$3,$4,$5)`,
          [order.rows[0].id, item.productId, item.name, item.price, item.quantity],
        );
        await client.query(`UPDATE marketplace_products SET stock = stock - $1 WHERE id = $2`, [item.quantity, item.productId]);
      }
      await client.query("COMMIT");
      res.status(201).json({ order: order.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Order creation failed", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Buyurtma yaratilmadi." });
    } finally {
      client.release();
    }
  });

  app.patch("/api/v1/orders/:id/status", async (req: Request, res: Response) => {
    const status = String(req.body?.status ?? "").trim();
    if (!(allowedStatuses as readonly string[]).includes(status)) {
      res.status(400).json({ message: "Noto'g'ri buyurtma holati." });
      return;
    }
    try {
      const db = requireDatabase();
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const current = await client.query(`SELECT id, status FROM marketplace_orders WHERE id=$1 FOR UPDATE`, [req.params.id]);
        if (!current.rowCount) { await client.query("ROLLBACK"); res.status(404).json({ message: "Buyurtma topilmadi." }); return; }
        const from = String(current.rows[0].status);
        const transitions: Record<string,string[]> = {
          new:["confirmed","cancelled"], confirmed:["preparing","cancelled"], preparing:["shipping","cancelled"],
          shipping:["completed","cancelled"], completed:[], cancelled:[]
        };
        if (!(transitions[from] ?? []).includes(status)) {
          await client.query("ROLLBACK"); res.status(409).json({ message: `Holatni ${from} dan ${status} ga o'zgartirib bo'lmaydi.` }); return;
        }
        if (status === "cancelled") {
          await client.query(`UPDATE marketplace_products p SET stock=p.stock+i.quantity FROM marketplace_order_items i WHERE i.order_id=$1 AND i.product_id=p.id`, [req.params.id]);
        }
        const result = await client.query(
          `UPDATE marketplace_orders SET status=$1, updated_at=NOW() WHERE id=$2
           RETURNING id, customer_user_id AS "customerUserId", customer_name AS "customerName", customer_phone AS "customerPhone",
                     status, total, created_at AS "createdAt", updated_at AS "updatedAt"`,
          [status, req.params.id],
        );
        await client.query("COMMIT");
        res.json({ order: result.rows[0] });
      } finally { client.release(); }
    } catch (error) {
      console.error("Order status update failed", error);
      res.status(500).json({ message: "Buyurtma holatini o'zgartirib bo'lmadi." });
    }
  });
}
