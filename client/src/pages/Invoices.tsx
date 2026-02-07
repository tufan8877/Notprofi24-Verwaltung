import { DataTable } from "@/components/DataTable";
import { useInvoices, useGenerateInvoices, useInvoiceActions, useMarkInvoicePaid } from "@/hooks/use-invoices";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, CheckCircle, Mail, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function Invoices() {
  const { data: invoices, isLoading } = useInvoices();
  const { mutateAsync: generate, isPending: isGenerating } = useGenerateInvoices();
  const { mutateAsync: markPaid } = useMarkInvoicePaid();
  const { downloadPdf, sendEmail } = useInvoiceActions();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const handleGenerate = async () => {
    try {
      const res = await generate(selectedMonth);
      toast({ title: "Erfolg", description: `${res.generatedCount} Rechnungen generiert.` });
    } catch (e: any) {
      toast({ title: "Fehler", description: String(e?.message ?? e), variant: "destructive" });
    }
  };

  const handleMarkPaid = async (id: number) => {
    try {
      await markPaid(id);
      toast({ title: "Bezahlt", description: "Rechnung als bezahlt markiert." });
    } catch (e: any) {
      toast({ title: "Fehler", description: String(e?.message ?? e), variant: "destructive" });
    }
  };

  const columns = [
    { header: "Rechnungsnr.", accessorKey: "invoiceNumber", className: "font-mono font-bold" },
    { header: "Firma", accessorKey: "company.companyName", cell: (item: any) => item.company?.companyName },
    { header: "Monat", accessorKey: "monthYear" },
    { header: "Betrag", accessorKey: "totalAmount", cell: (item: any) => `€ ${Number(item.totalAmount).toFixed(2)}` },
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
      )
    },
    {
      header: "Aktionen",
      cell: (item: any) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => downloadPdf(item.id)} title="Download PDF">
            <Download className="h-4 w-4 text-slate-500" />
          </Button>
          {item.status === "unpaid" && (
            <Button variant="ghost" size="icon" onClick={() => handleMarkPaid(item.id)} title="Als bezahlt markieren">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => sendEmail(item.id)} title="Senden">
            <Mail className="h-4 w-4 text-blue-500" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-900">Abrechnung</h2>
          <p className="text-slate-500 mt-2">Monatliche Provisionsabrechnungen für Partner</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Abrechnungsmonat</label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-40 h-9"
            />
          </div>
          <Button onClick={handleGenerate} disabled={isGenerating} className="h-9 mt-5">
            {isGenerating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <FileText className="mr-2 h-4 w-4" />}
            Generieren
          </Button>
        </div>
      </div>

      <DataTable
        data={invoices || []}
        columns={columns}
        searchKeys={[
          "invoiceNumber",
          "monthYear",
          "status",
          "totalAmount",
          "company.companyName",
          "company.phone",
          "company.email",
        ]}
        searchPlaceholder="Suche: Rechnungsnr., Firma, Monat, Betrag, Status..."
        isLoading={isLoading}
      />
    </div>
  );
}
