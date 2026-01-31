import { db } from "../server/db";
import { 
  propertyManagers, privateCustomers, companies, jobs, invoices, 
  type InsertPropertyManager, type InsertPrivateCustomer, type InsertCompany, type InsertJob 
} from "@shared/schema";

async function seed() {
  console.log("Seeding database...");

  // 1. Property Manager
  const [pm] = await db.insert(propertyManagers).values({
    name: "Hausverwaltung Müller GmbH",
    address: "Hauptstraße 1, 1010 Wien",
    phone: "+43 1 2345678",
    email: "office@hv-mueller.at",
    notes: "Premium Kunde"
  }).returning();
  console.log("Created Property Manager:", pm.name);

  // 2. Private Customer
  const [customer] = await db.insert(privateCustomers).values({
    name: "Max Mustermann",
    address: "Musterweg 5, 1020 Wien",
    phone: "+43 664 1234567",
    email: "max.mustermann@example.com",
    notes: "Privatkunde"
  }).returning();
  console.log("Created Private Customer:", customer.name);

  // 3. Company
  const [company] = await db.insert(companies).values({
    companyName: "Installateur Huber",
    contactName: "Franz Huber",
    address: "Handwerkergasse 3, 1100 Wien",
    phone: "+43 664 9876543",
    email: "huber@installateur.at",
    trades: ["Installateur", "Glaser"],
    isActive: true,
    notes: "Verlässlich"
  }).returning();
  console.log("Created Company:", company.companyName);

  // 4. Jobs
  // Job 1: Done (last month)
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  
  await db.insert(jobs).values({
    dateTime: lastMonth,
    customerType: "property_manager",
    propertyManagerId: pm.id,
    companyId: company.id,
    serviceAddress: "Hauptstraße 1, 1010 Wien (Stiege 2, Top 5)",
    trade: "Installateur",
    activity: "Rohrbruch behoben",
    status: "done",
    reportText: "Wasser abgedreht, Rohr getauscht.",
    referralFee: "60"
  });

  // Job 2: Open (today)
  await db.insert(jobs).values({
    dateTime: new Date(),
    customerType: "private_customer",
    privateCustomerId: customer.id,
    companyId: company.id,
    serviceAddress: "Musterweg 5, 1020 Wien",
    trade: "Glaser",
    activity: "Fensterbruch",
    status: "open",
    referralFee: "60"
  });

  console.log("Seeding complete!");
}

seed().catch(console.error).finally(() => process.exit(0));
