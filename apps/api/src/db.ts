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
