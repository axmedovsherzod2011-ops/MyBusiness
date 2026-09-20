import "dotenv/config";
import { Client } from "pg";

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_bonus boolean NOT NULL DEFAULT false`);
  console.log("[db] order_items.is_bonus migration applied");
} finally {
  await client.end();
}
