import type { Express, Request, Response } from "express";
import { requireDatabase } from "./db.js";
import { requireCustomer } from "./customer-auth.js";

export function registerChatRoutes(app: Express): void {
  app.get("/api/v1/chats", async (_req: Request, res: Response) => {
    try {
      const db = requireDatabase();
      const result = await db.query(
        `SELECT c.id, c.customer_user_id AS "customerUserId", c.product_id AS "productId",
                c.customer_name AS "customerName", c.status,
                p.name AS "productName", p.image_url AS "productImageUrl",
                c.created_at AS "createdAt", c.updated_at AS "updatedAt",
                COALESCE((SELECT body FROM seller_chat_messages m WHERE m.chat_id=c.id
                  ORDER BY m.created_at DESC LIMIT 1), '') AS "lastMessage",
                (SELECT COUNT(*) FROM seller_chat_messages m WHERE m.chat_id=c.id
                  AND m.sender_role='customer')::int AS "messageCount",
                c.seller_last_read_at AS "sellerLastReadAt",
                CASE WHEN EXISTS (
                  SELECT 1 FROM seller_chat_messages m
                  WHERE m.chat_id=c.id AND m.sender_role='customer'
                    AND (c.seller_last_read_at IS NULL OR m.created_at > c.seller_last_read_at)
                ) THEN TRUE ELSE FALSE END AS "hasUnreadForSeller"
         FROM seller_chats c
         LEFT JOIN marketplace_products p ON p.id=c.product_id
         ORDER BY c.updated_at DESC LIMIT 200`,
      );
      res.json({ chats: result.rows });
    } catch (error) {
      console.error("Chats list failed", error);
      res.status(500).json({ message: "Chatlarni yuklab bo'lmadi." });
    }
  });

  app.post("/api/v1/chats/:id/read", async (req: Request, res: Response) => {
    try {
      const db = requireDatabase();
      const result = await db.query(
        `UPDATE seller_chats SET seller_last_read_at=NOW() WHERE id=$1
         RETURNING id, seller_last_read_at AS "sellerLastReadAt"`,
        [req.params.id],
      );
      if (!result.rowCount) { res.status(404).json({ message: "Chat topilmadi." }); return; }
      res.json({ chat: result.rows[0] });
    } catch (error) {
      console.error("Chat read state failed", error);
      res.status(500).json({ message: "Chat o'qilgan holatini saqlab bo'lmadi." });
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

  app.patch("/api/v1/chats/:id/status", async (req: Request, res: Response) => {
    const status = String(req.body?.status ?? "").trim();
    if (!["open","closed"].includes(status)) { res.status(400).json({ message: "Noto'g'ri chat holati." }); return; }
    try {
      const db = requireDatabase();
      const result = await db.query(`UPDATE seller_chats SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id,status,updated_at AS "updatedAt"`, [status, req.params.id]);
      if (!result.rowCount) { res.status(404).json({ message: "Chat topilmadi." }); return; }
      res.json({ chat: result.rows[0] });
    } catch { res.status(500).json({ message: "Chat holatini o'zgartirib bo'lmadi." }); }
  });

  app.post("/api/v1/chats/:id/messages", async (req: Request, res: Response) => {
    const message = String(req.body?.message ?? "").trim();
    const senderRole = req.body?.senderRole === "seller" ? "seller" : "customer";
    if (!message) { res.status(400).json({ message: "Xabar bo'sh bo'lmasligi kerak." }); return; }
    try {
      const db = requireDatabase();
      const msg = await db.query(
        `INSERT INTO seller_chat_messages (chat_id, sender_role, body)
         VALUES ($1,$2,$3) RETURNING id, chat_id AS "chatId", sender_role AS "senderRole",
         body, created_at AS "createdAt"`,
        [req.params.id, senderRole, message],
      );
      await db.query("UPDATE seller_chats SET updated_at=NOW() WHERE id=$1", [req.params.id]);
      res.status(201).json({ message: msg.rows[0] });
    } catch (error) {
      console.error("Seller chat reply failed", error);
      res.status(500).json({ message: "Xabar yuborilmadi." });
    }
  });
}

export function registerCustomerChatRoutes(app: Express): void {
  app.get("/api/v1/customer/chats", async (req: Request, res: Response) => {
    const customerId=await requireCustomer(req,res); if(!customerId)return;
    try {
      const db=requireDatabase();
      const result=await db.query(\`SELECT c.id,c.product_id AS "productId",c.customer_name AS "customerName",c.status,
        p.name AS "productName",p.image_url AS "productImageUrl",c.created_at AS "createdAt",c.updated_at AS "updatedAt",
        COALESCE((SELECT body FROM seller_chat_messages m WHERE m.chat_id=c.id ORDER BY m.created_at DESC LIMIT 1),'') AS "lastMessage"
        FROM seller_chats c LEFT JOIN marketplace_products p ON p.id=c.product_id
        WHERE c.customer_user_id=$1 ORDER BY c.updated_at DESC LIMIT 200\`,[customerId]);
      res.json({chats:result.rows});
    } catch(error){console.error("Customer chats list failed",error);res.status(500).json({message:"Chatlarni yuklab bo'lmadi."});}
  });

  app.get("/api/v1/customer/chats/:id/messages", async (req: Request, res: Response) => {
    const customerId=await requireCustomer(req,res); if(!customerId)return;
    try {
      const db=requireDatabase();
      const result=await db.query(\`SELECT m.id,m.chat_id AS "chatId",m.sender_role AS "senderRole",m.body,m.created_at AS "createdAt"
        FROM seller_chat_messages m INNER JOIN seller_chats c ON c.id=m.chat_id
        WHERE m.chat_id=$1 AND c.customer_user_id=$2 ORDER BY m.created_at ASC\`,[req.params.id,customerId]);
      if(!result.rowCount){const chat=await db.query("SELECT 1 FROM seller_chats WHERE id=$1 AND customer_user_id=$2",[req.params.id,customerId]);if(!chat.rowCount){res.status(404).json({message:"Chat topilmadi."});return;}}
      res.setHeader("Cache-Control","no-store");res.json({messages:result.rows});
    } catch(error){console.error("Customer chat messages failed",error);res.status(500).json({message:"Xabarlarni yuklab bo'lmadi."});}
  });

  app.post("/api/v1/customer/chats", async (req: Request, res: Response) => {
    const customerId=await requireCustomer(req,res); if(!customerId)return;
    const message=String(req.body?.message??"").trim(), productId=req.body?.productId?Number(req.body.productId):null;
    if(!message){res.status(400).json({message:"Xabar bo'sh bo'lmasligi kerak."});return;}
    if(message.length>4000){res.status(400).json({message:"Xabar juda uzun."});return;}
    try {
      const db=requireDatabase();
      const user=await db.query("SELECT first_name,last_name FROM customer_users WHERE id=$1",[customerId]);
      if(!user.rowCount){res.status(401).json({message:"Akkaunt topilmadi."});return;}
      const customerName=[user.rows[0].first_name,user.rows[0].last_name].filter(Boolean).join(" ")||"Mijoz";
      const existing=productId?await db.query("SELECT id FROM seller_chats WHERE customer_user_id=$1 AND product_id IS NOT DISTINCT FROM $2 AND status='open' LIMIT 1",[customerId,productId]):{rowCount:0,rows:[] as any[]};
      let chatId:number;
      if(existing.rowCount)chatId=Number(existing.rows[0].id);
      else{const chat=await db.query("INSERT INTO seller_chats(customer_user_id,product_id,customer_name) VALUES($1,$2,$3) RETURNING id",[customerId,productId,customerName]);chatId=Number(chat.rows[0].id);}
      const msg=await db.query(\`INSERT INTO seller_chat_messages(chat_id,sender_role,body) VALUES($1,'customer',$2)
        RETURNING id,chat_id AS "chatId",sender_role AS "senderRole",body,created_at AS "createdAt"\`,[chatId,message]);
      await db.query("UPDATE seller_chats SET updated_at=NOW(),customer_name=$2 WHERE id=$1",[chatId,customerName]);
      res.status(201).json({chatId,message:msg.rows[0]});
    } catch(error){console.error("Customer chat creation failed",error);res.status(500).json({message:"Chatni yaratib bo'lmadi."});}
  });

  app.post("/api/v1/customer/chats/:id/messages", async (req: Request, res: Response) => {
    const customerId=await requireCustomer(req,res); if(!customerId)return;
    const message=String(req.body?.message??"").trim();
    if(!message||message.length>4000){res.status(400).json({message:"Xabar uzunligi noto'g'ri."});return;}
    try {
      const db=requireDatabase();
      const chat=await db.query("SELECT id FROM seller_chats WHERE id=$1 AND customer_user_id=$2 AND status='open'",[req.params.id,customerId]);
      if(!chat.rowCount){res.status(404).json({message:"Chat topilmadi yoki yopilgan."});return;}
      const msg=await db.query(\`INSERT INTO seller_chat_messages(chat_id,sender_role,body) VALUES($1,'customer',$2)
        RETURNING id,chat_id AS "chatId",sender_role AS "senderRole",body,created_at AS "createdAt"\`,[req.params.id,message]);
      await db.query("UPDATE seller_chats SET updated_at=NOW() WHERE id=$1",[req.params.id]);
      res.status(201).json({message:msg.rows[0]});
    } catch(error){console.error("Customer chat message failed",error);res.status(500).json({message:"Xabar yuborilmadi."});}
  });
}
