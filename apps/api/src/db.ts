import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

export const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    })
  : null;

let initializationPromise: Promise<void> | null = null;

export function requireDatabase(): Pool {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return pool;
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
    `).then(() => undefined).catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }
  await initializationPromise;
}
