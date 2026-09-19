import { sql } from "drizzle-orm";
import { db } from "./index.js";

export async function checkDatabase() {
  await db.execute(sql`select 1`);
  return true;
}
