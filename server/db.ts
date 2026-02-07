import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const { Pool } = pg;

// DATABASE_URL kann beim Build fehlen → darf hier NICHT crashen
export const hasDatabaseUrl =
  typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;

// Wenn keine DATABASE_URL vorhanden ist (z.B. Build-Time),
// verwenden wir eine Dummy-URL, damit der Build nicht abbricht.
// Zur Laufzeit auf Render MUSS DATABASE_URL gesetzt sein.
const connectionString = hasDatabaseUrl
  ? process.env.DATABASE_URL!
  : "postgresql://postgres:postgres@localhost:5432/postgres";

export const pool = new Pool({
  connectionString,
  // Supabase/Render SSL pragmatisch
  ssl: { rejectUnauthorized: false },
});

// ✅ DAS hat gefehlt: db Export für Drizzle
export const db = drizzle(pool, { schema });
