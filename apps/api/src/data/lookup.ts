import { Router, type Response } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { branches, customers, orders, products, users, warehouses } from "../db/schema.js";
import { requireFirebaseAuth, type AuthenticatedRequest } from "../auth/middleware.js";

export const lookupRouter = Router();
lookupRouter.use(requireFirebaseAuth);

async function companyUser(req: AuthenticatedRequest) {
  const u = await db.query.users.findFirst({ where: eq(users.authSubject, req.firebaseUser!.uid) });
  if (!u) throw new Error("USER_NOT_FOUND");
  return u;
}

function idMatches(column: any, like: string) {
  return sql`CAST(${column} AS TEXT) ILIKE ${like}`;
}

function fail(res: Response, error: unknown) {
  console.error(error);
  const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
  if (code === "USER_NOT_FOUND") {
    return res.status(401).json({ error: code, message: "Пользователь не найден." });
  }
  return res.status(500).json({ error: "INTERNAL_ERROR", message: "Не удалось выполнить поиск." });
}

lookupRouter.get("/:type", async (req, res) => {
  try {
    const u = await companyUser(req);
    const q = String(req.query.q ?? "").trim();
    if (q.length < 1) return res.json([]);

    const like = "%" + q + "%";
    const type = String(req.params.type);

    if (type === "customers") {
      return res.json(await db.select({ id: customers.id, code: customers.code, name: customers.name })
        .from(customers)
        .where(and(eq(customers.companyId, u.companyId), or(idMatches(customers.id, like), ilike(customers.code, like), ilike(customers.name, like))))
        .orderBy(customers.name).limit(20));
    }

    if (type === "products") {
      return res.json(await db.select({ id: products.id, sku: products.sku, barcode: products.barcode, name: products.name })
        .from(products)
        .where(and(eq(products.companyId, u.companyId), or(idMatches(products.id, like), ilike(products.sku, like), ilike(products.barcode, like), ilike(products.name, like))))
        .orderBy(products.name).limit(20));
    }

    if (type === "branches") {
      return res.json(await db.select({ id: branches.id, code: branches.code, name: branches.name })
        .from(branches)
        .where(and(eq(branches.companyId, u.companyId), or(idMatches(branches.id, like), ilike(branches.code, like), ilike(branches.name, like))))
        .orderBy(branches.name).limit(20));
    }

    if (type === "warehouses") {
      return res.json(await db.select({ id: warehouses.id, code: warehouses.code, name: warehouses.name })
        .from(warehouses)
        .where(and(eq(warehouses.companyId, u.companyId), or(idMatches(warehouses.id, like), ilike(warehouses.code, like), ilike(warehouses.name, like))))
        .orderBy(warehouses.name).limit(20));
    }

    if (type === "orders") {
      return res.json(await db.select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status })
        .from(orders)
        .where(and(eq(orders.companyId, u.companyId), or(idMatches(orders.id, like), sql`CAST(${orders.orderNumber} AS TEXT) ILIKE ${like}`)))
        .orderBy(desc(orders.createdAt)).limit(20));
    }

    return res.status(400).json({ error: "INVALID_LOOKUP_TYPE", message: "Неизвестный тип поиска." });
  } catch (e) {
    return fail(res, e);
  }
});
