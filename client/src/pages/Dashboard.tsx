import { useStats } from "@/hooks/use-stats";
import { StatsCard } from "@/components/StatsCard";
import { Briefcase, CheckCircle, FileText, TrendingUp, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { data: stats, isLoading } = useStats();
  const [, setLocation] = useLocation();

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
      <div>
        <h2 className="text-3xl font-display font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500 mt-2">Überblick über die aktuellen Geschäftsaktivitäten</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <button
          className="text-left"
          onClick={() => setLocation("/jobs?status=open")}
          title="Offene Einsätze anzeigen"
        >
          <StatsCard
            title="Offene Einsätze"
            value={stats?.openJobs || 0}
            icon={AlertCircle}
            description="Aktuell in Bearbeitung"
            color="orange"
          />
        </button>

        <button
          className="text-left"
          onClick={() => setLocation("/jobs?status=done")}
          title="Erledigte Einsätze anzeigen"
        >
          <StatsCard
            title="Erledigte Einsätze"
            value={stats?.doneJobsMonth || 0}
            icon={CheckCircle}
            description="In diesem Monat"
            color="green"
          />
        </button>

        <button
          className="text-left"
          onClick={() => setLocation("/invoices")}
          title="Offene Rechnungen anzeigen"
        >
          <StatsCard
            title="Offene Rechnungen"
            value={stats?.unpaidInvoices || 0}
            icon={FileText}
            description="Warten auf Zahlung"
            color="red"
          />
        </button>

        <button
          className="text-left"
          onClick={() => setLocation("/invoices")}
          title="Abrechnung öffnen"
        >
          <StatsCard
            title="Monatsumsatz"
            value={`€ ${(stats?.monthlyRevenue ?? 0).toLocaleString("de-AT")}`}
            icon={TrendingUp}
            description="Geschätzter Umsatz"
            color="blue"
          />
        </button>
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
            <div className="text-sm text-slate-500 mt-1">Übersicht & Suche</div>
          </button>

          <button
            onClick={() => setLocation("/jobs?status=open")}
            className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md hover:border-primary/20 transition-all text-left group"
          >
            <div className="bg-orange-100 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div className="font-semibold text-slate-900">Offen</div>
            <div className="text-sm text-slate-500 mt-1">Nur offene Einsätze</div>
          </button>

          <button
            onClick={() => setLocation("/jobs?status=done")}
            className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md hover:border-primary/20 transition-all text-left group"
          >
            <div className="bg-green-100 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="font-semibold text-slate-900">Erledigt</div>
            <div className="text-sm text-slate-500 mt-1">Nur erledigte Einsätze</div>
          </button>

          <button
            onClick={() => setLocation("/invoices")}
            className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md hover:border-primary/20 transition-all text-left group"
          >
            <div className="bg-purple-100 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div className="font-semibold text-slate-900">Rechnungen</div>
            <div className="text-sm text-slate-500 mt-1">Abrechnung & Status</div>
          </button>
        </div>
      </div>
    </div>
  );
}
