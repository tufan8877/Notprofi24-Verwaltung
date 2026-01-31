import express, { type Express } from "express";
import fs from "fs";
import path from "path";

// Render-friendly SPA static serving.
// - Serves built assets from dist/public
// - Any non-API route falls back to index.html (React router)
export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}. Build the client first (npm run build).`,
    );
  }

  app.use(express.static(distPath));

  // SPA fallback: let the client router handle all non-API routes
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ message: "Not Found" });
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
