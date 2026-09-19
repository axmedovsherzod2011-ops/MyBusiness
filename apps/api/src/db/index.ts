import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config.js";

export const pool = env.DATABASE_URL
  ? new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    })
  : null;

export const db = pool ? drizzle(pool) : null;
