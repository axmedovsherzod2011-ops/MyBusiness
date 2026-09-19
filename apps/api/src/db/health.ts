import { sql } from "drizzle-orm";
import { db } from "./index.js";

export async function checkDatabase() {
  if (!db) {
    throw new Error("DATABASE_URL is not configured");
  }

  await db.execute(sql`select 1`);
  return true;
}
