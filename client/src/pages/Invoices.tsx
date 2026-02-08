import { DataTable } from "@/components/DataTable";
import { useInvoices, useGenerateInvoices, useInvoiceActions, useMarkInvoicePaid } from "@/hooks/use-invoices";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, CheckCircle, Mail, Loader2 } from "lucide-react";
import { format } from "date-fns";

async function fetchInvoiceDetail(id: number) {
  const res = await fetch(`/api/invoices/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Invoice detail konnte nicht geladen werden");
  return res.json();
}

export default function Invoices() {
  const { data: invoices, isLoading } = useInvoices();
  const { mutateAsync: generate, isPending: isGenerating } = useGenerateInvoices();
  const { mutateAsync: markPaid, isPending: isMarking } = useMarkInvoicePaid();
  const { downloadPdf, sendEmail } = useInvoiceActions();
  const { toast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<any>(null);

  const handleGenerate = async () => {
    try {
      const res = await generate(selectedMonth);
      toast({ title: "Erfolg", description: `${res.generatedCount} Rechnungen aktualisiert/erstellt.` });
    } catch (e: any) {
      toast({ title: "Fehler", description: String(e?.message ?? e), variant: "destructive" });
    }
  };

  const handleMarkPaid = async (id: number) => {
    try {
      await markPaid(id);
      toast({ title: "Bezahlt", description: "Rechnung wurde als bezahlt markiert." });
    } catch (e: any) {
      toast({ title: "Fehler", description: String(e?.message ?? e), variant: "destructive" });
    }
  };

  const openDetail = async (invoiceRow: any) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailInvoice(null);
    try {
      const detail = await fetchInvoiceDetail(invoiceRow.id);
      setDetailInvoice(detail);
    } catch (e: any) {
      toast({ title: "Fehler", description: String(e?.message ?? e), variant: "destructive" });
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    {
      header: "Rechnungsnr.",
      accessorKey: "invoiceNumber",
      cell: (item: any) => (
        <button className="font-mono font-bold text-blue-700 underline" onClick={() => openDetail(item)}>
          {item.invoiceNumber}
        </button>
      ),
    },
    { header: "Firma", accessorKey: "company.companyName", cell: (item: any) => item.company?.companyName },
    { header: "Monat", accessorKey: "monthYear" },

    { header: "Einsätze", accessorKey: "itemCount", cell: (item: any) => item.itemCount ?? 0 },
    { header: "Netto", accessorKey: "totalNet", cell: (item: any) => `€ ${Number(item.totalNet ?? 0).toFixed(2)}` },
    { header: "USt (20%)", accessorKey: "vat", cell: (item: any) => `€ ${Number(item.vat ?? 0).toFixed(2)}` },

    // ✅ Brutto = totalAmount (wird jetzt serverseitig korrekt gesetzt)
    { header: "Brutto", accessorKey: "totalAmount", cell: (item: any) => `€ ${Number(item.totalAmount ?? 0).toFixed(2)}` },

    {
      header: "Status",
      accessorKey: "status",
      cell: (item: any) => (
        <Badge
          variant={item.status === "paid" ? "default" : "outline"}
          className={item.status === "paid" ? "bg-green-600" : "text-orange-600 border-orange-200 bg-orange-50"}
        >
          {item.status === "paid" ? "Bezahlt" : "Offen"}
        </Badge>
      ),
    },
    {
      header: "Aktionen",
      cell: (item: any) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => downloadPdf(item.id)} title="PDF Download">
            <Download className="h-4 w-4 text-slate-500" />
          </Button>

          {item.status === "unpaid" && (
            <Button variant="ghost" size="icon" onClick={() => handleMarkPaid(item.id)} disabled={isMarking} title="Als bezahlt markieren">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </Button>
          )}

          <Button variant="ghost" size="icon" onClick={() => sendEmail(item.id)} title="Email senden">
            <Mail className="h-4 w-4 text-blue-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-900">Abrechnung</h2>
          <p className="text-slate-500 mt-2">Monatliche Provisionsabrechnungen für Partner (zusammengezählt)</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Abrechnungsmonat</label>
            <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-40 h-9" />
          </div>
          <Button onClick={handleGenerate} disabled={isGenerating} className="h-9 mt-5">
            {isGenerating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <FileText className="mr-2 h-4 w-4" />}
            Generieren
          </Button>
        </div>
      </div>

      <DataTable
        data={invoices || []}
        columns={columns as any}
        searchKeys={[
          "invoiceNumber",
          "monthYear",
          "status",
          "totalAmount",
          "totalNet",
          "vat",
          "itemCount",
          "company.companyName",
          "company.phone",
          "company.email",
          "company.address",
        ]}
        searchPlaceholder="Suche: Rechnung, Firma, Monat, Einsätze, Netto/USt/Brutto, Status..."
        isLoading={isLoading}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Rechnungsdetails</DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-10 flex items-center justify-center gap-2 text-slate-600">
              <Loader2 className="animate-spin h-5 w-5" /> Lädt...
            </div>
          ) : !detailInvoice ? (
            <div className="py-10 text-slate-600">Keine Daten</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-slate-50">
                <div className="font-mono font-bold">{detailInvoice.invoiceNumber}</div>
                <div className="text-sm text-slate-600">
                  Firma: <b>{detailInvoice.company?.companyName}</b> · Monat: <b>{detailInvoice.monthYear}</b> · Status:{" "}
                  <b>{detailInvoice.status === "paid" ? "Bezahlt" : "Offen"}</b>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="grid grid-cols-6 bg-slate-100 text-xs font-semibold p-2">
                  <div>Job#</div>
                  <div>Datum</div>
                  <div className="col-span-2">Adresse</div>
                  <div>Gewerk</div>
                  <div>Status</div>
                </div>

                {(detailInvoice.items || []).map((it: any) => (
                  <div key={it.id} className="grid grid-cols-6 p-2 border-t text-sm">
                    <div className="font-mono">#{it.job?.jobNumber ?? it.jobId}</div>
                    <div>{it.job?.dateTime ? new Date(it.job.dateTime).toLocaleString("de-AT") : ""}</div>
                    <div className="col-span-2">{it.job?.serviceAddress ?? ""}</div>
                    <div>{it.job?.trade ?? ""}</div>
                    <div>{it.job?.status ?? ""}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
