import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@shared/routes";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useJobs, useCreateJob, useUpdateJob } from "@/hooks/use-jobs";
import { useCompanies } from "@/hooks/use-companies";
import { usePropertyManagers } from "@/hooks/use-property-managers";
import { usePrivateCustomers } from "@/hooks/use-private-customers";
import { useLocation } from "wouter";

function statusBadge(status: string) {
  if (status === "done") return <Badge className="bg-green-600">Erledigt</Badge>;
  if (status === "canceled") return <Badge variant="destructive">Storniert</Badge>;
  return <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">Offen</Badge>;
}

function toDateTimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
function fromDateTimeLocalValue(v: string) {
  return new Date(v);
}

function readQuery() {
  const params = new URLSearchParams(window.location.search);
  const status = (params.get("status") || "all").toLowerCase();
  const companyId = params.get("companyId");
  return {
    status: (status === "open" || status === "done" || status === "canceled") ? status : "all",
    companyId: companyId ? Number(companyId) : null,
  } as { status: "all" | "open" | "done" | "canceled"; companyId: number | null };
}

function setQuery(setLocation: (path: string) => void, next: { status?: string; companyId?: number | null }) {
  const params = new URLSearchParams(window.location.search);
  if (next.status !== undefined) {
    if (next.status === "all") params.delete("status");
    else params.set("status", next.status);
  }
  if (next.companyId !== undefined) {
    if (!next.companyId) params.delete("companyId");
    else params.set("companyId", String(next.companyId));
  }
  const qs = params.toString();
  setLocation(qs ? `/jobs?${qs}` : "/jobs");
}

export default function Jobs() {
  const { data: jobs, isLoading } = useJobs();
  const { data: companies } = useCompanies();
  const { data: managers } = usePropertyManagers();
  const { data: customers } = usePrivateCustomers();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [filters, setFilters] = useState(readQuery());

  useEffect(() => {
    const onPop = () => setFilters(readQuery());
    window.addEventListener("popstate", onPop);
    setFilters(readQuery());
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const counts = useMemo(() => {
    const all = jobs || [];
    return {
      all: all.length,
      open: all.filter((j: any) => j.status === "open").length,
      done: all.filter((j: any) => j.status === "done").length,
      canceled: all.filter((j: any) => j.status === "canceled").length,
    };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    let list = jobs || [];
    if (filters.companyId) list = list.filter((j: any) => j.companyId === filters.companyId);
    if (filters.status !== "all") list = list.filter((j: any) => j.status === filters.status);
    return list;
  }, [jobs, filters]);

  const companyName = useMemo(() => {
    if (!filters.companyId) return null;
    const c = (companies || []).find((x: any) => x.id === filters.companyId);
    return c?.companyName ?? `Firma #${filters.companyId}`;
  }, [filters.companyId, companies]);

  const columns = useMemo(
    () => [
      { header: "Job#", accessorKey: "jobNumber", className: "font-mono font-bold" },
      { header: "Datum", accessorKey: "dateTime", cell: (j: any) => (j.dateTime ? new Date(j.dateTime).toLocaleString("de-AT") : "") },
      { header: "Adresse", accessorKey: "serviceAddress" },
      { header: "Gewerk", accessorKey: "trade" },
      { header: "Tätigkeit", accessorKey: "activity" },
      { header: "Firma", accessorKey: "company.companyName", cell: (j: any) => j.company?.companyName ?? "" },
      {
        header: "Kunde",
        accessorKey: "customerType",
        cell: (j: any) =>
          j.customerType === "property_manager" ? j.propertyManager?.name ?? "Hausverwaltung" : j.privateCustomer?.name ?? "Privatkunde",
      },
      { header: "Status", accessorKey: "status", cell: (j: any) => statusBadge(j.status) },
      {
        header: "Aktionen",
        cell: (j: any) => (
          <Button
            variant="link"
            onClick={() => {
              setEditingItem(j);
              setIsOpen(true);
            }}
          >
            Bearbeiten
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-900">Einsätze</h2>
          <p className="text-slate-500 mt-2">
            {companyName ? (
              <span>
                Filter: <span className="font-semibold">{companyName}</span> · Status: <span className="font-semibold">{filters.status}</span>
              </span>
            ) : (
              <span>Status: <span className="font-semibold">{filters.status}</span></span>
            )}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filters.status === "all" ? "default" : "outline"}
            onClick={() => {
              setFilters((f) => ({ ...f, status: "all" }));
              setQuery(setLocation, { status: "all" });
            }}
          >
            Alle ({counts.all})
          </Button>
          <Button
            variant={filters.status === "open" ? "default" : "outline"}
            onClick={() => {
              setFilters((f) => ({ ...f, status: "open" }));
              setQuery(setLocation, { status: "open" });
            }}
          >
            Offen ({counts.open})
          </Button>
          <Button
            variant={filters.status === "done" ? "default" : "outline"}
            onClick={() => {
              setFilters((f) => ({ ...f, status: "done" }));
              setQuery(setLocation, { status: "done" });
            }}
          >
            Erledigt ({counts.done})
          </Button>
          <Button
            variant={filters.status === "canceled" ? "default" : "outline"}
            onClick={() => {
              setFilters((f) => ({ ...f, status: "canceled" }));
              setQuery(setLocation, { status: "canceled" });
            }}
          >
            Storniert ({counts.canceled})
          </Button>

          {filters.companyId ? (
            <Button
              variant="outline"
              onClick={() => {
                setFilters((f) => ({ ...f, companyId: null }));
                setQuery(setLocation, { companyId: null });
              }}
            >
              Firmenfilter entfernen
            </Button>
          ) : null}

          <Button
            onClick={() => {
              setEditingItem(null);
              setIsOpen(true);
            }}
          >
            Neuer Einsatz
          </Button>
        </div>
      </div>

      <DataTable
        data={filteredJobs}
        columns={columns as any}
        searchKeys={[
          "jobNumber",
          "dateTime",
          "serviceAddress",
          "trade",
          "activity",
          "status",
          "reportText",
          "company.companyName",
          "company.contactName",
          "company.phone",
          "company.email",
          "company.address",
          "company.trades",
          "company.notes",
          "propertyManager.name",
          "propertyManager.address",
          "propertyManager.phone",
          "propertyManager.email",
          "propertyManager.notes",
          "privateCustomer.name",
          "privateCustomer.address",
          "privateCustomer.phone",
          "privateCustomer.email",
          "privateCustomer.notes",
        ]}
        searchPlaceholder="Suche: Adresse, Gewerk, Firma, Kunde, Telefon, Email, Status, Bericht, Notes..."
        isLoading={isLoading}
      />

      <JobDialog
        open={isOpen}
        onOpenChange={(o) => {
          setIsOpen(o);
          if (!o) setEditingItem(null);
        }}
        item={editingItem}
        companies={companies || []}
        managers={managers || []}
        customers={customers || []}
        onSaved={() => toast({ title: "Gespeichert" })}
      />
    </div>
  );
}

function JobDialog({
  open,
  onOpenChange,
  item,
  companies,
  managers,
  customers,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: any;
  companies: any[];
  managers: any[];
  customers: any[];
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const { mutateAsync: create } = useCreateJob();
  const { mutateAsync: update } = useUpdateJob();

  const form = useForm({
    resolver: zodResolver(api.jobs.create.input),
    defaultValues: {
      dateTime: new Date(),
      customerType: "property_manager",
      propertyManagerId: undefined as any,
      privateCustomerId: undefined as any,
      serviceAddress: "",
      companyId: undefined as any,
      trade: "Installateur",
      activity: "",
      status: "open",
      reportText: "",
      referralFee: "49",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (item) {
      form.reset({
        dateTime: item.dateTime ? new Date(item.dateTime) : new Date(),
        customerType: item.customerType ?? "property_manager",
        propertyManagerId: item.propertyManagerId ?? undefined,
        privateCustomerId: item.privateCustomerId ?? undefined,
        serviceAddress: item.serviceAddress ?? "",
        companyId: item.companyId ?? undefined,
        trade: item.trade ?? "Installateur",
        activity: item.activity ?? "",
        status: item.status ?? "open",
        reportText: item.reportText ?? "",
        referralFee: item.referralFee ?? "49",
      });
    } else {
      form.reset({
        dateTime: new Date(),
        customerType: "property_manager",
        propertyManagerId: undefined,
        privateCustomerId: undefined,
        serviceAddress: "",
        companyId: undefined,
        trade: "Installateur",
        activity: "",
        status: "open",
        reportText: "",
        referralFee: "49",
      });
    }
  }, [open, item, form]);

  const customerType = form.watch("customerType");

  async function onSubmit(data: any) {
    try {
      if (data.customerType === "property_manager") {
        data.privateCustomerId = null;
        if (!data.propertyManagerId) throw new Error("Bitte Hausverwaltung auswählen.");
      } else {
        data.propertyManagerId = null;
        if (!data.privateCustomerId) throw new Error("Bitte Privatkunde auswählen.");
      }

      if (!data.companyId) throw new Error("Bitte Betrieb auswählen.");
      if (!data.serviceAddress || String(data.serviceAddress).trim().length < 3) throw new Error("Bitte Einsatzadresse eingeben.");
      if (!data.trade) throw new Error("Bitte Gewerk wählen.");
      if (!data.activity || String(data.activity).trim().length < 3) throw new Error("Bitte Tätigkeit / Problem eingeben.");
      if (!(data.dateTime instanceof Date)) data.dateTime = new Date(data.dateTime);

      if (item?.id) await update({ id: item.id, ...data });
      else await create(data);

      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast({ title: "Fehler", description: String(e?.message ?? e), variant: "destructive" });
      console.error(e);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Einsatz bearbeiten" : "Neuer Einsatz"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dateTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Datum & Uhrzeit</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        value={field.value ? toDateTimeLocalValue(new Date(field.value)) : ""}
                        onChange={(e) => field.onChange(fromDateTimeLocalValue(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Status wählen" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="open">Offen</SelectItem>
                        <SelectItem value="done">Erledigt</SelectItem>
                        <SelectItem value="canceled">Storniert</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="serviceAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Einsatzadresse</FormLabel>
                  <FormControl><Input {...field} placeholder="z.B. Musterstraße 12, 1010 Wien" /></FormControl>
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
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Gewerk wählen" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Installateur">Installateur</SelectItem>
                        <SelectItem value="Elektriker">Elektriker</SelectItem>
                        <SelectItem value="Dachdecker">Dachdecker</SelectItem>
                        <SelectItem value="Schlosser">Schlosser</SelectItem>
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
                    <FormLabel>Betrieb</FormLabel>
                    <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Betrieb auswählen" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(companies || []).map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kundentyp</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Kundentyp wählen" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="property_manager">Hausverwaltung</SelectItem>
                        <SelectItem value="private_customer">Privatkunde</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {customerType === "property_manager" ? (
                <FormField
                  control={form.control}
                  name="propertyManagerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hausverwaltung</FormLabel>
                      <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
                        <FormControl><SelectTrigger><SelectValue placeholder="HV auswählen" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {(managers || []).map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>{m.name} — {m.phone}</SelectItem>
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
                      <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Privatkunde auswählen" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {(customers || []).map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name} — {c.phone}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="activity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tätigkeit / Problem</FormLabel>
                  <FormControl><Textarea rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reportText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bericht / Dokumentation</FormLabel>
                  <FormControl><Textarea rows={4} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button type="submit">{item ? "Speichern" : "Einsatz erstellen"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
