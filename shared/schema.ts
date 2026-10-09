import { pgTable, text, serial, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === Hausverwaltungen (Property Managers) ===
export const propertyManagers = pgTable("property_managers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === Privatkunden (Private Customers) ===
export const privateCustomers = pgTable("private_customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === Betriebe (Service Providers) ===
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  trades: text("trades").array().notNull(), // ["Installateur", "Elektriker", ...]
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === Einsätze (Jobs) ===
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  jobNumber: serial("job_number").notNull(), // auto-increment
  dateTime: timestamp("date_time").notNull(),
  customerType: text("customer_type").notNull(), // 'property_manager' | 'private_customer'
  propertyManagerId: integer("property_manager_id").references(() => propertyManagers.id),
  privateCustomerId: integer("private_customer_id").references(() => privateCustomers.id),
  serviceAddress: text("service_address").notNull(),
  companyId: integer("company_id").references(() => companies.id),
  propertyId: integer("property_id").references(() => properties.id),
  trade: text("trade").notNull(),
  activity: text("activity").notNull(),
  status: text("status").notNull().default("open"), // 'open', 'done', 'canceled'
  reportText: text("report_text"),
  // Standard: 59 EUR netto je vermitteltem Auftrag zzgl. 20 % USt.
  referralFee: numeric("referral_fee").notNull().default("59"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === Abrechnungen (Invoices) ===
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull(), // YYYYMM-CompanyID
  monthYear: text("month_year").notNull(), // YYYY-MM
  companyId: integer("company_id").references(() => companies.id).notNull(),
  status: text("status").notNull().default("unpaid"), // 'unpaid', 'paid'
  totalAmount: numeric("total_amount").notNull(),
  sentAt: timestamp("sent_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id).notNull(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  amount: numeric("amount").notNull(),
});

// === RELATIONS ===
export const jobsRelations = relations(jobs, ({ one }) => ({
  company: one(companies, {
    fields: [jobs.companyId],
    references: [companies.id],
  }),
  propertyManager: one(propertyManagers, {
    fields: [jobs.propertyManagerId],
    references: [propertyManagers.id],
  }),
  privateCustomer: one(privateCustomers, {
    fields: [jobs.privateCustomerId],
    references: [privateCustomers.id],
  }),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  jobs: many(jobs),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  company: one(companies, {
    fields: [invoices.companyId],
    references: [companies.id],
  }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  job: one(jobs, {
    fields: [invoiceItems.jobId],
    references: [jobs.id],
  }),
}));

// === ZOD SCHEMAS ===
export const insertPropertyManagerSchema = createInsertSchema(propertyManagers).omit({ id: true, createdAt: true });
export const insertPrivateCustomerSchema = createInsertSchema(privateCustomers).omit({ id: true, createdAt: true });
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true });

// ✅ WICHTIG: dateTime kommt vom Browser als ISO-String -> hier wird es zu Date konvertiert
const dateTimeSchema = z.preprocess((v) => {
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  return v;
}, z.date());

export const insertJobSchema = createInsertSchema(jobs, {
  dateTime: dateTimeSchema,
}).omit({ id: true, jobNumber: true, createdAt: true });

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });

// Types
export type PropertyManager = typeof propertyManagers.$inferSelect;
export type InsertPropertyManager = z.infer<typeof insertPropertyManagerSchema>;
export type PrivateCustomer = typeof privateCustomers.$inferSelect;
export type InsertPrivateCustomer = z.infer<typeof insertPrivateCustomerSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;

// Request Types
export type CreateJobRequest = InsertJob;
export type UpdateJobRequest = Partial<InsertJob>;
export type GenerateInvoicesRequest = { monthYear: string };


// === Liegenschaften pro Hausverwaltung ===
// Separat von der Hausverwaltung: eine Verwaltung betreut mehrere Objekte.
export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  propertyManagerId: integer("property_manager_id").references(() => propertyManagers.id).notNull(),
  name: text("name"),
  address: text("address").notNull(),
  emergencyInstructions: text("emergency_instructions"),
  contactPhone: text("contact_phone"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// === Notrufe: auch Anrufe ohne kostenpflichtigen Einsatz erfassen ===
export const emergencyCalls = pgTable("emergency_calls", {
  id: serial("id").primaryKey(),
  propertyManagerId: integer("property_manager_id").references(() => propertyManagers.id),
  propertyId: integer("property_id").references(() => properties.id),
  jobId: integer("job_id").references(() => jobs.id),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  callerName: text("caller_name"),
  callerPhone: text("caller_phone"),
  serviceAddress: text("service_address"),
  issueType: text("issue_type").notNull(),
  description: text("description"),
  status: text("status").notNull().default("received"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, createdAt: true });
export const insertEmergencyCallSchema = createInsertSchema(emergencyCalls).omit({ id: true, createdAt: true });
export type Property = typeof properties.$inferSelect;
export type EmergencyCall = typeof emergencyCalls.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type InsertEmergencyCall = z.infer<typeof insertEmergencyCallSchema>;
