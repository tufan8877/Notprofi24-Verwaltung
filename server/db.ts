import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const { Pool } = pg;

export const hasDatabaseUrl =
  typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;

// Build-Time darf nicht crashen → Dummy URL
const connectionString = hasDatabaseUrl
  ? process.env.DATABASE_URL!
  : "postgresql://postgres:postgres@localhost:5432/postgres";

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// ✅ Wichtig: db Export (wurde vorher vermisst)
export const db = drizzle(pool, { schema });
