import { Router, type Response, type Router as ExpressRouter } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { branches, customers, orders, products, routes, users, warehouses } from "../db/schema.js";
import { requireFirebaseAuth, type AuthenticatedRequest } from "../auth/middleware.js";

export const lookupRouter: ExpressRouter = Router();
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
      // Search each entered word independently. PostgreSQL ILIKE is Unicode-aware,
      // so Russian, Uzbek, English and other Unicode names/addresses can be found
      // without translating the user's input or the stored customer data.
      const terms = q.split(/\s+/).map((term) => term.trim()).filter(Boolean).slice(0, 8);
      const termConditions = terms.map((term) => {
        const termLike = "%" + term + "%";
        return or(
          idMatches(customers.id, termLike),
          ilike(customers.code, termLike),
          ilike(customers.name, termLike),
          ilike(customers.address, termLike),
          ilike(customers.phone, termLike),
        );
      });

      return res.json(await db.select({ id: customers.id, code: customers.code, name: customers.name, phone: customers.phone, address: customers.address })
        .from(customers)
        .where(and(eq(customers.companyId, u.companyId), ...termConditions))
        .orderBy(customers.name).limit(20));
    }

    if (type === "products") {
      return res.json(await db.select({ id: products.id, sku: products.sku, barcode: products.barcode, name: products.name, unit: products.unit, costPrice: products.costPrice, salePrice: products.salePrice })
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

    if (type === "routes") {
      return res.json(await db.select({ id: routes.id, name: routes.name, routeDate: routes.routeDate })
        .from(routes)
        .where(and(eq(routes.companyId, u.companyId), or(idMatches(routes.id, like), ilike(routes.name, like), sql`CAST(${routes.routeDate} AS TEXT) ILIKE ${like}`)))
        .orderBy(desc(routes.routeDate)).limit(20));
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
