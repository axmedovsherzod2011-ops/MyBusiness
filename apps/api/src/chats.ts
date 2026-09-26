import type { Express, Request, Response } from "express";
import { requireDatabase } from "./db.js";

export function registerChatRoutes(app: Express): void {
  app.get("/api/v1/chats", async (_req: Request, res: Response) => {
    try {
      const db = requireDatabase();
      const result = await db.query(
        `SELECT c.id, c.customer_user_id AS "customerUserId", c.product_id AS "productId",
                c.customer_name AS "customerName", c.status,
                c.created_at AS "createdAt", c.updated_at AS "updatedAt",
                COALESCE((SELECT body FROM seller_chat_messages m WHERE m.chat_id=c.id
                  ORDER BY m.created_at DESC LIMIT 1), '') AS "lastMessage",
                (SELECT COUNT(*) FROM seller_chat_messages m WHERE m.chat_id=c.id
                  AND m.sender_role='customer')::int AS "messageCount"
         FROM seller_chats c ORDER BY c.updated_at DESC LIMIT 200`,
      );
      res.json({ chats: result.rows });
    } catch (error) {
      console.error("Chats list failed", error);
      res.status(500).json({ message: "Chatlarni yuklab bo'lmadi." });
    }
  });

  app.get("/api/v1/chats/:id/messages", async (req: Request, res: Response) => {
    try {
      const db = requireDatabase();
      const result = await db.query(
        `SELECT id, chat_id AS "chatId", sender_role AS "senderRole", body,
                created_at AS "createdAt"
         FROM seller_chat_messages WHERE chat_id=$1 ORDER BY created_at ASC`,
        [req.params.id],
      );
      res.json({ messages: result.rows });
    } catch (error) {
      console.error("Chat messages failed", error);
      res.status(500).json({ message: "Xabarlarni yuklab bo'lmadi." });
    }
  });

  app.post("/api/v1/chats", async (req: Request, res: Response) => {
    const customerName = String(req.body?.customerName ?? "").trim();
    const customerUserId = req.body?.customerUserId ? Number(req.body.customerUserId) : null;
    const productId = req.body?.productId ? Number(req.body.productId) : null;
    const message = String(req.body?.message ?? "").trim();
    if (!customerName || !message) { res.status(400).json({ message: "Mijoz nomi va xabar kerak." }); return; }
    try {
      const db = requireDatabase();
      const existing = productId ? await db.query(
        `SELECT id FROM seller_chats WHERE customer_user_id IS NOT DISTINCT FROM $1
         AND product_id IS NOT DISTINCT FROM $2 AND status='open' LIMIT 1`,
        [customerUserId, productId],
      ) : { rowCount: 0, rows: [] as any[] };
      let chatId: number;
      if (existing.rowCount) chatId = Number(existing.rows[0].id);
      else {
        const chat = await db.query(
          `INSERT INTO seller_chats (customer_user_id, product_id, customer_name)
           VALUES ($1,$2,$3) RETURNING id`,
          [customerUserId, productId, customerName],
        );
        chatId = Number(chat.rows[0].id);
      }
      const msg = await db.query(
        `INSERT INTO seller_chat_messages (chat_id, sender_role, body)
         VALUES ($1,'customer',$2) RETURNING id, chat_id AS "chatId", sender_role AS "senderRole",
         body, created_at AS "createdAt"`,
        [chatId, message],
      );
      await db.query("UPDATE seller_chats SET updated_at=NOW() WHERE id=$1", [chatId]);
      res.status(201).json({ chatId, message: msg.rows[0] });
    } catch (error) {
      console.error("Chat creation failed", error);
      res.status(500).json({ message: "Chatni yaratib bo'lmadi." });
    }
  });

  app.post("/api/v1/chats/:id/messages", async (req: Request, res: Response) => {
    const message = String(req.body?.message ?? "").trim();
    if (!message) { res.status(400).json({ message: "Xabar bo'sh bo'lmasligi kerak." }); return; }
    try {
      const db = requireDatabase();
      const msg = await db.query(
        `INSERT INTO seller_chat_messages (chat_id, sender_role, body)
         VALUES ($1,'seller',$2) RETURNING id, chat_id AS "chatId", sender_role AS "senderRole",
         body, created_at AS "createdAt"`,
        [req.params.id, message],
      );
      await db.query("UPDATE seller_chats SET updated_at=NOW() WHERE id=$1", [req.params.id]);
      res.status(201).json({ message: msg.rows[0] });
    } catch (error) {
      console.error("Seller chat reply failed", error);
      res.status(500).json({ message: "Xabar yuborilmadi." });
    }
  });
}
