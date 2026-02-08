// client/src/pages/Invoices.tsx
import * as React from "react";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { Download, Mail, CheckCircle2, Loader2, FileText } from "lucide-react";

type InvoiceItem = {
  id: number;
  invoiceId: number;
  jobId: number;
  amount: string; // stored as string in DB
  job?: any;
};

type Company = {
  id: number;
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
};

type Invoice = {
  id: number;
  invoiceNumber: string;
  monthYear: string; // YYYY-MM
  companyId: number;
  status: "unpaid" | "paid" | string;
  totalAmount?: string | null; // may be net, but we prefer summing items
  createdAt?: string | Date | null;
  sentAt?: string | Date | null;
  paidAt?: string | Date | null;
  company?: Company | null;
  items?: InvoiceItem[];
};

function toNumber(n: unknown): number {
  const x = Number(String(n ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatMoneyEUR(n: number): string {
  // keep it simple & robust
  return `€ ${n.toFixed(2)}`;
}

function statusLabel(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "paid" || s === "bezahlt") return "Bezahlt";
  return "Offen";
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const s = String(status || "").toLowerCase();
  if (s === "paid" || s === "bezahlt") return "default";
  return "secondary";
}

function normalizeText(v: unknown) {
  return String(v ?? "").toLowerCase().trim();
}

function currentMonthYYYYMM() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Download helper for POST endpoints that return a PDF
 */
async function postAndDownload(url: string, filename: string) {
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export default function InvoicesPage() {
  const qc = useQueryClient();

  // Month selection for generating invoices
  const [monthYear, setMonthYear] = useState<string>(currentMonthYYYYMM());

  // Search & selection
  const [search, setSearch] = useState<string>("");
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // VAT settings (fixed 20% per your requirement)
  const VAT_RATE = 0.2;

  // Fetch invoices
  const invoicesQuery = useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await fetch(api.invoices.list.path, { method: "GET" });
      if (!res.ok) throw new Error("Failed to load invoices");
      return await res.json();
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const generateMutation = useMutation({
    mutationFn: async (payload: { monthYear: string }) => {
      const res = await fetch(api.invoices.generate.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Failed to generate invoices");
      }
      return await res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const url = api.invoices.markPaid.path.replace(":id", String(invoiceId));
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Failed to mark paid");
      }
      return await res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const url = api.invoices.sendEmail.path.replace(":id", String(invoiceId));
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Failed to send email");
      }
      return await res.json();
    },
  });

  const isLoading = invoicesQuery.isLoading;
  const invoices = invoicesQuery.data ?? [];

  /**
   * IMPORTANT:
   * You requested:
   * - ONE invoice per company per month (server should generate this)
   * - Clicking invoice shows ALL jobs (items) for that invoice
   *
   * If the server still creates duplicates, we guard in UI by grouping by (companyId, monthYear)
   * and showing only the newest invoice for that group.
   */
  const groupedInvoices = useMemo(() => {
    const map = new Map<string, Invoice[]>();
    for (const inv of invoices) {
      const key = `${inv.companyId}__${inv.monthYear}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(inv);
    }
    // pick newest by id (highest id)
    const uniq: Invoice[] = [];
    for (const arr of map.values()) {
      const sorted = [...arr].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
      uniq.push(sorted[0]);
    }
    // sort newest first
    uniq.sort((a, b) => {
      // prefer month desc then id desc
      const mA = normalizeText(a.monthYear);
      const mB = normalizeText(b.monthYear);
      if (mA === mB) return (b.id ?? 0) - (a.id ?? 0);
      return mB.localeCompare(mA);
    });
    return uniq;
  }, [invoices]);

  function computeInvoiceNet(inv: Invoice): number {
    const items = inv.items ?? [];
    if (items.length > 0) {
      const sum = items.reduce((acc, it) => acc + toNumber(it.amount), 0);
      return round2(sum);
    }
    // fallback
    return round2(toNumber(inv.totalAmount));
  }

  function computeInvoiceVat(net: number): number {
    return round2(net * VAT_RATE);
  }

  function computeInvoiceGross(net: number): number {
    return round2(net + computeInvoiceVat(net));
  }

  function computeInvoiceCount(inv: Invoice): number {
    return (inv.items ?? []).length;
  }

  const filteredInvoices = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return groupedInvoices;

    return groupedInvoices.filter((inv) => {
      const companyName = inv.company?.companyName ?? "";
      const status = statusLabel(inv.status);
      const net = computeInvoiceNet(inv);
      const vat = computeInvoiceVat(net);
      const gross = computeInvoiceGross(net);
      const jobsCount = computeInvoiceCount(inv);

      const hay = [
        inv.invoiceNumber,
        companyName,
        inv.monthYear,
        status,
        String(jobsCount),
        net.toFixed(2),
        vat.toFixed(2),
        gross.toFixed(2),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [groupedInvoices, search]);

  // Open details dialog
  function openDetails(inv: Invoice) {
    setSelected(inv);
    setDetailsOpen(true);
  }

  async function downloadInvoicePdf(inv: Invoice) {
    const url = api.invoices.generatePdf.path.replace(":id", String(inv.id));
    const filename = `invoice-${inv.invoiceNumber}.pdf`;
    await postAndDownload(url, filename);
  }

  async function downloadJobPdf(jobId: number, jobNumber?: string | number) {
    const url = api.jobs.generatePdf.path.replace(":id", String(jobId));
    const filename = `job-${jobNumber ?? jobId}.pdf`;
    await postAndDownload(url, filename);
  }

  // Some UIs show “Brutto” but mistakenly show Net. We always compute:
  // Net = sum(items.amount)
  // VAT 20% = net*0.2
  // Gross = net + vat
  // (Your requirement: 49 netto + 20% = 58.80 brutto per job; Storno 14.90 netto + 20%)
  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Abrechnung</h1>
          <p className="text-sm text-muted-foreground">
            Monatliche Provisionsabrechnungen für Partner (zusammengezählt)
          </p>
        </div>

        <Card className="w-full md:w-[360px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Abrechnungsmonat</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Input
              type="month"
              value={monthYear}
              onChange={(e) => setMonthYear(e.target.value)}
            />
            <Button
              onClick={() => generateMutation.mutate({ monthYear })}
              disabled={generateMutation.isPending || !monthYear}
              className="shrink-0"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generieren
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generieren
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-xl">
          <Input
            placeholder="Suche: Rechnung, Firma, Monat, Einsätze, Netto/USt/Brutto, Status"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => invoicesQuery.refetch()}
          disabled={invoicesQuery.isFetching}
        >
          {invoicesQuery.isFetching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Aktualisieren
            </>
          ) : (
            "Aktualisieren"
          )}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Abrechnungen...
            </div>
          ) : invoicesQuery.error ? (
            <div className="text-sm text-red-600">
              Fehler beim Laden der Abrechnungen.
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Keine Abrechnungen gefunden.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rechnungsnr.</TableHead>
                  <TableHead>Firma</TableHead>
                  <TableHead>Monat</TableHead>
                  <TableHead className="text-center">Einsätze</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                  <TableHead className="text-right">USt (20%)</TableHead>
                  <TableHead className="text-right">Brutto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredInvoices.map((inv) => {
                  const net = computeInvoiceNet(inv);
                  const vat = computeInvoiceVat(net);
                  const gross = computeInvoiceGross(net);
                  const count = computeInvoiceCount(inv);

                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">
                        <button
                          className="text-blue-600 hover:underline"
                          onClick={() => openDetails(inv)}
                          title="Details anzeigen"
                        >
                          {inv.invoiceNumber}
                        </button>
                      </TableCell>
                      <TableCell>{inv.company?.companyName ?? "-"}</TableCell>
                      <TableCell>{inv.monthYear}</TableCell>
                      <TableCell className="text-center">{count}</TableCell>
                      <TableCell className="text-right">{formatMoneyEUR(net)}</TableCell>
                      <TableCell className="text-right">{formatMoneyEUR(vat)}</TableCell>
                      <TableCell className="text-right">{formatMoneyEUR(gross)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(inv.status)}>
                          {statusLabel(inv.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="PDF herunterladen"
                            onClick={() => downloadInvoicePdf(inv)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            title="Als bezahlt markieren"
                            onClick={() => markPaidMutation.mutate(inv.id)}
                            disabled={markPaidMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            title="E-Mail senden (optional)"
                            onClick={() => sendEmailMutation.mutate(inv.id)}
                            disabled={sendEmailMutation.isPending}
                          >
                            {sendEmailMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* DETAILS DIALOG */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Rechnung Details</DialogTitle>
            <DialogDescription>
              Alle vermittelten Einsätze für diese Rechnung
            </DialogDescription>
          </DialogHeader>

          {!selected ? (
            <div className="text-sm text-muted-foreground">Keine Rechnung ausgewählt.</div>
          ) : (
            <div className="space-y-4">
              {/* Header summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Rechnung</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <div>
                      <span className="text-muted-foreground">Nr:</span>{" "}
                      <span className="font-medium">{selected.invoiceNumber}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Monat:</span>{" "}
                      <span className="font-medium">{selected.monthYear}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>{" "}
                      <Badge className="ml-2" variant={statusVariant(selected.status)}>
                        {statusLabel(selected.status)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Firma</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <div className="font-medium">{selected.company?.companyName ?? "-"}</div>
                    {selected.company?.contactName ? (
                      <div>
                        <span className="text-muted-foreground">Kontakt:</span>{" "}
                        {selected.company.contactName}
                      </div>
                    ) : null}
                    {selected.company?.phone ? (
                      <div>
                        <span className="text-muted-foreground">Tel:</span>{" "}
                        {selected.company.phone}
                      </div>
                    ) : null}
                    {selected.company?.email ? (
                      <div>
                        <span className="text-muted-foreground">E-Mail:</span>{" "}
                        {selected.company.email}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Beträge</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    {(() => {
                      const net = computeInvoiceNet(selected);
                      const vat = computeInvoiceVat(net);
                      const gross = computeInvoiceGross(net);
                      const count = computeInvoiceCount(selected);
                      return (
                        <>
                          <div>
                            <span className="text-muted-foreground">Einsätze:</span>{" "}
                            <span className="font-medium">{count}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Netto:</span>{" "}
                            <span className="font-medium">{formatMoneyEUR(net)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">USt (20%):</span>{" "}
                            <span className="font-medium">{formatMoneyEUR(vat)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Brutto:</span>{" "}
                            <span className="font-medium">{formatMoneyEUR(gross)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => downloadInvoicePdf(selected)}>
                  <Download className="mr-2 h-4 w-4" />
                  Rechnung PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => markPaidMutation.mutate(selected.id)}
                  disabled={markPaidMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Bezahlt markieren
                </Button>
              </div>

              <Separator />

              {/* Items table */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Einsätze in dieser Rechnung</div>

                {(selected.items ?? []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Keine Einsatz-Positionen vorhanden (Items fehlen).
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job #</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead>Adresse</TableHead>
                        <TableHead>Gewerk</TableHead>
                        <TableHead>Kunde</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Netto</TableHead>
                        <TableHead className="text-right">USt</TableHead>
                        <TableHead className="text-right">Brutto</TableHead>
                        <TableHead className="text-right">PDF</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {(selected.items ?? []).map((it) => {
                        const job = it.job;
                        const net = round2(toNumber(it.amount));
                        const vat = round2(net * VAT_RATE);
                        const gross = round2(net + vat);

                        const jobNumber = job?.jobNumber ?? it.jobId;
                        const dt = job?.dateTime ? new Date(job.dateTime) : null;

                        return (
                          <TableRow key={it.id}>
                            <TableCell className="font-medium">#{jobNumber}</TableCell>
                            <TableCell>
                              {dt ? format(dt, "dd.MM.yyyy HH:mm") : "-"}
                            </TableCell>
                            <TableCell>{job?.serviceAddress ?? "-"}</TableCell>
                            <TableCell>{job?.trade ?? "-"}</TableCell>
                            <TableCell>
                              {job?.propertyManager?.name ??
                                job?.privateCustomer?.name ??
                                job?.customerName ??
                                "-"}
                            </TableCell>
                            <TableCell>
                              {job?.status ? (
                                <Badge variant="outline">{String(job.status)}</Badge>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="text-right">{formatMoneyEUR(net)}</TableCell>
                            <TableCell className="text-right">{formatMoneyEUR(vat)}</TableCell>
                            <TableCell className="text-right">{formatMoneyEUR(gross)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Job PDF"
                                onClick={() => downloadJobPdf(it.jobId, jobNumber)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Hint */}
              <div className="text-xs text-muted-foreground">
                Hinweis: Beträge werden hier sauber berechnet: Netto + 20% USt = Brutto.
                (Einsatz: 49,00 netto → 58,80 brutto; Storno: 14,90 netto → 17,88 brutto)
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
