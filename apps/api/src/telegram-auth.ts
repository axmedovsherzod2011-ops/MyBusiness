import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { requireDatabase } from "./db.js";

const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
const botUsername = (process.env.TELEGRAM_BOT_USERNAME ?? "").replace(/^@/, "");
const publicApiUrl = (process.env.PUBLIC_API_URL ?? "").replace(/\/$/, "");
const configuredWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
const webhookSecret = /^[A-Za-z0-9_-]{1,256}$/.test(configuredWebhookSecret)
  ? configuredWebhookSecret
  : "";
if (configuredWebhookSecret && !webhookSecret) {
  console.warn("TELEGRAM_WEBHOOK_SECRET is invalid for Telegram; webhook secret protection is disabled until it is replaced with A-Z/a-z/0-9/_/- characters.");
}

type TelegramUpdate = {
  message?: {
    chat?: { id: number };
    from?: { id: number };
    text?: string;
    contact?: { phone_number: string; user_id?: number; first_name?: string; last_name?: string };
  };
};

function normalizePhone(value: string): string {
  const cleaned = value.trim().replace(/[^+\d]/g, "");
  if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);
  return cleaned;
}

async function telegramApi(method: string, body: Record<string, unknown>): Promise<unknown> {
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as { ok?: boolean; description?: string };
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram API ${method} failed.`);
  }
  return data;
}

async function sendContactRequest(chatId: number, sessionId: string): Promise<void> {
  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: "MyBusiness hisobingizni tasdiqlash uchun telefon raqamingizni yuboring.",
    reply_markup: {
      keyboard: [[{ text: "📱 Raqamni yuborish", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: `Ulanish sessiyasi: ${sessionId.slice(0, 8)}…`,
  });
}

async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  const chatId = message?.chat?.id;
  const fromId = message?.from?.id;
  if (!message || !chatId || !fromId) return;

  const db = requireDatabase();
  const text = message.text?.trim() ?? "";

  if (text.startsWith("/start")) {
    const sessionId = text.slice(6).trim();
    if (!sessionId) {
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: "MyBusiness ilovasidan loginni boshlang, so'ng Telegram botdagi ulash tugmasidan foydalaning.",
      });
      return;
    }

    const result = await db.query(
      `UPDATE telegram_auth_sessions
       SET telegram_id = $2
       WHERE id = $1 AND status = 'pending' AND expires_at > NOW()
       RETURNING id`,
      [sessionId, fromId],
    );

    if (!result.rowCount) {
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: "Bu ulanish sessiyasi eskirgan. MyBusiness ilovasidan qaytadan boshlang.",
      });
      return;
    }

    await sendContactRequest(chatId, sessionId);
    return;
  }

  if (message.contact) {
    const contactPhone = normalizePhone(message.contact.phone_number);
    if (!contactPhone || (message.contact.user_id && message.contact.user_id !== fromId)) {
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: "Iltimos, aynan o'zingizning Telegram profilingizdagi raqamni yuboring.",
      });
      return;
    }

    const result = await db.query(
      `UPDATE telegram_auth_sessions
       SET status = 'verified',
           phone = $1,
           telegram_id = $2,
           first_name = $3,
           last_name = $4
       WHERE telegram_id = $2 AND status = 'pending' AND expires_at > NOW()
       RETURNING id`,
      [
        contactPhone,
        fromId,
        message.contact.first_name ?? message.from?.id?.toString() ?? "Xaridor",
        message.contact.last_name ?? "",
      ],
    );

    if (!result.rowCount) {
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: "Ulanish sessiyasi topilmadi yoki muddati tugagan. MyBusiness ilovasidan qaytadan boshlang.",
      });
      return;
    }

    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "Telefon raqamingiz tasdiqlandi. Endi ilovaga qayting va ismingizni kiriting.",
    });
  }
}

export function registerTelegramAuthRoutes(app: Express): void {
  app.post("/api/v1/auth/telegram/session", async (_req: Request, res: Response) => {
    if (!botToken || !botUsername) {
      res.status(503).json({ message: "Telegram authentication is not configured." });
      return;
    }

    try {
      const db = requireDatabase();
      const id = randomUUID();
      await db.query(
        `INSERT INTO telegram_auth_sessions (id, expires_at)
         VALUES ($1, NOW() + INTERVAL '10 minutes')`,
        [id],
      );

      res.setHeader("Cache-Control", "no-store");
      res.json({
        sessionId: id,
        telegramUrl: `https://t.me/${botUsername}?start=${encodeURIComponent(id)}`,
        expiresIn: 600,
      });
    } catch (error) {
      console.error("Telegram auth session creation failed", error);
      res.status(500).json({ message: "Telegram login sessiyasini yaratib bo'lmadi." });
    }
  });

  app.get("/api/v1/auth/telegram/session/:id", async (req: Request, res: Response) => {
    try {
      const db = requireDatabase();
      const result = await db.query(
        `SELECT id, status, phone, first_name, last_name
         FROM telegram_auth_sessions
         WHERE id = $1`,
        [req.params.id],
      );
      const row = result.rows[0] as { id: string; status: string; phone?: string; first_name?: string; last_name?: string } | undefined;
      if (!row) {
        res.status(404).json({ message: "Login sessiyasi topilmadi." });
        return;
      }
      if (row.status === "pending") {
        const expired = await db.query(
          `UPDATE telegram_auth_sessions SET status = 'expired'
           WHERE id = $1 AND status = 'pending' AND expires_at <= NOW()
           RETURNING id`,
          [req.params.id],
        );
        if (expired.rowCount) {
          res.json({ status: "expired" });
          return;
        }
      }
      res.setHeader("Cache-Control", "no-store");
      const existing = row.phone
        ? await db.query(
            `SELECT id FROM customer_users WHERE phone = $1 LIMIT 1`,
            [row.phone],
          )
        : { rowCount: 0 };
      res.json({ status: row.status, phone: row.phone ?? null, existingUser: Boolean(existing.rowCount) });
    } catch (error) {
      console.error("Telegram auth session lookup failed", error);
      res.status(500).json({ message: "Login holatini tekshirib bo'lmadi." });
    }
  });

  app.post("/api/v1/auth/telegram/complete", async (req: Request, res: Response) => {
    const sessionId = String(req.body?.sessionId ?? "").trim();
    const firstName = String(req.body?.firstName ?? "").trim();
    const lastName = String(req.body?.lastName ?? "").trim();

    if (!sessionId) {
      res.status(400).json({ message: "Login sessiyasi kerak." });
      return;
    }

    try {
      const db = requireDatabase();
      const session = await db.query(
        `SELECT phone, telegram_id, status
         FROM telegram_auth_sessions
         WHERE id = $1 AND status = 'verified' AND expires_at > NOW()`,
        [sessionId],
      );
      const row = session.rows[0] as { phone: string; telegram_id: number; status: string } | undefined;
      if (!row) {
        res.status(400).json({ message: "Telegram tasdiqlashi topilmadi yoki sessiya tugagan." });
        return;
      }

      const existingUser = await db.query(
        `SELECT id, phone, first_name, last_name
         FROM customer_users
         WHERE phone = $1
         LIMIT 1`,
        [row.phone],
      );

      const token = randomUUID();
      let user;
      if (existingUser.rowCount) {
        user = await db.query(
          `UPDATE customer_users
           SET telegram_id = $2,
               auth_token = $3,
               updated_at = NOW()
           WHERE phone = $1
           RETURNING id, phone, first_name, last_name`,
          [row.phone, row.telegram_id, token],
        );
      } else {
        if (!firstName) {
          res.status(400).json({ message: "Yangi akkaunt uchun ism kerak." });
          return;
        }
        user = await db.query(
          `INSERT INTO customer_users (phone, telegram_id, first_name, last_name, auth_token)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, phone, first_name, last_name`,
          [row.phone, row.telegram_id, firstName, lastName, token],
        );
      }

      await db.query(
        `UPDATE telegram_auth_sessions
         SET status = 'completed', completed_at = NOW(), first_name = $2, last_name = $3
         WHERE id = $1`,
        [sessionId, firstName, lastName],
      );

      res.setHeader("Cache-Control", "no-store");
      res.json({ token, user: user.rows[0] });
    } catch (error) {
      console.error("Telegram auth completion failed", error);
      res.status(500).json({ message: "Hisobni yaratib bo'lmadi." });
    }
  });

  app.post("/api/v1/auth/telegram/webhook", async (req: Request, res: Response) => {
    if (webhookSecret && req.header("x-telegram-bot-api-secret-token") !== webhookSecret) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    res.sendStatus(200);
    try {
      await handleTelegramUpdate(req.body as TelegramUpdate);
    } catch (error) {
      console.error("Telegram webhook processing failed", error);
    }
  });
}

export async function configureTelegramWebhook(): Promise<void> {
  if (!botToken || !publicApiUrl) {
    console.log("Telegram auth webhook not configured: set TELEGRAM_BOT_TOKEN and PUBLIC_API_URL.");
    return;
  }

  const webhookUrl = `${publicApiUrl}/api/v1/auth/telegram/webhook`;
  await telegramApi("setWebhook", {
    url: webhookUrl,
    secret_token: webhookSecret || undefined,
    allowed_updates: ["message"],
  });
  console.log(`Telegram auth webhook configured: ${webhookUrl}`);
}
