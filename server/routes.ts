import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";
import { generateJobPdf, generateInvoicePdf } from "./pdf";
import nodemailer from "nodemailer";
import { startOfMonth, endOfMonth, parseISO, format } from "date-fns";
import { db } from "./db";
import { jobs, invoiceItems } from "@shared/schema";
import { and, eq, inArray, between } from "drizzle-orm";

const SessionStore = MemoryStore(session);

// Types extension for session
declare module "express-session" {
  interface SessionData {
    isAdmin: boolean;
    userEmail: string;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup Session
  app.use(
    session({
      store: new SessionStore({
        checkPeriod: 86400000, // prune expired entries every 24h
      }),
      secret: process.env.SESSION_SECRET || "default_secret_please_change",
      resave: false,
      saveUninitialized: false,
      cookie: { 
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      },
    })
  );

  // Email Transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.example.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || 'user',
      pass: process.env.SMTP_PASS || 'pass',
    },
  });

  // Auth Middleware
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.session.isAdmin) {
      next();
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  };

  // Health endpoint (no auth) so you can quickly verify Render + DB.
  // Returns { ok:true, db:true/false }
  app.get("/api/health", async (_req, res) => {
    try {
      // lightweight DB probe
      await storage.getSettings();
      res.json({ ok: true, db: true });
    } catch (e) {
      res.json({ ok: true, db: false });
    }
  });

  // === AUTH ROUTES ===
  app.post(api.auth.login.path, async (req, res) => {
    const { email, password } = api.auth.login.input.parse(req.body);
    
    // Check against ENV variables as requested
    if (
      email === process.env.ADMIN_EMAIL && 
      password === process.env.ADMIN_PASSWORD
    ) {
      req.session.isAdmin = true;
      req.session.userEmail = email;
      return res.json({ message: "Logged in successfully" });
    }
    
    res.status(401).json({ message: "Invalid credentials" });
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (req.session.isAdmin) {
      res.json({ email: req.session.userEmail });
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  // Protect all API routes below
  app.use('/api', (req, res, next) => {
    if (req.path === '/login' || req.path === '/logout' || req.path === '/me' || req.path === '/health') {
      return next();
    }
    requireAuth(req, res, next);
  });

  // === PROPERTY MANAGERS ===
  app.get(api.propertyManagers.list.path, async (req, res) => {
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

  // === PRIVATE CUSTOMERS ===
  app.get(api.privateCustomers.list.path, async (req, res) => {
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

  // === COMPANIES ===
  app.get(api.companies.list.path, async (req, res) => {
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

  // === JOBS ===
  app.get(api.jobs.list.path, async (req, res) => {
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
    
    const pdfBytes = await generateJobPdf(job, job.company, job.propertyManager, job.privateCustomer);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=job-${job.jobNumber}.pdf`);
    res.send(Buffer.from(pdfBytes));
  });

  app.post(api.jobs.sendEmail.path, async (req, res) => {
    const job = await storage.getJob(Number(req.params.id));
    if (!job) return res.status(404).json({ message: "Job not found" });
    
    const pdfBytes = await generateJobPdf(job, job.company, job.propertyManager, job.privateCustomer);
    
    let recipientEmail = '';
    if (job.propertyManager) recipientEmail = job.propertyManager.email;
    else if (job.privateCustomer) recipientEmail = job.privateCustomer.email;
    
    if (!recipientEmail) return res.status(400).json({ success: false, message: "No customer email found" });

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Notprofi24.at" <noreply@notprofi24.at>',
        to: recipientEmail,
        subject: `Einsatzbericht #${job.jobNumber}`,
        text: `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie den Einsatzbericht für den Auftrag #${job.jobNumber}.\n\nMit freundlichen Grüßen,\nIhr Notprofi24.at Team`,
        attachments: [
          {
            filename: `job-${job.jobNumber}.pdf`,
            content: Buffer.from(pdfBytes),
          },
        ],
      });
      res.json({ success: true, message: "Email sent successfully" });
    } catch (error: any) {
      console.error("Email sending failed:", error);
      res.status(500).json({ success: false, message: "Failed to send email: " + error.message });
    }
  });

  // === INVOICES ===
  app.get(api.invoices.list.path, async (req, res) => {
    const data = await storage.getInvoices();
    res.json(data);
  });

  app.post(api.invoices.generate.path, async (req, res) => {
    const { monthYear } = api.invoices.generate.input.parse(req.body);
    // monthYear is YYYY-MM
    const date = parseISO(`${monthYear}-01`);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    // 1. Get all DONE jobs in range
    const doneJobs = await db.select().from(jobs).where(and(
      eq(jobs.status, 'done'),
      between(jobs.dateTime, start, end)
    ));

    if (doneJobs.length === 0) {
      return res.json({ generatedCount: 0, message: "No done jobs found for this month" });
    }

    // 2. Check which ones are already invoiced
    const existingItems = await db.select({ jobId: invoiceItems.jobId }).from(invoiceItems);
    const alreadyInvoicedIds = new Set(existingItems.map(i => i.jobId));
    
    const jobsToInvoice = doneJobs.filter(j => !alreadyInvoicedIds.has(j.id));
    
    if (jobsToInvoice.length === 0) {
      return res.json({ generatedCount: 0, message: "All done jobs for this month are already invoiced" });
    }

    // 3. Group by company
    const jobsByCompany = new Map<number, typeof jobsToInvoice>();
    for (const job of jobsToInvoice) {
      if (!jobsByCompany.has(job.companyId)) {
        jobsByCompany.set(job.companyId, []);
      }
      jobsByCompany.get(job.companyId)?.push(job);
    }

    // 4. Create Invoices
    let generatedCount = 0;
    for (const [companyId, companyJobs] of jobsByCompany.entries()) {
      const totalAmount = companyJobs.length * 60; // 60 EUR per job
      const invoiceNumber = `${monthYear.replace('-', '')}-${companyId}-${Date.now().toString().slice(-4)}`;
      
      await storage.createInvoice({
        invoiceNumber,
        monthYear,
        companyId,
        status: 'unpaid',
        totalAmount: totalAmount.toString(),
        createdAt: new Date(),
        sentAt: null,
        paidAt: null
      }, companyJobs.map(j => ({ jobId: j.id, amount: 60 })));
      
      generatedCount++;
    }

    res.json({ generatedCount, message: `Generated ${generatedCount} invoices` });
  });

  app.post(api.invoices.markPaid.path, async (req, res) => {
    const data = await storage.updateInvoice(Number(req.params.id), { 
      status: 'paid', 
      paidAt: new Date() 
    });
    res.json(data);
  });

  app.post(api.invoices.generatePdf.path, async (req, res) => {
    const invoice = await storage.getInvoice(Number(req.params.id));
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    
    // get items with job details
    const items = invoice.items.map(item => ({
      ...item,
      job: (item as any).job // populated in storage.getInvoice
    }));
    
    const pdfBytes = await generateInvoicePdf(invoice, invoice.company, items);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
    res.send(Buffer.from(pdfBytes));
  });

  app.post(api.invoices.sendEmail.path, async (req, res) => {
    const invoice = await storage.getInvoice(Number(req.params.id));
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    
    // get items with job details
    const items = invoice.items.map(item => ({
      ...item,
      job: (item as any).job 
    }));
    
    const pdfBytes = await generateInvoicePdf(invoice, invoice.company, items);
    
    const recipientEmail = invoice.company?.email;
    if (!recipientEmail) return res.status(400).json({ success: false, message: "No company email found" });

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Notprofi24.at" <noreply@notprofi24.at>',
        to: recipientEmail,
        subject: `Rechnung ${invoice.monthYear} - ${invoice.invoiceNumber}`,
        text: `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie die Abrechnung für ${invoice.monthYear}.\n\nMit freundlichen Grüßen,\nIhr Notprofi24.at Team`,
        attachments: [
          {
            filename: `invoice-${invoice.invoiceNumber}.pdf`,
            content: Buffer.from(pdfBytes),
          },
        ],
      });
      
      // Update sentAt
      await storage.updateInvoice(invoice.id, { sentAt: new Date() });
      
      res.json({ success: true, message: "Email sent successfully" });
    } catch (error: any) {
      console.error("Email sending failed:", error);
      res.status(500).json({ success: false, message: "Failed to send email: " + error.message });
    }
  });

  // === STATS ===
  app.get(api.stats.dashboard.path, async (req, res) => {
    const data = await storage.getStats();
    res.json(data);
  });

  return httpServer;
}
