import { db } from "./db";
import {
  propertyManagers,
  privateCustomers,
  companies,
  jobs,
  invoices,
  invoiceItems,
  type InsertPropertyManager,
  type InsertPrivateCustomer,
  type InsertCompany,
  type InsertJob,
  type UpdateJobRequest,
  type Invoice,
} from "@shared/schema";
import { desc, eq, and, between, sql } from "drizzle-orm";
import { format } from "date-fns";

export interface IStorage {
  // Property Managers
  getPropertyManagers(): Promise<any[]>;
  getPropertyManager(id: number): Promise<any>;
  createPropertyManager(data: InsertPropertyManager): Promise<any>;
  updatePropertyManager(id: number, data: Partial<InsertPropertyManager>): Promise<any>;
  deletePropertyManager(id: number): Promise<void>;

  // Private Customers
  getPrivateCustomers(): Promise<any[]>;
  getPrivateCustomer(id: number): Promise<any>;
  createPrivateCustomer(data: InsertPrivateCustomer): Promise<any>;
  updatePrivateCustomer(id: number, data: Partial<InsertPrivateCustomer>): Promise<any>;
  deletePrivateCustomer(id: number): Promise<void>;

  // Companies
  getCompanies(): Promise<any[]>;
  getCompany(id: number): Promise<any>;
  createCompany(data: InsertCompany): Promise<any>;
  updateCompany(id: number, data: Partial<InsertCompany>): Promise<any>;
  deleteCompany(id: number): Promise<void>;

  // Jobs
  getJobs(): Promise<any[]>;
  getJob(id: number): Promise<any>;
  createJob(data: InsertJob): Promise<any>;
  updateJob(id: number, data: UpdateJobRequest): Promise<any>;
  deleteJob(id: number): Promise<void>;

  // Invoices
  getInvoices(): Promise<any[]>;
  getInvoice(id: number): Promise<any>;
  createInvoice(invoice: any, items: any[]): Promise<any>;
  updateInvoice(id: number, data: Partial<Invoice>): Promise<any>;

  // Settings (minimal)
  getSettings(): Promise<any>;
  updateSettings(data: any): Promise<any>;

  // Stats
  getStats(): Promise<{
    openJobs: number;
    doneJobsMonth: number;
    unpaidInvoices: number;
    monthlyRevenue: number;
  }>;
}

function normalizeStatus(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

/**
 * In der App gibt’s oft Mischungen wie:
 * - "canceled" / "cancelled" / "storniert"
 * Wir behandeln alle als "storniert".
 */
function isCancelledStatus(status: unknown): boolean {
  const v = normalizeStatus(status);
  return v === "canceled" || v === "cancelled" || v === "storniert" || v === "canceled " || v === "cancelled ";
}

function isDoneStatus(status: unknown): boolean {
  const v = normalizeStatus(status);
  return v === "done" || v === "erledigt";
}

function isOpenStatus(status: unknown): boolean {
  const v = normalizeStatus(status);
  return v === "open" || v === "offen";
}

export class DatabaseStorage implements IStorage {
  // === Property Managers ===
  async getPropertyManagers() {
    return await db.select().from(propertyManagers).orderBy(desc(propertyManagers.id));
  }

  async getPropertyManager(id: number) {
    const [item] = await db.select().from(propertyManagers).where(eq(propertyManagers.id, id));
    return item;
  }

  async createPropertyManager(data: InsertPropertyManager) {
    const [created] = await db.insert(propertyManagers).values(data).returning();
    return created;
  }

  async updatePropertyManager(id: number, data: Partial<InsertPropertyManager>) {
    const [updated] = await db.update(propertyManagers).set(data).where(eq(propertyManagers.id, id)).returning();
    return updated;
  }

  async deletePropertyManager(id: number) {
    await db.delete(propertyManagers).where(eq(propertyManagers.id, id));
  }

  // === Private Customers ===
  async getPrivateCustomers() {
    return await db.select().from(privateCustomers).orderBy(desc(privateCustomers.id));
  }

  async getPrivateCustomer(id: number) {
    const [item] = await db.select().from(privateCustomers).where(eq(privateCustomers.id, id));
    return item;
  }

  async createPrivateCustomer(data: InsertPrivateCustomer) {
    const [created] = await db.insert(privateCustomers).values(data).returning();
    return created;
  }

  async updatePrivateCustomer(id: number, data: Partial<InsertPrivateCustomer>) {
    const [updated] = await db.update(privateCustomers).set(data).where(eq(privateCustomers.id, id)).returning();
    return updated;
  }

  async deletePrivateCustomer(id: number) {
    await db.delete(privateCustomers).where(eq(privateCustomers.id, id));
  }

  // === Companies ===
  async getCompanies() {
    return await db.select().from(companies).orderBy(desc(companies.id));
  }

  async getCompany(id: number) {
    const [item] = await db.select().from(companies).where(eq(companies.id, id));
    return item;
  }

  async createCompany(data: InsertCompany) {
    const [created] = await db.insert(companies).values(data).returning();
    return created;
  }

  async updateCompany(id: number, data: Partial<InsertCompany>) {
    const [updated] = await db.update(companies).set(data).where(eq(companies.id, id)).returning();
    return updated;
  }

  async deleteCompany(id: number) {
    await db.delete(companies).where(eq(companies.id, id));
  }

  // === Jobs ===
  async getJobs() {
    // Join job with company & customer details for UI display
    const result = await db.query.jobs.findMany({
      with: {
        company: true,
        propertyManager: true,
        privateCustomer: true,
      },
      orderBy: desc(jobs.id),
    });
    return result;
  }

  async getJob(id: number) {
    const result = await db.query.jobs.findFirst({
      where: eq(jobs.id, id),
      with: {
        company: true,
        propertyManager: true,
        privateCustomer: true,
      },
    });
    return result;
  }

  async createJob(data: InsertJob) {
    const [created] = await db.insert(jobs).values(data).returning();
    return await this.getJob(created.id);
  }

  async updateJob(id: number, data: UpdateJobRequest) {
    const [updated] = await db.update(jobs).set(data).where(eq(jobs.id, id)).returning();
    return await this.getJob(updated.id);
  }

  async deleteJob(id: number) {
    await db.delete(jobs).where(eq(jobs.id, id));
  }

  // === Invoices ===
  async getInvoices() {
    const result = await db.query.invoices.findMany({
      with: {
        company: true,
        items: {
          with: {
            job: true,
          },
        },
      },
      orderBy: desc(invoices.id),
    });
    return result;
  }

  async getInvoice(id: number) {
    const result = await db.query.invoices.findFirst({
      where: eq(invoices.id, id),
      with: {
        company: true,
        items: {
          with: {
            job: true,
          },
        },
      },
    });
    return result;
  }

  async createInvoice(invoice: any, items: any[]) {
    const [createdInvoice] = await db.insert(invoices).values(invoice).returning();

    if (items && items.length > 0) {
      const invoiceItemsData = items.map((item) => ({
        invoiceId: createdInvoice.id,
        jobId: item.jobId,
        amount: item.amount.toString(),
      }));
      await db.insert(invoiceItems).values(invoiceItemsData);
    }

    return await this.getInvoice(createdInvoice.id);
  }

  async updateInvoice(id: number, data: Partial<Invoice>) {
    const [updated] = await db.update(invoices).set(data).where(eq(invoices.id, id)).returning();
    return await this.getInvoice(updated.id);
  }

  // === Settings (minimal stub, so health-check works) ===
  async getSettings() {
    return {
      companyName: "Notprofi24",
      address: "",
      uid: "",
      defaultReferralFee: 49,
      vatRate: 20,
      cancelFeeNet: 14.9,
    };
  }

  async updateSettings(data: any) {
    // For now, you can persist later (table optional). Keeps UI working.
    return { ...await this.getSettings(), ...data };
  }

  // === Stats ===
  async getStats() {
    // WICHTIG:
    // - doneJobsMonth soll die erledigten Einsätze im aktuellen Monat zählen (anhand job.dateTime)
    // - monthlyRevenue soll den Umsatz im aktuellen Monat aus invoices.monthYear holen (nicht createdAt)

    const now = new Date();

    // Start: 1. Tag 00:00:00.000
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    // Ende: letzter Tag 23:59:59.999 (damit wirklich alles im Monat inkludiert ist)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthYear = format(now, "yyyy-MM");

    // Wir holen Status-Counts robust (weil Status manchmal in DE/EN oder Varianten vorkommen kann)
    const allJobs = await db.select({ status: jobs.status }).from(jobs);

    const openJobs = allJobs.filter((j) => isOpenStatus(j.status)).length;

    // doneJobsMonth: nur done im aktuellen Monat (nach job.dateTime)
    const doneJobsMonthRows = await db
      .select({ id: jobs.id, status: jobs.status, dateTime: jobs.dateTime })
      .from(jobs)
      .where(between(jobs.dateTime, monthStart, monthEnd));

    const doneJobsMonth = doneJobsMonthRows.filter((j) => isDoneStatus(j.status)).length;

    // Unpaid invoices count
    const unpaidInvoicesRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(eq(invoices.status, "unpaid"));

    const unpaidInvoices = Number(unpaidInvoicesRes[0]?.count ?? 0);

    // Monatsumsatz: Summe der Rechnungen vom aktuellen monthYear (robust & passt zu deiner Abrechnung-Logik)
    const revenueRes = await db
      .select({ sum: sql<string | null>`coalesce(sum(${invoices.totalAmount}), 0)` })
      .from(invoices)
      .where(eq(invoices.monthYear, monthYear));

    const monthlyRevenue = Number(revenueRes[0]?.sum ?? 0);

    return {
      openJobs,
      doneJobsMonth,
      unpaidInvoices,
      monthlyRevenue,
    };
  }
}

export const storage = new DatabaseStorage();
