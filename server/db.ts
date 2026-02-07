import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const { Pool } = pg;

const hasDatabaseUrl =
  typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;

// Build darf nicht crashen → Dummy URL falls env fehlt
const connectionString = hasDatabaseUrl
  ? process.env.DATABASE_URL!
  : "postgresql://postgres:postgres@localhost:5432/postgres";

export const pool = new Pool({
  connectionString,

  // ✅ Supabase braucht in vielen Fällen SSL
  ssl: { rejectUnauthorized: false },

  // ✅ verhindert „lädt ewig“
  connectionTimeoutMillis: 7000, // 7s max für connect
  idleTimeoutMillis: 30000,
  max: 5,

  // ✅ Query-Timeout (wenn DB hängt)
  query_timeout: 15000, // 15s
  statement_timeout: 15000, // 15s
});

pool.on("error", (err) => {
  console.error("[pg pool error]", err);
});

export const db = drizzle(pool, { schema });
