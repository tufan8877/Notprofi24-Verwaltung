import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import session from "express-session";
import MemoryStore from "memorystore";
import { generateJobPdf, generateInvoicePdf } from "./pdf";
import nodemailer from "nodemailer";
import { startOfMonth, endOfMonth, parseISO, format } from "date-fns";
import { db } from "./db";
import { jobs, invoiceItems } from "@shared/schema";
import { and, eq, between } from "drizzle-orm";

const SessionStore = MemoryStore(session);

// Types extension for session
declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
    userEmail: string;
  }
}

const VAT_RATE = 0.20; // AT 20% USt

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Setup Session
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

  // Email Transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.example.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || "user",
      pass: process.env.SMTP_PASS || "pass",
    },
  });

  // Auth Middleware
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.session.isAdmin) next();
    else res.status(401).json({ message: "Unauthorized" });
  };

  // Health
  app.get("/api/health", async (_req, res) => {
    try {
      await storage.getSettings?.();
      res.json({ ok: true, db: true });
    } catch {
      res.json({ ok: true, db: false });
    }
  });

  // === AUTH ===
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
    if (req.session.isAdmin) res.json({ email: req.session.userEmail });
    else res.status(401).json({ message: "Unauthorized" });
  });

  // Protect all /api except login/logout/me/health
  app.use("/api", (req, res, next) => {
    if (req.path === "/login" || req.path === "/logout" || req.path === "/me" || req.path === "/health") return next();
    return requireAuth(req, res, next);
  });

  // === PROPERTY MANAGERS ===
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

  // === PRIVATE CUSTOMERS ===
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

  // === COMPANIES ===
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

  // === JOBS ===
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

    const pdfBytes = await generateJobPdf(job, job.company, job.propertyManager, job.privateCustomer);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=job-${job.jobNumber}.pdf`);
    res.send(Buffer.from(pdfBytes));
  });

  app.post(api.jobs.sendEmail.path, async (req, res) => {
    const job = await storage.getJob(Number(req.params.id));
    if (!job) return res.status(404).json({ message: "Job not found" });

    const pdfBytes = await generateJobPdf(job, job.company, job.propertyManager, job.privateCustomer);

    let recipientEmail = "";
    if (job.propertyManager) recipientEmail = job.propertyManager.email;
    else if (job.privateCustomer) recipientEmail = job.privateCustomer.email;

    if (!recipientEmail) return res.status(400).json({ success: false, message: "No customer email found" });

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Notprofi24.at" <noreply@notprofi24.at>',
        to: recipientEmail,
        subject: `Einsatzbericht #${job.jobNumber}`,
        text: `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie den Einsatzbericht für den Auftrag #${job.jobNumber}.\n\nMit freundlichen Grüßen,\nIhr Notprofi24.at Team`,
        attachments: [{ filename: `job-${job.jobNumber}.pdf`, content: Buffer.from(pdfBytes) }],
      });
      res.json({ success: true, message: "Email sent successfully" });
    } catch (error: any) {
      console.error("Email sending failed:", error);
      res.status(500).json({ success: false, message: "Failed to send email: " + error.message });
    }
  });

  // === INVOICES ===
  app.get(api.invoices.list.path, async (_req, res) => {
    // storage.getInvoices muss itemCount/net/vat/gross liefern (machen wir in storage.ts)
    res.json(await storage.getInvoices());
  });

  app.post(api.invoices.generate.path, async (req, res) => {
    const { monthYear } = api.invoices.generate.input.parse(req.body);

    const date = parseISO(`${monthYear}-01`);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    // ✅ Settings: Standard Provision ist NETTO pro Einsatz
    const settings = (await storage.getSettings?.()) as any;
    const feeNet = Number(settings?.standardProvision ?? 49); // Netto pro Job
    const feeGross = +(feeNet * (1 + VAT_RATE)).toFixed(2);

    // 1) DONE Jobs im Zeitraum
    const doneJobs = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.status, "done"), between(jobs.dateTime, start, end)));

    if (doneJobs.length === 0) {
      return res.json({ generatedCount: 0, message: "No done jobs found for this month" });
    }

    // 2) Schon fakturierte Jobs herausfiltern
    const existingItems = await db.select({ jobId: invoiceItems.jobId }).from(invoiceItems);
    const alreadyInvoicedIds = new Set(existingItems.map((i) => i.jobId));
    const jobsToInvoice = doneJobs.filter((j) => !alreadyInvoicedIds.has(j.id));

    if (jobsToInvoice.length === 0) {
      return res.json({ generatedCount: 0, message: "All done jobs for this month are already invoiced" });
    }

    // 3) Gruppieren nach Firma
    const jobsByCompany = new Map<number, typeof jobsToInvoice>();
    for (const job of jobsToInvoice) {
      if (!jobsByCompany.has(job.companyId)) jobsByCompany.set(job.companyId, []);
      jobsByCompany.get(job.companyId)!.push(job);
    }

    // 4) Rechnungen erstellen (Brutto in invoice.totalAmount)
    let generatedCount = 0;

    for (const [companyId, companyJobs] of jobsByCompany.entries()) {
      const count = companyJobs.length;

      const totalNet = +(count * feeNet).toFixed(2);
      const vat = +(totalNet * VAT_RATE).toFixed(2);
      const totalGross = +(totalNet + vat).toFixed(2);

      const invoiceNumber = `${monthYear.replace("-", "")}-${companyId}-${Date.now().toString().slice(-4)}`;

      await storage.createInvoice(
        {
          invoiceNumber,
          monthYear,
          companyId,
          status: "unpaid",
          totalAmount: totalGross.toFixed(2), // ✅ BRUTTO
          createdAt: new Date(),
          sentAt: null,
          paidAt: null,
        } as any,
        // ✅ invoiceItems amount = NETTO pro Job
        companyJobs.map((j) => ({ jobId: j.id, amount: feeNet }))
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

    const items = invoice.items.map((item: any) => ({ ...item, job: item.job }));

    const pdfBytes = await generateInvoicePdf(invoice as any, (invoice as any).company, items as any);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
    res.send(Buffer.from(pdfBytes));
  });

  app.post(api.invoices.sendEmail.path, async (req, res) => {
    const invoice = await storage.getInvoice(Number(req.params.id));
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const items = (invoice as any).items.map((item: any) => ({ ...item, job: item.job }));
    const pdfBytes = await generateInvoicePdf(invoice as any, (invoice as any).company, items as any);

    const recipientEmail = (invoice as any).company?.email;
    if (!recipientEmail) return res.status(400).json({ success: false, message: "No company email found" });

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Notprofi24.at" <noreply@notprofi24.at>',
        to: recipientEmail,
        subject: `Rechnung ${invoice.monthYear} - ${invoice.invoiceNumber}`,
        text: `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie die Abrechnung für ${invoice.monthYear}.\n\nMit freundlichen Grüßen,\nIhr Notprofi24.at Team`,
        attachments: [{ filename: `invoice-${invoice.invoiceNumber}.pdf`, content: Buffer.from(pdfBytes) }],
      });

      await storage.updateInvoice(invoice.id, { sentAt: new Date() } as any);
      res.json({ success: true, message: "Email sent successfully" });
    } catch (error: any) {
      console.error("Email sending failed:", error);
      res.status(500).json({ success: false, message: "Failed to send email: " + error.message });
    }
  });

  // === STATS ===
  app.get(api.stats.dashboard.path, async (_req, res) => {
    res.json(await storage.getStats());
  });

  return httpServer;
}
