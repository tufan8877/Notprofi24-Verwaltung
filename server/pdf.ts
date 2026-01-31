import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Job, Company, PropertyManager, PrivateCustomer, Invoice, InvoiceItem } from '@shared/schema';
import { format } from 'date-fns';

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
  page.drawText('Einsatzbericht / Job Report', { x: margin, y, size: 20, font: boldFont });
  y -= 30;
  page.drawText(`Job Number: #${job.jobNumber}`, { x: margin, y, size: 12, font });
  y -= 20;
  page.drawText(`Datum: ${format(new Date(job.dateTime), 'dd.MM.yyyy HH:mm')}`, { x: margin, y, size: 12, font });
  y -= 40;

  // Customer
  page.drawText('Kunde / Customer:', { x: margin, y, size: 14, font: boldFont });
  y -= 20;
  const customerName = propertyManager ? propertyManager.name : (privateCustomer ? privateCustomer.name : 'Unknown');
  const customerAddress = propertyManager ? propertyManager.address : (privateCustomer ? privateCustomer.address : '');
  const customerPhone = propertyManager ? propertyManager.phone : (privateCustomer ? privateCustomer.phone : '');
  
  page.drawText(`Name: ${customerName}`, { x: margin, y, size: 12, font });
  y -= 15;
  page.drawText(`Adresse: ${customerAddress}`, { x: margin, y, size: 12, font });
  y -= 15;
  page.drawText(`Tel: ${customerPhone}`, { x: margin, y, size: 12, font });
  y -= 30;

  // Service Address
  page.drawText('Einsatzort / Service Address:', { x: margin, y, size: 14, font: boldFont });
  y -= 20;
  page.drawText(job.serviceAddress, { x: margin, y, size: 12, font });
  y -= 30;

  // Company
  page.drawText('Ausführender Betrieb / Service Provider:', { x: margin, y, size: 14, font: boldFont });
  y -= 20;
  page.drawText(company ? company.companyName : 'N/A', { x: margin, y, size: 12, font });
  y -= 15;
  page.drawText(`Kontakt: ${company ? company.contactName : ''}`, { x: margin, y, size: 12, font });
  y -= 15;
  page.drawText(`Tel: ${company ? company.phone : ''}`, { x: margin, y, size: 12, font });
  y -= 30;

  // Job Details
  page.drawText('Details:', { x: margin, y, size: 14, font: boldFont });
  y -= 20;
  page.drawText(`Gewerk: ${job.trade}`, { x: margin, y, size: 12, font });
  y -= 15;
  page.drawText(`Tätigkeit: ${job.activity}`, { x: margin, y, size: 12, font });
  y -= 15;
  page.drawText(`Status: ${job.status}`, { x: margin, y, size: 12, font });
  y -= 30;

  // Report
  page.drawText('Bericht / Report:', { x: margin, y, size: 14, font: boldFont });
  y -= 20;
  if (job.reportText) {
    page.drawText(job.reportText, { x: margin, y, size: 12, font, maxWidth: width - 2 * margin });
  } else {
    page.drawText('(Kein Bericht / No report text)', { x: margin, y, size: 12, font, color: rgb(0.5, 0.5, 0.5) });
  }

  // Footer
  page.drawText('Notprofi24.at', { x: margin, y: 30, size: 10, font, color: rgb(0.5, 0.5, 0.5) });

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
  page.drawText('Rechnung / Invoice', { x: margin, y, size: 20, font: boldFont });
  y -= 30;
  page.drawText(`Rechnung Nr.: ${invoice.invoiceNumber}`, { x: margin, y, size: 12, font });
  y -= 20;
  page.drawText(`Monat: ${invoice.monthYear}`, { x: margin, y, size: 12, font });
  y -= 20;
  page.drawText(`Datum: ${format(new Date(invoice.createdAt || new Date()), 'dd.MM.yyyy')}`, { x: margin, y, size: 12, font });
  y -= 40;

  // Recipient (Company)
  page.drawText('Empfänger / Recipient:', { x: margin, y, size: 14, font: boldFont });
  y -= 20;
  page.drawText(company ? company.companyName : 'Unknown Company', { x: margin, y, size: 12, font });
  y -= 15;
  page.drawText(company ? company.address : '', { x: margin, y, size: 12, font });
  y -= 40;

  // Items Table Header
  page.drawText('Positionen:', { x: margin, y, size: 14, font: boldFont });
  y -= 20;
  
  // Table Header
  page.drawText('Job #', { x: margin, y, size: 10, font: boldFont });
  page.drawText('Datum', { x: margin + 60, y, size: 10, font: boldFont });
  page.drawText('Adresse', { x: margin + 140, y, size: 10, font: boldFont });
  page.drawText('Betrag', { x: width - margin - 50, y, size: 10, font: boldFont });
  y -= 15;
  page.drawLine({ start: { x: margin, y: y + 5 }, end: { x: width - margin, y: y + 5 }, thickness: 1 });
  y -= 15;

  // Items
  for (const item of items) {
    page.drawText(`#${item.job.jobNumber}`, { x: margin, y, size: 10, font });
    page.drawText(format(new Date(item.job.dateTime), 'dd.MM.yy'), { x: margin + 60, y, size: 10, font });
    
    // Truncate address if too long
    let addr = item.job.serviceAddress;
    if (addr.length > 40) addr = addr.substring(0, 37) + '...';
    page.drawText(addr, { x: margin + 140, y, size: 10, font });
    
    page.drawText(`€ ${item.amount}`, { x: width - margin - 50, y, size: 10, font });
    y -= 20;

    // Page break check (simple)
    if (y < 50) {
      // Add new page? For MVP assuming single page invoice is enough for typical monthly volume per company
      // Or just stop
    }
  }

  y -= 20;
  page.drawLine({ start: { x: margin, y: y + 20 }, end: { x: width - margin, y: y + 20 }, thickness: 1 });

  // Total
  page.drawText('Gesamtbetrag / Total:', { x: margin + 300, y, size: 12, font: boldFont });
  page.drawText(`€ ${invoice.totalAmount}`, { x: width - margin - 50, y, size: 12, font: boldFont });
  y -= 40;

  // Footer Note
  page.drawText('Vermittlungsgebühr Notprofi24.at: 60 € pro Einsatz', { x: margin, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
  y -= 15;
  page.drawText('Bitte überweisen Sie den Betrag innerhalb von 14 Tagen.', { x: margin, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });

  return await pdfDoc.save();
}
