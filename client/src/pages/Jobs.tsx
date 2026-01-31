import { DataTable } from "@/components/DataTable";
import { useJobs, useCreateJob, useUpdateJob, useJobActions } from "@/hooks/use-jobs";
import { useCompanies } from "@/hooks/use-companies";
import { usePropertyManagers } from "@/hooks/use-property-managers";
import { usePrivateCustomers } from "@/hooks/use-private-customers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Eye, FileText, Mail, Check, X, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@shared/routes";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function Jobs() {
  const { data: jobs, isLoading } = useJobs();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null); // For detail view

  const columns = [
    {
      header: "Job Nr.",
      accessorKey: "jobNumber",
      className: "font-mono font-bold text-slate-600",
    },
    {
      header: "Datum",
      accessorKey: "dateTime",
      cell: (item: any) => format(new Date(item.dateTime), "dd.MM.yyyy HH:mm"),
    },
    {
      header: "Kunde",
      cell: (item: any) => item.customerType === 'property_manager' 
        ? item.propertyManager?.name 
        : item.privateCustomer?.name,
    },
    {
      header: "Firma",
      accessorKey: "company.companyName",
      cell: (item: any) => item.company?.companyName,
    },
    {
      header: "Gewerbe",
      accessorKey: "trade",
      cell: (item: any) => (
        <Badge variant="outline" className="bg-slate-50 font-normal">
          {item.trade}
        </Badge>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (item: any) => {
        const styles = {
          open: "bg-yellow-100 text-yellow-700 border-yellow-200",
          done: "bg-green-100 text-green-700 border-green-200",
          canceled: "bg-gray-100 text-gray-700 border-gray-200",
        };
        const labels = {
          open: "Offen",
          done: "Erledigt",
          canceled: "Storniert",
        };
        return (
          <Badge className={cn("capitalize shadow-none border", styles[item.status as keyof typeof styles])}>
            {labels[item.status as keyof typeof labels]}
          </Badge>
        );
      },
    },
    {
      header: "Aktionen",
      cell: (item: any) => (
        <Button variant="ghost" size="sm" onClick={() => setSelectedJob(item)}>
          <Eye className="h-4 w-4 text-slate-500" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold text-slate-900">Einsätze</h2>
        <p className="text-slate-500 mt-2">Verwaltung aller Aufträge und Einsätze</p>
      </div>

      <DataTable
        data={jobs || []}
        columns={columns}
        searchKey="jobNumber" // Or trade, or address - simple client side search
        createLabel="Neuer Einsatz"
        onCreate={() => setIsCreateOpen(true)}
        isLoading={isLoading}
      />

      <CreateJobDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      {selectedJob && (
        <JobDetailDialog job={selectedJob} open={!!selectedJob} onOpenChange={(o) => !o && setSelectedJob(null)} />
      )}
    </div>
  );
}

function CreateJobDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { mutateAsync: createJob, isPending } = useCreateJob();
  const { data: companies } = useCompanies();
  const { data: pms } = usePropertyManagers();
  const { data: privates } = usePrivateCustomers();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(api.jobs.create.input),
    defaultValues: {
      dateTime: new Date(),
      customerType: "property_manager",
      trade: "",
      activity: "",
      serviceAddress: "",
      referralFee: "60",
      status: "open",
    },
  });

  const customerType = form.watch("customerType");
  const selectedTrade = form.watch("trade");

  // Filter companies by trade
  const filteredCompanies = companies?.filter(c => 
    !selectedTrade || c.trades.includes(selectedTrade)
  ) || [];

  const allTrades = Array.from(new Set(companies?.flatMap(c => c.trades) || []));

  async function onSubmit(data: any) {
    try {
      await createJob(data);
      toast({ title: "Einsatz erstellt", description: "Der Einsatz wurde erfolgreich angelegt." });
      onOpenChange(false);
      form.reset();
    } catch (e) {
      toast({ title: "Fehler", description: "Einsatz konnte nicht erstellt werden.", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Neuen Einsatz anlegen</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dateTime"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Datum & Zeit</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn(!field.value && "text-muted-foreground", "pl-3 text-left font-normal w-full rounded-xl")}>
                            {field.value ? format(field.value, "PPP HH:mm", { locale: de }) : <span>Wähle Datum</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                         <div className="p-3 border-t">
                          <Input type="time" onChange={(e) => {
                            const [hours, minutes] = e.target.value.split(':');
                            const newDate = new Date(field.value);
                            newDate.setHours(parseInt(hours), parseInt(minutes));
                            field.onChange(newDate);
                          }} />
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kunden Typ</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Wähle Typ" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="property_manager">Hausverwaltung</SelectItem>
                        <SelectItem value="private_customer">Privatkunde</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {customerType === "property_manager" ? (
              <FormField
                control={form.control}
                name="propertyManagerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hausverwaltung</FormLabel>
                    <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Wähle HV" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pms?.map((pm) => (
                          <SelectItem key={pm.id} value={pm.id.toString()}>{pm.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="privateCustomerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Privatkunde</FormLabel>
                    <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Wähle Kunden" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {privates?.map((pc) => (
                          <SelectItem key={pc.id} value={pc.id.toString()}>{pc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="serviceAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Einsatzadresse</FormLabel>
                  <FormControl>
                    <Input placeholder="Straße, PLZ Ort" {...field} className="rounded-xl" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="trade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gewerk</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Wähle Gewerk" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allTrades.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Firma</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(parseInt(val))} 
                      value={field.value?.toString()}
                      disabled={!selectedTrade}
                    >
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder={selectedTrade ? "Wähle Firma" : "Zuerst Gewerk wählen"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredCompanies.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.companyName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="activity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tätigkeit / Beschreibung</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Was ist zu tun?" {...field} className="rounded-xl min-h-[100px]" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Abbrechen</Button>
              <Button type="submit" className="rounded-xl" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin h-4 w-4" /> : "Einsatz erstellen"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function JobDetailDialog({ job, open, onOpenChange }: { job: any, open: boolean, onOpenChange: (open: boolean) => void }) {
  const { mutateAsync: updateJob } = useUpdateJob();
  const { downloadPdf, sendEmail } = useJobActions();
  const { toast } = useToast();
  const [reportText, setReportText] = useState(job.reportText || "");

  const handleStatusChange = async (status: string) => {
    try {
      await updateJob({ id: job.id, status });
      toast({ title: "Status aktualisiert" });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleSaveReport = async () => {
    try {
      await updateJob({ id: job.id, reportText });
      toast({ title: "Bericht gespeichert" });
    } catch (e) {
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="font-display text-2xl">Einsatz #{job.jobNumber}</DialogTitle>
              <p className="text-muted-foreground mt-1">
                {format(new Date(job.dateTime), "PPP 'um' HH:mm", { locale: de })}
              </p>
            </div>
            <Badge variant={job.status === 'done' ? 'default' : 'secondary'} className="text-base px-3 py-1">
              {job.status === 'open' && 'Offen'}
              {job.status === 'done' && 'Erledigt'}
              {job.status === 'canceled' && 'Storniert'}
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-8 py-4">
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">Auftraggeber</h4>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-900">
                  {job.customerType === 'property_manager' ? job.propertyManager?.name : job.privateCustomer?.name}
                </p>
                <p className="text-slate-600 text-sm mt-1">
                  {job.customerType === 'property_manager' ? job.propertyManager?.address : job.privateCustomer?.address}
                </p>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">Ausführende Firma</h4>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-900">{job.company?.companyName}</p>
                <Badge variant="outline" className="mt-2 bg-white">{job.trade}</Badge>
              </div>
            </div>

             <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">Einsatzort</h4>
               <p className="text-slate-900">{job.serviceAddress}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">Tätigkeit</h4>
              <p className="text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 min-h-[80px]">
                {job.activity}
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">Bericht / Notizen</h4>
              <div className="flex gap-2">
                <Textarea 
                  value={reportText} 
                  onChange={(e) => setReportText(e.target.value)} 
                  className="rounded-xl min-h-[100px]" 
                  placeholder="Bericht hier eingeben..."
                />
              </div>
              <Button onClick={handleSaveReport} size="sm" variant="outline" className="mt-2 w-full">Speichern</Button>
            </div>
          </div>
        </div>

        <div className="border-t pt-6 flex flex-wrap gap-3 justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => downloadPdf(job.id)}>
              <FileText className="mr-2 h-4 w-4" /> PDF Vorschau
            </Button>
            <Button variant="outline" onClick={() => sendEmail(job.id)}>
              <Mail className="mr-2 h-4 w-4" /> E-Mail senden
            </Button>
          </div>
          
          <div className="flex gap-2">
            {job.status === 'open' && (
              <>
                 <Button variant="destructive" onClick={() => handleStatusChange('canceled')}>
                  <X className="mr-2 h-4 w-4" /> Stornieren
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleStatusChange('done')}>
                  <Check className="mr-2 h-4 w-4" /> Abschluss
                </Button>
              </>
            )}
             {job.status === 'done' && (
               <Button variant="outline" onClick={() => handleStatusChange('open')}>
                  Wieder öffnen
                </Button>
             )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
