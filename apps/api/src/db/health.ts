import { sql } from "drizzle-orm";
import { db } from "./index.js";

export async function checkDatabase(): Promise<void> {
  await db.execute(sql`select 1`);
}
