import { db } from "./db";
import {
  propertyManagers,
  privateCustomers,
  companies,
  jobs,
  invoices,
  invoiceItems,
  type PropertyManager,
  type InsertPropertyManager,
  type PrivateCustomer,
  type InsertPrivateCustomer,
  type Company,
  type InsertCompany,
  type Job,
  type InsertJob,
  type Invoice,
  type InsertInvoice,
  type InvoiceItem,
} from "@shared/schema";
import { eq, desc, and, sql, between, gte, lt } from "drizzle-orm";

export interface IStorage {
  // Auth
  getUserByEmail(email: string): Promise<{ email: string } | undefined>;

  // Property Managers
  getPropertyManagers(): Promise<PropertyManager[]>;
  getPropertyManager(id: number): Promise<PropertyManager | undefined>;
  createPropertyManager(pm: InsertPropertyManager): Promise<PropertyManager>;
  updatePropertyManager(id: number, pm: Partial<InsertPropertyManager>): Promise<PropertyManager>;
  deletePropertyManager(id: number): Promise<void>;

  // Private Customers
  getPrivateCustomers(): Promise<PrivateCustomer[]>;
  getPrivateCustomer(id: number): Promise<PrivateCustomer | undefined>;
  createPrivateCustomer(customer: InsertPrivateCustomer): Promise<PrivateCustomer>;
  updatePrivateCustomer(id: number, customer: Partial<InsertPrivateCustomer>): Promise<PrivateCustomer>;
  deletePrivateCustomer(id: number): Promise<void>;

  // Companies
  getCompanies(): Promise<Company[]>;
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company>;
  deleteCompany(id: number): Promise<void>;

  // Jobs
  getJobs(): Promise<
    (Job & {
      company: Company | null;
      propertyManager: PropertyManager | null;
      privateCustomer: PrivateCustomer | null;
    })[]
  >;
  getJob(
    id: number
  ): Promise<
    | (Job & {
        company: Company | null;
        propertyManager: PropertyManager | null;
        privateCustomer: PrivateCustomer | null;
      })
    | undefined
  >;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: number, job: Partial<InsertJob>): Promise<Job>;

  // Invoices
  getInvoices(): Promise<(Invoice & { company: Company | null })[]>;
  getInvoice(
    id: number
  ): Promise<(Invoice & { company: Company | null; items: InvoiceItem[] }) | undefined>;
  createInvoice(invoice: InsertInvoice, items: { jobId: number; amount: number }[]): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice>;

  // Stats
  getStats(): Promise<{
    openJobs: number;
    doneJobsMonth: number;
    unpaidInvoices: number;
    monthlyRevenue: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUserByEmail(email: string): Promise<{ email: string } | undefined> {
    // Env Var Admin Auth
    if (email === process.env.ADMIN_EMAIL) {
      return { email: process.env.ADMIN_EMAIL };
    }
    return undefined;
  }

  // Property Managers
  async getPropertyManagers() {
    return db.select().from(propertyManagers).orderBy(desc(propertyManagers.createdAt));
  }
  async getPropertyManager(id: number) {
    const [pm] = await db.select().from(propertyManagers).where(eq(propertyManagers.id, id));
    return pm;
  }
  async createPropertyManager(pm: InsertPropertyManager) {
    const [newPm] = await db.insert(propertyManagers).values(pm).returning();
    return newPm;
  }
  async updatePropertyManager(id: number, pm: Partial<InsertPropertyManager>) {
    const [updated] = await db.update(propertyManagers).set(pm).where(eq(propertyManagers.id, id)).returning();
    return updated;
  }
  async deletePropertyManager(id: number) {
    await db.delete(propertyManagers).where(eq(propertyManagers.id, id));
  }

  // Private Customers
  async getPrivateCustomers() {
    return db.select().from(privateCustomers).orderBy(desc(privateCustomers.createdAt));
  }
  async getPrivateCustomer(id: number) {
    const [customer] = await db.select().from(privateCustomers).where(eq(privateCustomers.id, id));
    return customer;
  }
  async createPrivateCustomer(customer: InsertPrivateCustomer) {
    const [newCustomer] = await db.insert(privateCustomers).values(customer).returning();
    return newCustomer;
  }
  async updatePrivateCustomer(id: number, customer: Partial<InsertPrivateCustomer>) {
    const [updated] = await db.update(privateCustomers).set(customer).where(eq(privateCustomers.id, id)).returning();
    return updated;
  }
  async deletePrivateCustomer(id: number) {
    await db.delete(privateCustomers).where(eq(privateCustomers.id, id));
  }

  // Companies
  async getCompanies() {
    return db.select().from(companies).orderBy(desc(companies.createdAt));
  }
  async getCompany(id: number) {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }
  async createCompany(company: InsertCompany) {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }
  async updateCompany(id: number, company: Partial<InsertCompany>) {
    const [updated] = await db.update(companies).set(company).where(eq(companies.id, id)).returning();
    return updated;
  }
  async deleteCompany(id: number) {
    await db.delete(companies).where(eq(companies.id, id));
  }

  // Jobs
  async getJobs() {
    return db.query.jobs.findMany({
      orderBy: [desc(jobs.dateTime)],
      with: {
        company: true,
        propertyManager: true,
        privateCustomer: true,
      },
    });
  }
  async getJob(id: number) {
    return db.query.jobs.findFirst({
      where: eq(jobs.id, id),
      with: {
        company: true,
        propertyManager: true,
        privateCustomer: true,
      },
    });
  }
  async createJob(job: InsertJob) {
    const [newJob] = await db.insert(jobs).values(job).returning();
    return newJob;
  }
  async updateJob(id: number, job: Partial<InsertJob>) {
    const [updated] = await db.update(jobs).set(job).where(eq(jobs.id, id)).returning();
    return updated;
  }

  // Invoices
  async getInvoices() {
    return db.query.invoices.findMany({
      orderBy: [desc(invoices.createdAt)],
      with: {
        company: true,
      },
    });
  }
  async getInvoice(id: number) {
    return db.query.invoices.findFirst({
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
  }
  async createInvoice(invoice: InsertInvoice, items: { jobId: number; amount: number }[]) {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();

    if (items.length > 0) {
      await db.insert(invoiceItems).values(
        items.map((item) => ({
          invoiceId: newInvoice.id,
          jobId: item.jobId,
          amount: item.amount.toString(),
        }))
      );
    }

    return newInvoice;
  }
  async updateInvoice(id: number, invoice: Partial<InsertInvoice>) {
    const [updated] = await db.update(invoices).set(invoice).where(eq(invoices.id, id)).returning();
    return updated;
  }

  // ✅ Stats (fix: Monatsende korrekt, kein “00:00”-Bug)
  async getStats() {
    const [openJobs] = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(eq(jobs.status, "open"));

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

    const [doneJobsMonth] = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(and(eq(jobs.status, "done"), gte(jobs.dateTime, start), lt(jobs.dateTime, nextMonthStart)));

    const [unpaidInvoices] = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(eq(invoices.status, "unpaid"));

    const [revenue] = await db
      .select({ total: sql<number>`coalesce(sum(total_amount), 0)` })
      .from(invoices)
      .where(and(gte(invoices.createdAt, start), lt(invoices.createdAt, nextMonthStart)));

    return {
      openJobs: Number(openJobs?.count || 0),
      doneJobsMonth: Number(doneJobsMonth?.count || 0),
      unpaidInvoices: Number(unpaidInvoices?.count || 0),
      monthlyRevenue: Number(revenue?.total || 0),
    };
  }
}

export const storage = new DatabaseStorage();
