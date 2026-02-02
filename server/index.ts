import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import { serveStatic } from "./static";
import { setupAdminAuth, requireAdmin } from "./adminAuth";
import { registerRoutes } from "./routes";

const app = express();
const httpServer = createServer(app);

// Render / Reverse Proxy: wichtig für Cookies/Sessions
app.set("trust proxy", 1);

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Admin login/session
setupAdminAuth(app);

// Protect API (everything under /api except auth + health)
app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();

  const open = new Set([
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/user",
    "/api/health",
  ]);

  if (open.has(req.path)) return next();
  return requireAdmin(req, res, next);
});

// Routes
(async () => {
  await registerRoutes(app);

  // Error handler (DON’T throw after response)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[API ERROR]", err);
    if (res.headersSent) return;
    res.status(err?.status || 500).json({ message: err?.message || "Internal Server Error" });
  });

  // Serve frontend build
  serveStatic(app);

  const port = parseInt(process.env.PORT || "10000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`[express] serving on port ${port}`);
  });
})();
