import type { Express } from "express";
import path from "path";
import express from "express";

export function serveStatic(app: Express) {
  const publicDir = path.join(process.cwd(), "dist", "public");

  // Static assets (CSS/JS)
  app.use(express.static(publicDir));

  // SPA fallback:
  // IMPORTANT: Use "/*" (NOT "*"), because "*" can crash with newer path-to-regexp setups.
  app.get("/*", (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ message: "Not Found" });
    }
    return res.sendFile(path.join(publicDir, "index.html"));
  });
}
