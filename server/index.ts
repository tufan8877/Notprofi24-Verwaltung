import express from "express";
import { createServer } from "http";
import { serveStatic } from "./static";
import { pool, hasDatabaseUrl } from "./db";

const app = express();
app.set("trust proxy", 1);

process.on("unhandledRejection", (r) => console.error("[unhandledRejection]", r));
process.on("uncaughtException", (e) => console.error("[uncaughtException]", e));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health endpoint – works even without DB
app.get("/api/health", async (_req, res) => {
  if (!hasDatabaseUrl || !pool) {
    return res.json({ ok: true, db: false });
  }
  try {
    await pool.query("select 1");
    return res.json({ ok: true, db: true });
  } catch (e) {
    console.error("[health db error]", e);
    return res.json({ ok: true, db: false });
  }
});

// Optional ping
app.get("/api/ping", (_req, res) => res.json({ ok: true }));

// Serve frontend
serveStatic(app);

const server = createServer(app);
const port = parseInt(process.env.PORT || "10000", 10);

server.listen(port, "0.0.0.0", () => {
  console.log(`[express] serving on port ${port}`);
});
