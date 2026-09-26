import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

export const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : null;

let initializationPromise: Promise<void> | null = null;

export function requireDatabase(): Pool {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return pool;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  if (!pool) return false;
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function initializeDatabase(): Promise<void> {
  if (!pool) return;
  if (!initializationPromise) {
    initializationPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS marketplace_products (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(180) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price NUMERIC(14, 2) NOT NULL CHECK (price >= 0),
        image_url TEXT NOT NULL DEFAULT '',
        stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS marketplace_products_created_at_idx
        ON marketplace_products (created_at DESC);

      CREATE TABLE IF NOT EXISTS customer_users (
        id BIGSERIAL PRIMARY KEY,
        phone VARCHAR(32) NOT NULL UNIQUE,
        telegram_id BIGINT UNIQUE,
        auth_token UUID UNIQUE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS telegram_auth_sessions (
        id UUID PRIMARY KEY,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        phone VARCHAR(32),
        telegram_id BIGINT,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS telegram_auth_sessions_expires_at_idx
        ON telegram_auth_sessions (expires_at);



      CREATE TABLE IF NOT EXISTS marketplace_orders (
        id BIGSERIAL PRIMARY KEY,
        customer_user_id BIGINT REFERENCES customer_users(id) ON DELETE SET NULL,
        customer_name VARCHAR(200) NOT NULL DEFAULT '',
        customer_phone VARCHAR(32) NOT NULL DEFAULT '',
        status VARCHAR(30) NOT NULL DEFAULT 'new',
        total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS marketplace_orders_status_idx
        ON marketplace_orders (status, created_at DESC);

      CREATE TABLE IF NOT EXISTS marketplace_order_items (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
        product_id BIGINT REFERENCES marketplace_products(id) ON DELETE SET NULL,
        product_name VARCHAR(180) NOT NULL,
        price NUMERIC(14,2) NOT NULL CHECK (price >= 0),
        quantity INTEGER NOT NULL CHECK (quantity > 0)
      );

      CREATE TABLE IF NOT EXISTS seller_chats (
        id BIGSERIAL PRIMARY KEY,
        customer_user_id BIGINT REFERENCES customer_users(id) ON DELETE SET NULL,
        product_id BIGINT REFERENCES marketplace_products(id) ON DELETE SET NULL,
        customer_name VARCHAR(200) NOT NULL DEFAULT '',
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS seller_chat_messages (
        id BIGSERIAL PRIMARY KEY,
        chat_id BIGINT NOT NULL REFERENCES seller_chats(id) ON DELETE CASCADE,
        sender_role VARCHAR(20) NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS seller_chats_updated_at_idx
        ON seller_chats (updated_at DESC);

      CREATE INDEX IF NOT EXISTS seller_chat_messages_chat_id_idx
        ON seller_chat_messages (chat_id, created_at ASC);

      ALTER TABLE customer_users
        ADD COLUMN IF NOT EXISTS auth_token UUID;
      CREATE UNIQUE INDEX IF NOT EXISTS customer_users_auth_token_idx
        ON customer_users (auth_token);
    `).then(() => undefined).catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }
  await initializationPromise;
}
