import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import session from "express-session";
import MemoryStore from "memorystore";
import { generateJobPdf, generateInvoicePdf } from "./pdf";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";
import { db } from "./db";
import { jobs, invoiceItems } from "@shared/schema";
import { and, eq, between } from "drizzle-orm";

const SessionStore = MemoryStore(session);

declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
    userEmail: string;
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use(
    session({
      store: new SessionStore({ checkPeriod: 86400000 }),
      secret: process.env.SESSION_SECRET || "default_secret_please_change",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.session.isAdmin) return next();
    res.status(401).json({ message: "Unauthorized" });
  };

  // ✅ Health: echter DB Ping (nicht storage.getSettings)
  app.get("/api/health", async (_req, res) => {
    try {
      // Drizzle execute raw SQL ping
      await db.execute("select 1");
      res.json({ ok: true, db: true });
    } catch (e: any) {
      res.json({ ok: true, db: false, error: String(e?.message ?? e) });
    }
  });

  // AUTH
  app.post(api.auth.login.path, async (req, res) => {
    const { email, password } = api.auth.login.input.parse(req.body);

    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      req.session.isAdmin = true;
      req.session.userEmail = email;
      return res.json({ message: "Logged in successfully" });
    }

    res.status(401).json({ message: "Invalid credentials" });
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy(() => res.json({ message: "Logged out" }));
  });

  app.get(api.auth.me.path, (req, res) => {
    if (req.session.isAdmin) return res.json({ email: req.session.userEmail });
    res.status(401).json({ message: "Unauthorized" });
  });

  // Protect all other /api routes
  app.use("/api", (req, res, next) => {
    if (req.path === "/login" || req.path === "/logout" || req.path === "/me" || req.path === "/health") {
      return next();
    }
    requireAuth(req, res, next);
  });

  // PROPERTY MANAGERS
  app.get(api.propertyManagers.list.path, async (_req, res) => {
    const data = await storage.getPropertyManagers();
    res.json(data);
  });

  app.post(api.propertyManagers.create.path, async (req, res) => {
    const input = api.propertyManagers.create.input.parse(req.body);
    const data = await storage.createPropertyManager(input);
    res.status(201).json(data);
  });

  app.put(api.propertyManagers.update.path, async (req, res) => {
    const input = api.propertyManagers.update.input.parse(req.body);
    const data = await storage.updatePropertyManager(Number(req.params.id), input);
    res.json(data);
  });

  app.delete(api.propertyManagers.delete.path, async (req, res) => {
    await storage.deletePropertyManager(Number(req.params.id));
    res.status(204).send();
  });

  // PRIVATE CUSTOMERS
  app.get(api.privateCustomers.list.path, async (_req, res) => {
    const data = await storage.getPrivateCustomers();
    res.json(data);
  });

  app.post(api.privateCustomers.create.path, async (req, res) => {
    const input = api.privateCustomers.create.input.parse(req.body);
    const data = await storage.createPrivateCustomer(input);
    res.status(201).json(data);
  });

  app.put(api.privateCustomers.update.path, async (req, res) => {
    const input = api.privateCustomers.update.input.parse(req.body);
    const data = await storage.updatePrivateCustomer(Number(req.params.id), input);
    res.json(data);
  });

  app.delete(api.privateCustomers.delete.path, async (req, res) => {
    await storage.deletePrivateCustomer(Number(req.params.id));
    res.status(204).send();
  });

  // COMPANIES
  app.get(api.companies.list.path, async (_req, res) => {
    const data = await storage.getCompanies();
    res.json(data);
  });

  app.post(api.companies.create.path, async (req, res) => {
    const input = api.companies.create.input.parse(req.body);
    const data = await storage.createCompany(input);
    res.status(201).json(data);
  });

  app.put(api.companies.update.path, async (req, res) => {
    const input = api.companies.update.input.parse(req.body);
    const data = await storage.updateCompany(Number(req.params.id), input);
    res.json(data);
  });

  app.delete(api.companies.delete.path, async (req, res) => {
    await storage.deleteCompany(Number(req.params.id));
    res.status(204).send();
  });

  // JOBS
  app.get(api.jobs.list.path, async (_req, res) => {
    const data = await storage.getJobs();
    res.json(data);
  });

  app.get(api.jobs.get.path, async (req, res) => {
    const data = await storage.getJob(Number(req.params.id));
    if (!data) return res.status(404).json({ message: "Job not found" });
    res.json(data);
  });

  app.post(api.jobs.create.path, async (req, res) => {
    const input = api.jobs.create.input.parse(req.body);
    const data = await storage.createJob(input);
    res.status(201).json(data);
  });

  app.put(api.jobs.update.path, async (req, res) => {
    const input = api.jobs.update.input.parse(req.body);
    const data = await storage.updateJob(Number(req.params.id), input);
    res.json(data);
  });

  app.post(api.jobs.generatePdf.path, async (req, res) => {
    const job = await storage.getJob(Number(req.params.id));
    if (!job) return res.status(404).json({ message: "Job not found" });

    const pdfBytes = await generateJobPdf(job, (job as any).company, (job as any).propertyManager, (job as any).privateCustomer);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=job-${(job as any).jobNumber}.pdf`);
    res.send(Buffer.from(pdfBytes));
  });

  // EMAIL deaktiviert (du willst manuell)
  app.post(api.jobs.sendEmail.path, async (_req, res) => {
    res.status(501).json({
      success: false,
      message: "E-Mail Versand ist deaktiviert. Bitte manuell per E-Mail/Telefon senden.",
    });
  });

  // INVOICES
  app.get(api.invoices.list.path, async (_req, res) => {
    const data = await storage.getInvoices();
    res.json(data);
  });

  // ✅ Generierung: 49€ pro erledigtem Job (Netto)
  app.post(api.invoices.generate.path, async (req, res) => {
    const { monthYear } = api.invoices.generate.input.parse(req.body);
    const date = parseISO(`${monthYear}-01`);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const doneJobs = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.status, "done"), between(jobs.dateTime, start, end)));

    if (doneJobs.length === 0) {
      return res.json({ generatedCount: 0, message: "No done jobs found for this month" });
    }

    const existingItems = await db.select({ jobId: invoiceItems.jobId }).from(invoiceItems);
    const alreadyInvoicedIds = new Set(existingItems.map((i) => i.jobId));

    const jobsToInvoice = doneJobs.filter((j) => !alreadyInvoicedIds.has(j.id));
    if (jobsToInvoice.length === 0) {
      return res.json({ generatedCount: 0, message: "All done jobs for this month are already invoiced" });
    }

    const jobsByCompany = new Map<number, typeof jobsToInvoice>();
    for (const job of jobsToInvoice) {
      if (!jobsByCompany.has(job.companyId)) jobsByCompany.set(job.companyId, []);
      jobsByCompany.get(job.companyId)!.push(job);
    }

    let generatedCount = 0;
    const PRICE_PER_JOB_NET = 49;

    for (const [companyId, companyJobs] of jobsByCompany.entries()) {
      const totalAmount = companyJobs.length * PRICE_PER_JOB_NET;
      const invoiceNumber = `${monthYear.replace("-", "")}-${companyId}-${Date.now().toString().slice(-4)}`;

      await storage.createInvoice(
        {
          invoiceNumber,
          monthYear,
          companyId,
          status: "unpaid",
          totalAmount: totalAmount.toString(),
          createdAt: new Date(),
          sentAt: null,
          paidAt: null,
        } as any,
        companyJobs.map((j) => ({ jobId: j.id, amount: PRICE_PER_JOB_NET }))
      );

      generatedCount++;
    }

    res.json({ generatedCount, message: `Generated ${generatedCount} invoices` });
  });

  app.post(api.invoices.markPaid.path, async (req, res) => {
    const data = await storage.updateInvoice(Number(req.params.id), {
      status: "paid",
      paidAt: new Date(),
    } as any);
    res.json(data);
  });

  app.post(api.invoices.generatePdf.path, async (req, res) => {
    const invoice = await storage.getInvoice(Number(req.params.id));
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const items = (invoice as any).items.map((item: any) => ({
      ...item,
      job: item.job,
    }));

    const pdfBytes = await generateInvoicePdf(invoice as any, (invoice as any).company, items);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${(invoice as any).invoiceNumber}.pdf`);
    res.send(Buffer.from(pdfBytes));
  });

  // EMAIL deaktiviert (du willst manuell)
  app.post(api.invoices.sendEmail.path, async (_req, res) => {
    res.status(501).json({
      success: false,
      message: "E-Mail Versand ist deaktiviert. Bitte manuell per E-Mail/Telefon senden.",
    });
  });

  // STATS
  app.get(api.stats.dashboard.path, async (_req, res) => {
    const data = await storage.getStats();
    res.json(data);
  });

  return httpServer;
}
