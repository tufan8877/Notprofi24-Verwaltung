import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import session from "express-session";
import MemoryStore from "memorystore";
import { api } from "@shared/routes";
import { storage } from "./storage";
import { db } from "./db";
import { generateJobPdf, generateInvoicePdf } from "./pdf";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";
import { jobs, invoiceItems } from "@shared/schema";
import { and, eq, between, sql } from "drizzle-orm";

const SessionStore = MemoryStore(session);

// Session Types
declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
    userEmail: string;
  }
}

// ✅ Helper: Requests dürfen nicht unendlich hängen
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: NodeJS.Timeout;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error(`TIMEOUT after ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t!)) as Promise<T>;
}

// ✅ Helper: Async handler wrapper → gibt JSON Fehler statt „hängt“
function asyncHandler(fn: (req: Request, res: Response) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Sessions
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

  // Auth Middleware
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.session.isAdmin) return next();
    res.status(401).json({ message: "Unauthorized" });
  };

  // ✅ HEALTH: echter DB Ping + Timeout + Klartext
  app.get(
    "/api/health",
    asyncHandler(async (_req, res) => {
      try {
        await withTimeout(db.execute(sql`select 1`), 8000, "db select 1");
        res.json({ ok: true, db: true });
      } catch (e: any) {
        res.status(200).json({ ok: true, db: false, error: String(e?.message ?? e) });
      }
    })
  );

  // ✅ DIAGNOSE: zeigt ob Tabellen existieren (oder welcher Fehler kommt)
  app.get(
    "/api/diagnose",
    asyncHandler(async (_req, res) => {
      try {
        await withTimeout(db.execute(sql`select 1`), 8000, "db ping");
        // Prüfen ob Tabellen existieren
        const tables = await withTimeout(
          db.execute(sql`
            select table_name
            from information_schema.tables
            where table_schema = 'public'
            order by table_name
          `),
          8000,
          "list tables"
        );
        res.json({ ok: true, tables });
      } catch (e: any) {
        res.status(200).json({ ok: false, error: String(e?.message ?? e) });
      }
    })
  );

  // AUTH
  app.post(
    api.auth.login.path,
    asyncHandler(async (req, res) => {
      const { email, password } = api.auth.login.input.parse(req.body);

      if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        req.session.userEmail = email;
        return res.json({ message: "Logged in successfully" });
      }

      res.status(401).json({ message: "Invalid credentials" });
    })
  );

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy(() => res.json({ message: "Logged out" }));
  });

  app.get(api.auth.me.path, (req, res) => {
    if (req.session.isAdmin) return res.json({ email: req.session.userEmail });
    res.status(401).json({ message: "Unauthorized" });
  });

  // Protect /api
  app.use("/api", (req, res, next) => {
    if (
      req.path === "/login" ||
      req.path === "/logout" ||
      req.path === "/me" ||
      req.path === "/health" ||
      req.path === "/diagnose"
    ) {
      return next();
    }
    requireAuth(req, res, next);
  });

  // PROPERTY MANAGERS
  app.get(
    api.propertyManagers.list.path,
    asyncHandler(async (_req, res) => {
      const data = await withTimeout(storage.getPropertyManagers(), 12000, "getPropertyManagers");
      res.json(data);
    })
  );

  app.post(
    api.propertyManagers.create.path,
    asyncHandler(async (req, res) => {
      const input = api.propertyManagers.create.input.parse(req.body);
      const data = await withTimeout(storage.createPropertyManager(input), 12000, "createPropertyManager");
      res.status(201).json(data);
    })
  );

  app.put(
    api.propertyManagers.update.path,
    asyncHandler(async (req, res) => {
      const input = api.propertyManagers.update.input.parse(req.body);
      const data = await withTimeout(storage.updatePropertyManager(Number(req.params.id), input), 12000, "updatePropertyManager");
      res.json(data);
    })
  );

  app.delete(
    api.propertyManagers.delete.path,
    asyncHandler(async (req, res) => {
      await withTimeout(storage.deletePropertyManager(Number(req.params.id)), 12000, "deletePropertyManager");
      res.status(204).send();
    })
  );

  // PRIVATE CUSTOMERS
  app.get(
    api.privateCustomers.list.path,
    asyncHandler(async (_req, res) => {
      const data = await withTimeout(storage.getPrivateCustomers(), 12000, "getPrivateCustomers");
      res.json(data);
    })
  );

  app.post(
    api.privateCustomers.create.path,
    asyncHandler(async (req, res) => {
      const input = api.privateCustomers.create.input.parse(req.body);
      const data = await withTimeout(storage.createPrivateCustomer(input), 12000, "createPrivateCustomer");
      res.status(201).json(data);
    })
  );

  app.put(
    api.privateCustomers.update.path,
    asyncHandler(async (req, res) => {
      const input = api.privateCustomers.update.input.parse(req.body);
      const data = await withTimeout(storage.updatePrivateCustomer(Number(req.params.id), input), 12000, "updatePrivateCustomer");
      res.json(data);
    })
  );

  app.delete(
    api.privateCustomers.delete.path,
    asyncHandler(async (req, res) => {
      await withTimeout(storage.deletePrivateCustomer(Number(req.params.id)), 12000, "deletePrivateCustomer");
      res.status(204).send();
    })
  );

  // COMPANIES
  app.get(
    api.companies.list.path,
    asyncHandler(async (_req, res) => {
      const data = await withTimeout(storage.getCompanies(), 12000, "getCompanies");
      res.json(data);
    })
  );

  app.post(
    api.companies.create.path,
    asyncHandler(async (req, res) => {
      const input = api.companies.create.input.parse(req.body);
      const data = await withTimeout(storage.createCompany(input), 12000, "createCompany");
      res.status(201).json(data);
    })
  );

  app.put(
    api.companies.update.path,
    asyncHandler(async (req, res) => {
      const input = api.companies.update.input.parse(req.body);
      const data = await withTimeout(storage.updateCompany(Number(req.params.id), input), 12000, "updateCompany");
      res.json(data);
    })
  );

  app.delete(
    api.companies.delete.path,
    asyncHandler(async (req, res) => {
      await withTimeout(storage.deleteCompany(Number(req.params.id)), 12000, "deleteCompany");
      res.status(204).send();
    })
  );

  // JOBS
  app.get(
    api.jobs.list.path,
    asyncHandler(async (_req, res) => {
      const data = await withTimeout(storage.getJobs(), 12000, "getJobs");
      res.json(data);
    })
  );

  app.get(
    api.jobs.get.path,
    asyncHandler(async (req, res) => {
      const data = await withTimeout(storage.getJob(Number(req.params.id)), 12000, "getJob");
      if (!data) return res.status(404).json({ message: "Job not found" });
      res.json(data);
    })
  );

  app.post(
    api.jobs.create.path,
    asyncHandler(async (req, res) => {
      const input = api.jobs.create.input.parse(req.body);
      const data = await withTimeout(storage.createJob(input), 12000, "createJob");
      res.status(201).json(data);
    })
  );

  app.put(
    api.jobs.update.path,
    asyncHandler(async (req, res) => {
      const input = api.jobs.update.input.parse(req.body);
      const data = await withTimeout(storage.updateJob(Number(req.params.id), input), 12000, "updateJob");
      res.json(data);
    })
  );

  app.post(
    api.jobs.generatePdf.path,
    asyncHandler(async (req, res) => {
      const job = await withTimeout(storage.getJob(Number(req.params.id)), 12000, "getJob for pdf");
      if (!job) return res.status(404).json({ message: "Job not found" });

      const pdfBytes = await withTimeout(
        generateJobPdf(job as any, (job as any).company, (job as any).propertyManager, (job as any).privateCustomer),
        15000,
        "generateJobPdf"
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=job-${(job as any).jobNumber}.pdf`);
      res.send(Buffer.from(pdfBytes));
    })
  );

  // EMAIL deaktiviert
  app.post(api.jobs.sendEmail.path, (_req, res) => {
    res.status(501).json({
      success: false,
      message: "E-Mail Versand ist deaktiviert. Bitte manuell per E-Mail/Telefon senden.",
    });
  });

  // INVOICES
  app.get(
    api.invoices.list.path,
    asyncHandler(async (_req, res) => {
      const data = await withTimeout(storage.getInvoices(), 12000, "getInvoices");
      res.json(data);
    })
  );

  // ✅ Monatsabrechnung: 49€ netto pro erledigtem Job
  app.post(
    api.invoices.generate.path,
    asyncHandler(async (req, res) => {
      const { monthYear } = api.invoices.generate.input.parse(req.body);
      const date = parseISO(`${monthYear}-01`);
      const start = startOfMonth(date);
      const end = endOfMonth(date);

      const doneJobs = await withTimeout(
        db
          .select()
          .from(jobs)
          .where(and(eq(jobs.status, "done"), between(jobs.dateTime, start, end))),
        15000,
        "select done jobs"
      );

      if (doneJobs.length === 0) {
        return res.json({ generatedCount: 0, message: "No done jobs found for this month" });
      }

      const existingItems = await withTimeout(
        db.select({ jobId: invoiceItems.jobId }).from(invoiceItems),
        15000,
        "select invoice items"
      );
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

      const PRICE_PER_JOB_NET = 49;

      let generatedCount = 0;
      for (const [companyId, companyJobs] of jobsByCompany.entries()) {
        const totalAmount = companyJobs.length * PRICE_PER_JOB_NET;
        const invoiceNumber = `${monthYear.replace("-", "")}-${companyId}-${Date.now().toString().slice(-4)}`;

        await withTimeout(
          storage.createInvoice(
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
          ),
          15000,
          "createInvoice"
        );

        generatedCount++;
      }

      res.json({ generatedCount, message: `Generated ${generatedCount} invoices` });
    })
  );

  app.post(
    api.invoices.markPaid.path,
    asyncHandler(async (req, res) => {
      const data = await withTimeout(
        storage.updateInvoice(Number(req.params.id), { status: "paid", paidAt: new Date() } as any),
        12000,
        "markPaid"
      );
      res.json(data);
    })
  );

  app.post(
    api.invoices.generatePdf.path,
    asyncHandler(async (req, res) => {
      const invoice = await withTimeout(storage.getInvoice(Number(req.params.id)), 12000, "getInvoice");
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });

      const items = (invoice as any).items.map((it: any) => ({ ...it, job: it.job }));
      const pdfBytes = await withTimeout(
        generateInvoicePdf(invoice as any, (invoice as any).company, items),
        15000,
        "generateInvoicePdf"
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=invoice-${(invoice as any).invoiceNumber}.pdf`);
      res.send(Buffer.from(pdfBytes));
    })
  );

  // EMAIL deaktiviert
  app.post(api.invoices.sendEmail.path, (_req, res) => {
    res.status(501).json({
      success: false,
      message: "E-Mail Versand ist deaktiviert. Bitte manuell per E-Mail/Telefon senden.",
    });
  });

  // STATS
  app.get(
    api.stats.dashboard.path,
    asyncHandler(async (_req, res) => {
      const data = await withTimeout(storage.getStats(), 12000, "getStats");
      res.json(data);
    })
  );

  // ✅ Globaler Error Handler → Frontend sieht Fehler statt endlos loading
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[API ERROR]", err);
    const message = String(err?.message ?? err);
    res.status(500).json({ message: "Server error", error: message });
  });

  return httpServer;
}
