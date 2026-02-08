import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import session from "express-session";
import MemoryStore from "memorystore";
import nodemailer from "nodemailer";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";
import { and, eq, between, desc, sql, inArray } from "drizzle-orm";

import { storage } from "./storage";
import { api } from "@shared/routes";
import { generateJobPdf, generateInvoicePdf } from "./pdf";

import { db } from "./db";
import { jobs, invoiceItems, invoices as invoicesTable } from "@shared/schema";

const SessionStore = MemoryStore(session);

const VAT_RATE = 0.2; // 20% USt
const DEFAULT_FEE_NET = 49.0; // Standard Vermittlungsgebühr (Netto) falls Settings leer
const CANCELLATION_FEE_NET = 14.9; // Stornogebühr Netto

// Status-Mapping (je nach Projekt – hier die üblichen Strings)
const STATUS_OPEN = "open";
const STATUS_DONE = "done";
const STATUS_CANCELLED_1 = "cancelled";
const STATUS_CANCELLED_2 = "storniert";

// Alle Status, die in die Abrechnung sollen
const BILLING_STATUSES = [STATUS_OPEN, STATUS_DONE, STATUS_CANCELLED_1, STATUS_CANCELLED_2] as const;

declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
    userEmail: string;
  }
}

function isCancelledStatus(status: string) {
  return status === STATUS_CANCELLED_1 || status === STATUS_CANCELLED_2;
}

async function recalcInvoiceTotals(invoiceId: number) {
  // Summe Netto aus invoiceItems.amount
  const rows = await db
    .select({
      totalNet: sql<number>`coalesce(sum(${invoiceItems.amount}), 0)`,
      count: sql<number>`coalesce(count(*), 0)`,
    })
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId));

  const totalNet = Number(rows?.[0]?.totalNet ?? 0);
  const vat = +(totalNet * VAT_RATE).toFixed(2);
  const totalGross = +(totalNet + vat).toFixed(2);

  await db
    .update(invoicesTable)
    .set({ totalAmount: totalGross.toFixed(2) }) // ✅ totalAmount = BRUTTO
    .where(eq(invoicesTable.id, invoiceId));

  return { totalNet, vat, totalGross, count: Number(rows?.[0]?.count ?? 0) };
}

async function mergeDuplicateInvoices(companyId: number, monthYear: string) {
  const list = await db.query.invoices.findMany({
    where: and(eq(invoicesTable.companyId, companyId), eq(invoicesTable.monthYear, monthYear)),
    orderBy: [desc(invoicesTable.createdAt)],
  });

  if (list.length <= 1) return list[0] ?? null;

  const master = list[0];
  const duplicates = list.slice(1);

  for (const dup of duplicates) {
    await db
      .update(invoiceItems)
      .set({ invoiceId: master.id })
      .where(eq(invoiceItems.invoiceId, dup.id));

    await db.delete(invoicesTable).where(eq(invoicesTable.id, dup.id));
  }

  await recalcInvoiceTotals(master.id);
  return master;
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
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.example.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || "user",
      pass: process.env.SMTP_PASS || "pass",
    },
  });

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.session.isAdmin) return next();
    return res.status(401).json({ message: "Unauthorized" });
  };

  app.get("/api/health", async (_req, res) => {
    try {
      await storage.getStats();
      res.json({ ok: true, db: true });
    } catch {
      res.json({ ok: true, db: false });
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
    return res.status(401).json({ message: "Unauthorized" });
  });

  app.use("/api", (req, res, next) => {
    if (req.path === "/login" || req.path === "/logout" || req.path === "/me" || req.path === "/health") return next();
    return requireAuth(req, res, next);
  });

  // PROPERTY MANAGERS
  app.get(api.propertyManagers.list.path, async (_req, res) => res.json(await storage.getPropertyManagers()));
  app.post(api.propertyManagers.create.path, async (req, res) => {
    const input = api.propertyManagers.create.input.parse(req.body);
    res.status(201).json(await storage.createPropertyManager(input));
  });
  app.put(api.propertyManagers.update.path, async (req, res) => {
    const input = api.propertyManagers.update.input.parse(req.body);
    res.json(await storage.updatePropertyManager(Number(req.params.id), input));
  });
  app.delete(api.propertyManagers.delete.path, async (req, res) => {
    await storage.deletePropertyManager(Number(req.params.id));
    res.status(204).send();
  });

  // PRIVATE CUSTOMERS
  app.get(api.privateCustomers.list.path, async (_req, res) => res.json(await storage.getPrivateCustomers()));
  app.post(api.privateCustomers.create.path, async (req, res) => {
    const input = api.privateCustomers.create.input.parse(req.body);
    res.status(201).json(await storage.createPrivateCustomer(input));
  });
  app.put(api.privateCustomers.update.path, async (req, res) => {
    const input = api.privateCustomers.update.input.parse(req.body);
    res.json(await storage.updatePrivateCustomer(Number(req.params.id), input));
  });
  app.delete(api.privateCustomers.delete.path, async (req, res) => {
    await storage.deletePrivateCustomer(Number(req.params.id));
    res.status(204).send();
  });

  // COMPANIES
  app.get(api.companies.list.path, async (_req, res) => res.json(await storage.getCompanies()));
  app.post(api.companies.create.path, async (req, res) => {
    const input = api.companies.create.input.parse(req.body);
    res.status(201).json(await storage.createCompany(input));
  });
  app.put(api.companies.update.path, async (req, res) => {
    const input = api.companies.update.input.parse(req.body);
    res.json(await storage.updateCompany(Number(req.params.id), input));
  });
  app.delete(api.companies.delete.path, async (req, res) => {
    await storage.deleteCompany(Number(req.params.id));
    res.status(204).send();
  });

  // JOBS
  app.get(api.jobs.list.path, async (_req, res) => res.json(await storage.getJobs()));
  app.get(api.jobs.get.path, async (req, res) => {
    const data = await storage.getJob(Number(req.params.id));
    if (!data) return res.status(404).json({ message: "Job not found" });
    res.json(data);
  });
  app.post(api.jobs.create.path, async (req, res) => {
    const input = api.jobs.create.input.parse(req.body);
    res.status(201).json(await storage.createJob(input));
  });
  app.put(api.jobs.update.path, async (req, res) => {
    const input = api.jobs.update.input.parse(req.body);
    res.json(await storage.updateJob(Number(req.params.id), input));
  });

  app.post(api.jobs.generatePdf.path, async (req, res) => {
    const job = await storage.getJob(Number(req.params.id));
    if (!job) return res.status(404).json({ message: "Job not found" });

    const pdfBytes = await generateJobPdf(job as any, (job as any).company, (job as any).propertyManager, (job as any).privateCustomer);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=job-${(job as any).jobNumber}.pdf`);
    res.send(Buffer.from(pdfBytes));
  });

  app.post(api.jobs.sendEmail.path, async (req, res) => {
    const job = await storage.getJob(Number(req.params.id));
    if (!job) return res.status(404).json({ message: "Job not found" });

    const pdfBytes = await generateJobPdf(job as any, (job as any).company, (job as any).propertyManager, (job as any).privateCustomer);

    let recipientEmail = "";
    if ((job as any).propertyManager) recipientEmail = (job as any).propertyManager.email;
    else if ((job as any).privateCustomer) recipientEmail = (job as any).privateCustomer.email;

    if (!recipientEmail) return res.status(400).json({ success: false, message: "No customer email found" });

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Notprofi24.at" <noreply@notprofi24.at>',
        to: recipientEmail,
        subject: `Einsatzbericht #${(job as any).jobNumber}`,
        text: `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie den Einsatzbericht für den Auftrag #${(job as any).jobNumber}.\n\nMit freundlichen Grüßen,\nIhr Notprofi24.at Team`,
        attachments: [{ filename: `job-${(job as any).jobNumber}.pdf`, content: Buffer.from(pdfBytes) }],
      });
      res.json({ success: true, message: "Email sent successfully" });
    } catch (error: any) {
      console.error("Email sending failed:", error);
      res.status(500).json({ success: false, message: "Failed to send email: " + error.message });
    }
  });

  // INVOICES
  app.get(api.invoices.list.path, async (_req, res) => res.json(await storage.getInvoices()));

  // Detail (für Klick → Jobs anzeigen)
  app.get("/api/invoices/:id", async (req, res) => {
    const inv = await storage.getInvoice(Number(req.params.id));
    if (!inv) return res.status(404).json({ message: "Invoice not found" });
    res.json(inv);
  });

  // ✅ Generieren: open + done + storniert, storniert = 14.90 netto
  app.post(api.invoices.generate.path, async (req, res) => {
    const { monthYear } = api.invoices.generate.input.parse(req.body);

    const date = parseISO(`${monthYear}-01`);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const settings: any = await (storage as any).getSettings?.().catch(() => null);
    const standardFeeNet = Number(settings?.standardProvision ?? DEFAULT_FEE_NET);

    // Alle Jobs, die in die Abrechnung dürfen (open/done/cancelled/storniert)
    const jobsInMonth = await db
      .select()
      .from(jobs)
      .where(
        and(
          between(jobs.dateTime, start, end),
          inArray(jobs.status as any, BILLING_STATUSES as any)
        )
      );

    if (jobsInMonth.length === 0) {
      return res.json({ generatedCount: 0, message: "No billable jobs found for this month" });
    }

    // Bereits verrechnete Jobs raus
    const existing = await db.select({ jobId: invoiceItems.jobId }).from(invoiceItems);
    const alreadyInvoiced = new Set(existing.map((x) => x.jobId));
    const newJobs = jobsInMonth.filter((j) => !alreadyInvoiced.has(j.id));

    // Firmen im Monat (auch wenn keine neuen Jobs → Dubletten mergen + totals fixen)
    const companyIds = [...new Set(jobsInMonth.map((j) => j.companyId))];

    let touched = 0;

    for (const companyId of companyIds) {
      // 1) Dubletten mergen → nur 1 Rechnung pro Firma+Monat
      let master = await mergeDuplicateInvoices(companyId, monthYear);

      // 2) Wenn keine Rechnung vorhanden → erstellen
      if (!master) {
        const invoiceNumber = `${monthYear.replace("-", "")}-${companyId}-${Date.now().toString().slice(-4)}`;
        const created = await storage.createInvoice(
          {
            invoiceNumber,
            monthYear,
            companyId,
            status: "unpaid",
            totalAmount: "0.00", // wird durch recalc gesetzt
            createdAt: new Date(),
            sentAt: null,
            paidAt: null,
          } as any,
          []
        );
        master = created as any;
      }

      // 3) Neue Jobs dieser Firma anhängen
      const newJobsForCompany = newJobs.filter((j) => j.companyId === companyId);

      if (newJobsForCompany.length > 0) {
        await db.insert(invoiceItems).values(
          newJobsForCompany.map((j) => {
            const feeNet = isCancelledStatus(String(j.status)) ? CANCELLATION_FEE_NET : standardFeeNet;
            return {
              invoiceId: (master as any).id,
              jobId: j.id,
              amount: feeNet.toFixed(2), // ✅ NETTO
            };
          })
        );
      }

      // 4) totals neu berechnen (BRUTTO)
      await recalcInvoiceTotals((master as any).id);

      touched++;
    }

    res.json({ generatedCount: touched, message: `Updated/created ${touched} invoices` });
  });

  app.post(api.invoices.markPaid.path, async (req, res) => {
    const data = await storage.updateInvoice(Number(req.params.id), { status: "paid", paidAt: new Date() } as any);
    res.json(data);
  });

  app.post(api.invoices.generatePdf.path, async (req, res) => {
    const invoice = await storage.getInvoice(Number(req.params.id));
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const items = (invoice as any).items.map((it: any) => ({ ...it, job: it.job }));
    const pdfBytes = await generateInvoicePdf(invoice as any, (invoice as any).company, items as any);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${(invoice as any).invoiceNumber}.pdf`);
    res.send(Buffer.from(pdfBytes));
  });

  app.post(api.invoices.sendEmail.path, async (req, res) => {
    const invoice = await storage.getInvoice(Number(req.params.id));
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const items = (invoice as any).items.map((it: any) => ({ ...it, job: it.job }));
    const pdfBytes = await generateInvoicePdf(invoice as any, (invoice as any).company, items as any);

    const recipientEmail = (invoice as any).company?.email;
    if (!recipientEmail) return res.status(400).json({ success: false, message: "No company email found" });

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Notprofi24.at" <noreply@notprofi24.at>',
        to: recipientEmail,
        subject: `Rechnung ${invoice.monthYear} - ${(invoice as any).invoiceNumber}`,
        text: `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie die Abrechnung für ${invoice.monthYear}.\n\nMit freundlichen Grüßen,\nIhr Notprofi24.at Team`,
        attachments: [{ filename: `invoice-${(invoice as any).invoiceNumber}.pdf`, content: Buffer.from(pdfBytes) }],
      });

      await storage.updateInvoice((invoice as any).id, { sentAt: new Date() } as any);
      res.json({ success: true, message: "Email sent successfully" });
    } catch (error: any) {
      console.error("Email sending failed:", error);
      res.status(500).json({ success: false, message: "Failed to send email: " + error.message });
    }
  });

  // STATS
  app.get(api.stats.dashboard.path, async (_req, res) => res.json(await storage.getStats()));

  return httpServer;
}
