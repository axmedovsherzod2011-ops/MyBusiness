import type { Express, Request, Response } from "express";
import { requireDatabase } from "./db.js";
export function registerAnalyticsRoutes(app: Express): void {
  app.get("/api/v1/analytics/summary", async (req: Request, res: Response) => {
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
    try {
      const db = requireDatabase();
      const [summary,daily,top,stock] = await Promise.all([
        db.query(`SELECT COUNT(*) FILTER (WHERE status='completed')::int AS "completedOrders", COUNT(*)::int AS "totalOrders",
          COALESCE(SUM(total) FILTER (WHERE status='completed'),0) AS revenue,
          COALESCE(AVG(total) FILTER (WHERE status='completed'),0) AS "averageOrder"
          FROM marketplace_orders WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')`,[days]),
        db.query(`SELECT DATE(created_at) AS day, COUNT(*)::int AS orders, COALESCE(SUM(total) FILTER (WHERE status='completed'),0) AS revenue
          FROM marketplace_orders WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day') GROUP BY DATE(created_at) ORDER BY day ASC`,[days]),
        db.query(`SELECT i.product_id AS "productId", i.product_name AS "productName", SUM(i.quantity)::int AS units,
          COALESCE(SUM(i.price*i.quantity),0) AS revenue FROM marketplace_order_items i JOIN marketplace_orders o ON o.id=i.order_id
          WHERE o.status='completed' AND o.created_at >= NOW() - ($1::int * INTERVAL '1 day')
          GROUP BY i.product_id,i.product_name ORDER BY revenue DESC LIMIT 10`,[days]),
        db.query(`SELECT COUNT(*)::int AS products, COALESCE(SUM(stock),0)::int AS units,
          COUNT(*) FILTER (WHERE stock=0)::int AS "outOfStock", COUNT(*) FILTER (WHERE stock BETWEEN 1 AND 5)::int AS "lowStock"
          FROM marketplace_products`)
      ]);
      res.json({days,summary:summary.rows[0],daily:daily.rows,topProducts:top.rows,stock:stock.rows[0]});
    } catch(error){console.error("Analytics failed",error);res.status(500).json({message:"Analitikani yuklab bo'lmadi."});}
  });
}
