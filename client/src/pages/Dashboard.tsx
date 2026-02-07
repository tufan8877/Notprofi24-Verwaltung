import { useStats } from "@/hooks/use-stats";
import { useGenerateInvoices } from "@/hooks/use-invoices";
import { StatsCard } from "@/components/StatsCard";
import { Briefcase, CheckCircle, FileText, TrendingUp, AlertCircle, Building2, HardHat, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading } = useStats();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [monthYear, setMonthYear] = useState(format(new Date(), "yyyy-MM"));
  const { mutateAsync: generateInvoices, isPending: isGenerating } = useGenerateInvoices();

  const runGenerate = async () => {
    try {
      const res = await generateInvoices(monthYear);
      toast({ title: "Erfolg", description: `${res.generatedCount} Rechnungen generiert.` });
      setInvoiceOpen(false);
      setLocation("/invoices");
    } catch (e: any) {
      toast({
        title: "Fehler",
        description: String(e?.message ?? e),
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-display font-bold text-slate-900">Dashboard</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-900">Dashboard</h2>
          <p className="text-slate-500 mt-2">Überblick über die aktuellen Geschäftsaktivitäten</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Offene Einsätze"
          value={stats?.openJobs || 0}
          icon={AlertCircle}
          description="Aktuell in Bearbeitung"
          color="orange"
        />
        <StatsCard
          title="Erledigte Einsätze"
          value={stats?.doneJobsMonth || 0}
          icon={CheckCircle}
          description="In diesem Monat"
          color="green"
        />
        <StatsCard
          title="Offene Rechnungen"
          value={stats?.unpaidInvoices || 0}
          icon={FileText}
          description="Warten auf Zahlung"
          color="red"
        />
        <StatsCard
          title="Monatsumsatz"
          value={`€ ${(stats?.monthlyRevenue ?? 0).toLocaleString("de-AT")}`}
          icon={TrendingUp}
          description="Geschätzter Umsatz"
          color="blue"
        />
      </div>

      <div className="p-6 bg-white rounded-2xl shadow-sm border border-border/50">
        <h3 className="text-lg font-bold mb-4 font-display">Schnellzugriff</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setLocation("/jobs")}
            className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md hover:border-primary/20 transition-all text-left group"
          >
            <div className="bg-blue-100 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
            <div className="font-semibold text-slate-900">Einsätze</div>
            <div className="text-sm text-slate-500 mt-1">Einsatz erfassen & zuweisen</div>
          </button>

          <button
            onClick={() => setInvoiceOpen(true)}
            className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md hover:border-primary/20 transition-all text-left group"
          >
            <div className="bg-purple-100 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div className="font-semibold text-slate-900">Rechnungen</div>
            <div className="text-sm text-slate-500 mt-1">Monat wählen & generieren</div>
          </button>

          <button
            onClick={() => setLocation("/property-managers")}
            className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md hover:border-primary/20 transition-all text-left group"
          >
            <div className="bg-green-100 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Building2 className="w-5 h-5 text-green-600" />
            </div>
            <div className="font-semibold text-slate-900">Hausverwaltungen</div>
            <div className="text-sm text-slate-500 mt-1">HV anlegen & verwalten</div>
          </button>

          <button
            onClick={() => setLocation("/companies")}
            className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md hover:border-primary/20 transition-all text-left group"
          >
            <div className="bg-orange-100 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <HardHat className="w-5 h-5 text-orange-600" />
            </div>
            <div className="font-semibold text-slate-900">Betriebe</div>
            <div className="text-sm text-slate-500 mt-1">Partnerfirma hinzufügen</div>
          </button>
        </div>
      </div>

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rechnungen generieren</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-700">Abrechnungsmonat</label>
            <Input type="month" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} />
            <Button onClick={runGenerate} disabled={isGenerating} className="w-full">
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generieren
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
