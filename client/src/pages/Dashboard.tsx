import { useStats } from "@/hooks/use-stats";
import { StatsCard } from "@/components/StatsCard";
import { Briefcase, CheckCircle, FileText, TrendingUp, AlertCircle, Building2, HardHat } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

export default function Dashboard() {
  const { data: stats, isLoading } = useStats();

  // Mock chart data - in a real app this would come from the API
  const chartData = [
    { name: 'Jan', revenue: 4000 },
    { name: 'Feb', revenue: 3000 },
    { name: 'Mär', revenue: 2000 },
    { name: 'Apr', revenue: 2780 },
    { name: 'Mai', revenue: 1890 },
    { name: 'Jun', revenue: 2390 },
    { name: 'Jul', revenue: 3490 },
  ];

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
          value={`€ ${stats?.monthlyRevenue.toLocaleString('de-AT')}`}
          icon={TrendingUp}
          description="Geschätzter Umsatz"
          color="blue"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="p-6 bg-white rounded-2xl shadow-sm border border-border/50">
          <h3 className="text-lg font-bold mb-6 font-display">Umsatzentwicklung</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="hsl(var(--primary))" fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-6 bg-white rounded-2xl shadow-sm border border-border/50">
          <h3 className="text-lg font-bold mb-4 font-display">Schnellzugriff</h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md hover:border-primary/20 transition-all text-left group">
              <div className="bg-blue-100 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Briefcase className="w-5 h-5 text-blue-600" />
              </div>
              <div className="font-semibold text-slate-900">Neuer Einsatz</div>
              <div className="text-sm text-slate-500 mt-1">Einsatz erfassen & zuweisen</div>
            </button>
            <button className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md hover:border-primary/20 transition-all text-left group">
              <div className="bg-purple-100 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div className="font-semibold text-slate-900">Rechnungen</div>
              <div className="text-sm text-slate-500 mt-1">Für diesen Monat generieren</div>
            </button>
            <button className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md hover:border-primary/20 transition-all text-left group">
              <div className="bg-green-100 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Building2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="font-semibold text-slate-900">Neue HV</div>
              <div className="text-sm text-slate-500 mt-1">Hausverwaltung anlegen</div>
            </button>
            <button className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md hover:border-primary/20 transition-all text-left group">
              <div className="bg-orange-100 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <HardHat className="w-5 h-5 text-orange-600" />
              </div>
              <div className="font-semibold text-slate-900">Neuer Betrieb</div>
              <div className="text-sm text-slate-500 mt-1">Partnerfirma hinzufügen</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
