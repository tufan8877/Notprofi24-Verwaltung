import express from "express";
import { createServer } from "http";
import { serveStatic } from "./static";
import { registerRoutes } from "./routes";

const app = express();
app.set("trust proxy", 1);

process.on("unhandledRejection", (r) => console.error("[unhandledRejection]", r));
process.on("uncaughtException", (e) => console.error("[uncaughtException]", e));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Create HTTP server first (needed for websockets/future extension)
const server = createServer(app);

// Register API routes (auth + CRUD). Without this, /api/login won't exist.
await registerRoutes(server, app);

// Serve frontend (built assets)
serveStatic(app);

const port = parseInt(process.env.PORT || "10000", 10);

server.listen(port, "0.0.0.0", () => {
  console.log(`[express] serving on port ${port}`);
});
