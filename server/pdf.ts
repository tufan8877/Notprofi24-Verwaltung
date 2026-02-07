import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type {
  Job,
  Company,
  PropertyManager,
  PrivateCustomer,
  Invoice,
  InvoiceItem,
} from "@shared/schema";
import { format } from "date-fns";

/**
 * Helper: safe number -> 2 decimals
 */
function toMoney(n: unknown): number {
  const v = Number(n);
  if (Number.isFinite(v)) return Math.round(v * 100) / 100;
  return 0;
}

export async function generateJobPdf(
  job: Job,
  company: Company | null,
  propertyManager: PropertyManager | null,
  privateCustomer: PrivateCustomer | null
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 50;
  const margin = 50;

  // Header
  page.drawText("Einsatzbericht / Job Report", { x: margin, y, size: 20, font: boldFont });
  y -= 30;

  // jobNumber / ticket fallback
  const jobNo = (job as any).jobNumber ?? (job as any).ticketId ?? (job as any).ticket_id ?? "";
  page.drawText(`Job Number: #${jobNo}`, { x: margin, y, size: 12, font });
  y -= 20;

  const dt = (job as any).dateTime ?? (job as any).createdAt ?? (job as any).created_at ?? new Date();
  page.drawText(`Datum: ${format(new Date(dt), "dd.MM.yyyy HH:mm")}`, { x: margin, y, size: 12, font });
  y -= 40;

  // Customer
  page.drawText("Kunde / Customer:", { x: margin, y, size: 14, font: boldFont });
  y -= 20;

  const customerName =
    propertyManager?.name ?? privateCustomer?.name ?? (job as any).customerName ?? "Unknown";
  const customerAddress =
    propertyManager?.address ?? privateCustomer?.address ?? (job as any).customerAddress ?? "";
  const customerPhone =
    propertyManager?.phone ?? privateCustomer?.phone ?? (job as any).customerPhone ?? "";

  page.drawText(`Name: ${customerName}`, { x: margin, y, size: 12, font });
  y -= 15;
  page.drawText(`Adresse: ${customerAddress}`, { x: margin, y, size: 12, font });
  y -= 15;
  page.drawText(`Tel: ${customerPhone}`, { x: margin, y, size: 12, font });
  y -= 30;

  // Service Address
  page.drawText("Einsatzort / Service Address:", { x: margin, y, size: 14, font: boldFont });
  y -= 20;
  page.drawText((job as any).serviceAddress ?? (job as any).freeAddress ?? "", {
    x: margin,
    y,
    size: 12,
    font,
  });
  y -= 30;

  // Company
  page.drawText("Ausführender Betrieb / Service Provider:", {
    x: margin,
    y,
    size: 14,
    font: boldFont,
  });
  y -= 20;
  page.drawText(company?.companyName ?? (company as any)?.name ?? "N/A", {
    x: margin,
    y,
    size: 12,
    font,
  });
  y -= 15;
  page.drawText(`Kontakt: ${(company as any)?.contactName ?? ""}`, { x: margin, y, size: 12, font });
  y -= 15;
  page.drawText(`Tel: ${company?.phone ?? ""}`, { x: margin, y, size: 12, font });
  y -= 30;

  // Job Details
  page.drawText("Details:", { x: margin, y, size: 14, font: boldFont });
  y -= 20;
  page.drawText(`Gewerk: ${(job as any).trade ?? ""}`, { x: margin, y, size: 12, font });
  y -= 15;
  page.drawText(`Tätigkeit: ${(job as any).activity ?? (job as any).problemText ?? ""}`, {
    x: margin,
    y,
    size: 12,
    font,
    maxWidth: width - 2 * margin,
  });
  y -= 15;
  page.drawText(`Status: ${(job as any).status ?? ""}`, { x: margin, y, size: 12, font });
  y -= 30;

  // Report
  page.drawText("Bericht / Report:", { x: margin, y, size: 14, font: boldFont });
  y -= 20;
  const reportText = (job as any).reportText ?? (job as any).report_text ?? "";
  if (reportText) {
    page.drawText(String(reportText), {
      x: margin,
      y,
      size: 12,
      font,
      maxWidth: width - 2 * margin,
    });
  } else {
    page.drawText("(Kein Bericht / No report text)", {
      x: margin,
      y,
      size: 12,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  // Footer
  page.drawText("Notprofi24.at", { x: margin, y: 30, size: 10, font, color: rgb(0.5, 0.5, 0.5) });

  return await pdfDoc.save();
}

export async function generateInvoicePdf(
  invoice: Invoice,
  company: Company | null,
  items: (InvoiceItem & { job: Job })[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 50;
  const margin = 50;

  // Header
  page.drawText("Rechnung / Invoice", { x: margin, y, size: 20, font: boldFont });
  y -= 30;

  const invoiceNumber =
    (invoice as any).invoiceNumber ??
    (invoice as any).invoice_number ??
    (invoice as any).number ??
    "—";
  page.drawText(`Rechnung Nr.: ${invoiceNumber}`, { x: margin, y, size: 12, font });
  y -= 20;

  const periodLabel =
    (invoice as any).monthYear ??
    (invoice as any).periodLabel ??
    (invoice as any).period_start ??
    "";
  if (periodLabel) {
    page.drawText(`Periode: ${String(periodLabel)}`, { x: margin, y, size: 12, font });
    y -= 20;
  }

  const createdAt = (invoice as any).createdAt ?? (invoice as any).created_at ?? new Date();
  page.drawText(`Datum: ${format(new Date(createdAt), "dd.MM.yyyy")}`, { x: margin, y, size: 12, font });
  y -= 40;

  // Recipient (Company)
  page.drawText("Empfänger / Recipient:", { x: margin, y, size: 14, font: boldFont });
  y -= 20;
  page.drawText(company?.companyName ?? (company as any)?.name ?? "Unknown Company", {
    x: margin,
    y,
    size: 12,
    font,
  });
  y -= 15;
  page.drawText((company as any)?.address ?? "", { x: margin, y, size: 12, font });
  y -= 40;

  // Items Table Header
  page.drawText("Positionen:", { x: margin, y, size: 14, font: boldFont });
  y -= 20;

  // Table Header
  page.drawText("Job #", { x: margin, y, size: 10, font: boldFont });
  page.drawText("Datum", { x: margin + 60, y, size: 10, font: boldFont });
  page.drawText("Adresse", { x: margin + 140, y, size: 10, font: boldFont });
  page.drawText("Netto", { x: width - margin - 60, y, size: 10, font: boldFont });
  y -= 15;

  page.drawLine({
    start: { x: margin, y: y + 5 },
    end: { x: width - margin, y: y + 5 },
    thickness: 1,
  });
  y -= 15;

  // Items
  for (const item of items) {
    const jobNo = (item.job as any).jobNumber ?? (item.job as any).ticketId ?? (item.job as any).ticket_id ?? "";
    const jobDT = (item.job as any).dateTime ?? (item.job as any).createdAt ?? (item.job as any).created_at ?? new Date();
    const addr = String((item.job as any).serviceAddress ?? (item.job as any).freeAddress ?? "");
    const amountNet = toMoney((item as any).amount ?? (item as any).amountNet ?? (item as any).amount_net);

    page.drawText(`#${jobNo}`, { x: margin, y, size: 10, font });
    page.drawText(format(new Date(jobDT), "dd.MM.yy"), { x: margin + 60, y, size: 10, font });

    let truncated = addr;
    if (truncated.length > 40) truncated = truncated.substring(0, 37) + "...";
    page.drawText(truncated, { x: margin + 140, y, size: 10, font });

    page.drawText(`€ ${amountNet.toFixed(2)}`, { x: width - margin - 60, y, size: 10, font });
    y -= 20;

    // Simple page-break protection
    if (y < 80) {
      // Minimal MVP: stop rendering further lines if overflow
      page.drawText("(Weitere Positionen gekürzt…)", {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
      y -= 15;
      break;
    }
  }

  // ----- Totals (Netto / USt / Brutto) -----
  const vatRate = toMoney((invoice as any).vatRate ?? (invoice as any).vat_rate ?? 0.2);

  // If invoice already stores totals, prefer them:
  const subtotalNet =
    toMoney((invoice as any).subtotalNet ?? (invoice as any).subtotal_net) ||
    // fallback: sum items as net
    toMoney(items.reduce((sum, it) => sum + toMoney((it as any).amount), 0));

  const vatAmount =
    toMoney((invoice as any).vatAmount ?? (invoice as any).vat_amount) ||
    toMoney(subtotalNet * vatRate);

  const totalGross =
    toMoney((invoice as any).totalGross ?? (invoice as any).total_gross ?? (invoice as any).totalAmount ?? (invoice as any).total_amount) ||
    toMoney(subtotalNet + vatAmount);

  y -= 10;
  page.drawLine({
    start: { x: margin, y: y + 20 },
    end: { x: width - margin, y: y + 20 },
    thickness: 1,
  });
  y -= 25;

  page.drawText("Zwischensumme (Netto):", { x: margin + 260, y, size: 11, font: boldFont });
  page.drawText(`€ ${subtotalNet.toFixed(2)}`, { x: width - margin - 70, y, size: 11, font });
  y -= 16;

  page.drawText(`USt (${Math.round(vatRate * 100)}%):`, { x: margin + 260, y, size: 11, font: boldFont });
  page.drawText(`€ ${vatAmount.toFixed(2)}`, { x: width - margin - 70, y, size: 11, font });
  y -= 16;

  page.drawText("Gesamtbetrag (Brutto):", { x: margin + 260, y, size: 12, font: boldFont });
  page.drawText(`€ ${totalGross.toFixed(2)}`, { x: width - margin - 70, y, size: 12, font: boldFont });
  y -= 35;

  // Footer Note (49€ + USt)
  page.drawText("Vermittlungsgebühr Notprofi24.at: 49,00 € netto pro vermitteltem Auftrag + USt.", {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 14;

  page.drawText("Zahlbar laut Vereinbarung / Zahlungsfrist gemäß Abrechnung.", {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  return await pdfDoc.save();
}
