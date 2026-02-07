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

const server = createServer(app);

// ✅ API Routes registrieren (Login, CRUD, PDFs, etc.)
await registerRoutes(server, app);

// ✅ Frontend ausliefern
serveStatic(app);

const port = parseInt(process.env.PORT || "10000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`[express] serving on port ${port}`);
});
