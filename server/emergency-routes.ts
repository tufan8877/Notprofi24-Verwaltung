import type { Express, Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { properties, emergencyCalls, propertyManagers, jobs, insertPropertySchema, insertEmergencyCallSchema } from "@shared/schema";
import { z } from "zod";

const idSchema = z.coerce.number().int().positive();
const callUpdate = z.object({
  status: z.enum(["received", "triaged", "dispatched", "resolved", "no_dispatch"]),
  resolution: z.string().nullable().optional(),
  jobId: idSchema.nullable().optional(),
});

function error(res: Response, err: unknown) {
  if (err instanceof z.ZodError) return res.status(400).json({ message: "Ungültige Eingabe", issues: err.issues });
  console.error("Notdienst API error", err);
  return res.status(500).json({ message: "Interner Fehler" });
}

// registerRoutes mounts this AFTER the global /api authentication middleware.
export function registerEmergencyRoutes(app: Express) {
  app.get("/api/properties", async (req, res) => {
    try {
      const managerId = req.query.managerId ? idSchema.parse(req.query.managerId) : null;
      const data = await db.select().from(properties)
        .where(managerId ? eq(properties.propertyManagerId, managerId) : undefined)
        .orderBy(desc(properties.id));
      res.json(data);
    } catch (err) { error(res, err); }
  });
  app.post("/api/properties", async (req, res) => {
    try {
      const data = insertPropertySchema.parse(req.body);
      const manager = await db.select({ id: propertyManagers.id }).from(propertyManagers).where(eq(propertyManagers.id, data.propertyManagerId));
      if (!manager.length) return res.status(400).json({ message: "Hausverwaltung existiert nicht" });
      const [created] = await db.insert(properties).values(data).returning();
      res.status(201).json(created);
    } catch (err) { error(res, err); }
  });
  app.put("/api/properties/:id", async (req, res) => {
    try {
      const id = idSchema.parse(req.params.id);
      const data = insertPropertySchema.partial().parse(req.body);
      const [updated] = await db.update(properties).set(data).where(eq(properties.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "Objekt nicht gefunden" });
      res.json(updated);
    } catch (err) { error(res, err); }
  });
  app.get("/api/emergency-calls", async (_req, res) => {
    try { res.json(await db.select().from(emergencyCalls).orderBy(desc(emergencyCalls.receivedAt)).limit(500)); }
    catch (err) { error(res, err); }
  });
  app.post("/api/emergency-calls", async (req, res) => {
    try {
      const data = insertEmergencyCallSchema.parse(req.body);
      if (data.propertyId) {
        const [property] = await db.select().from(properties).where(eq(properties.id, data.propertyId));
        if (!property || (data.propertyManagerId && property.propertyManagerId !== data.propertyManagerId))
          return res.status(400).json({ message: "Objekt passt nicht zur Hausverwaltung" });
        data.propertyManagerId = property.propertyManagerId;
      }
      const [created] = await db.insert(emergencyCalls).values(data).returning();
      res.status(201).json(created);
    } catch (err) { error(res, err); }
  });
  app.patch("/api/emergency-calls/:id", async (req, res) => {
    try {
      const id = idSchema.parse(req.params.id);
      const data = callUpdate.parse(req.body);
      if (data.jobId) {
        const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, data.jobId));
        if (!job) return res.status(400).json({ message: "Einsatz existiert nicht" });
      }
      const [updated] = await db.update(emergencyCalls).set(data).where(eq(emergencyCalls.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "Anruf nicht gefunden" });
      res.json(updated);
    } catch (err) { error(res, err); }
  });
}
