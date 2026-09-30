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
        sku VARCHAR(40) NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        price NUMERIC(14, 2) NOT NULL CHECK (price >= 0),
        image_url TEXT NOT NULL DEFAULT '',
        image_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
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
        sku VARCHAR(40) NOT NULL DEFAULT '',
        image_url TEXT NOT NULL DEFAULT '',
        price NUMERIC(14,2) NOT NULL CHECK (price >= 0),
        quantity INTEGER NOT NULL CHECK (quantity > 0)
      );

      CREATE TABLE IF NOT EXISTS seller_chats (
        id BIGSERIAL PRIMARY KEY,
        customer_user_id BIGINT REFERENCES customer_users(id) ON DELETE SET NULL,
        product_id BIGINT REFERENCES marketplace_products(id) ON DELETE SET NULL,
        customer_name VARCHAR(200) NOT NULL DEFAULT '',
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        seller_last_read_at TIMESTAMPTZ,
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

      CREATE TABLE IF NOT EXISTS marketplace_promotions (
        id BIGSERIAL PRIMARY KEY,
        product_id BIGINT NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
        discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent < 100),
        starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ends_at TIMESTAMPTZ,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS marketplace_promotions_product_idx
        ON marketplace_promotions (product_id, active, starts_at, ends_at);

      CREATE INDEX IF NOT EXISTS seller_chats_updated_at_idx
        ON seller_chats (updated_at DESC);

      CREATE INDEX IF NOT EXISTS seller_chat_messages_chat_id_idx
        ON seller_chat_messages (chat_id, created_at ASC);

      CREATE TABLE IF NOT EXISTS customer_favorites (
        customer_user_id BIGINT NOT NULL REFERENCES customer_users(id) ON DELETE CASCADE,
        product_id BIGINT NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (customer_user_id, product_id)
      );
      CREATE INDEX IF NOT EXISTS customer_favorites_user_idx
        ON customer_favorites (customer_user_id, created_at DESC);

      ALTER TABLE seller_chats
        ADD COLUMN IF NOT EXISTS seller_last_read_at TIMESTAMPTZ;

      ALTER TABLE customer_users
        ADD COLUMN IF NOT EXISTS auth_token UUID,
        ADD COLUMN IF NOT EXISTS auth_token_expires_at TIMESTAMPTZ;
      CREATE UNIQUE INDEX IF NOT EXISTS customer_users_auth_token_idx
        ON customer_users (auth_token);
      UPDATE customer_users SET auth_token_expires_at = NOW() + INTERVAL '30 days'
        WHERE auth_token IS NOT NULL AND auth_token_expires_at IS NULL;

      ALTER TABLE marketplace_products
        ADD COLUMN IF NOT EXISTS sku VARCHAR(40) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

      UPDATE marketplace_products SET image_urls = CASE
        WHEN COALESCE(array_length(image_urls, 1), 0) = 0 AND image_url <> '' THEN ARRAY[image_url]
        ELSE image_urls
      END;

      UPDATE marketplace_products SET sku = 'MB-' || LPAD(id::text, 6, '0') WHERE sku = '';
      CREATE UNIQUE INDEX IF NOT EXISTS marketplace_products_sku_idx ON marketplace_products (sku);

      ALTER TABLE marketplace_order_items
        ADD COLUMN IF NOT EXISTS sku VARCHAR(40) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';

      ALTER TABLE marketplace_orders
        ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
        ADD COLUMN IF NOT EXISTS delivery_address TEXT NOT NULL DEFAULT '';

      CREATE TABLE IF NOT EXISTS marketplace_banners (
        id BIGSERIAL PRIMARY KEY,
        desktop_image_url TEXT NOT NULL,
        mobile_image_url TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS marketplace_banners_active_idx
        ON marketplace_banners (active, sort_order, created_at DESC);

      ALTER TABLE marketplace_banners
        ADD COLUMN IF NOT EXISTS target_type VARCHAR(30) NOT NULL DEFAULT 'all-products',
        ADD COLUMN IF NOT EXISTS target_value TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7) NOT NULL DEFAULT '#f4f1f7';

      CREATE TABLE IF NOT EXISTS marketplace_landing_pages (
        id BIGSERIAL PRIMARY KEY,
        slug VARCHAR(120) NOT NULL UNIQUE,
        title VARCHAR(180) NOT NULL,
        subtitle VARCHAR(300) NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        offer_text VARCHAR(500) NOT NULL DEFAULT '',
        product_ids BIGINT[] NOT NULL DEFAULT ARRAY[]::BIGINT[],
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS marketplace_landing_pages_active_idx
        ON marketplace_landing_pages (active, updated_at DESC);
    `).then(() => undefined).catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }
  await initializationPromise;
}
