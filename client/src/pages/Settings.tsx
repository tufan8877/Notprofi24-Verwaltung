import * as React from "react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type SettingsDto = {
  companyName?: string;
  address?: string;
  uid?: string;
  emailFromName?: string;
  emailFromEmail?: string;
  standardProvision?: number | string;
  defaultReferralFee?: number | string; // alias
};

function toNumber(v: unknown): number {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function Settings() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({
    companyName: "",
    address: "",
    uid: "",
    emailFromName: "",
    emailFromEmail: "",
    standardProvision: 0,
  });

  // ✅ QueryKey muss eine URL sein, damit getQueryFn() korrekt funktioniert
  const settingsQuery = useQuery<SettingsDto>({
    queryKey: ["/api/settings"],
    staleTime: 0,
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    const d = settingsQuery.data;
    const prov = toNumber(d.standardProvision ?? d.defaultReferralFee);

    setForm({
      companyName: d.companyName ?? "",
      address: d.address ?? "",
      uid: d.uid ?? "",
      emailFromName: d.emailFromName ?? "",
      emailFromEmail: d.emailFromEmail ?? "",
      standardProvision: prov,
    });
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: SettingsDto = {
        companyName: form.companyName,
        address: form.address,
        uid: form.uid,
        emailFromName: form.emailFromName,
        emailFromEmail: form.emailFromEmail,
        standardProvision: form.standardProvision,
      };

      const res = await apiRequest("PUT", "/api/settings", payload); // ✅ credentials: include
      return (await res.json()) as SettingsDto;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Gespeichert", description: "Einstellungen wurden gespeichert." });
    },
    onError: (err: any) => {
      toast({
        title: "Fehler",
        description: String(err?.message ?? err ?? "Speichern fehlgeschlagen"),
        variant: "destructive",
      });
    },
  });

  const isBusy = settingsQuery.isLoading || settingsQuery.isFetching || saveMutation.isPending;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-3xl font-display font-bold text-slate-900">Einstellungen</h2>
        <p className="text-slate-500 mt-2">Systemeinstellungen und Firmendaten</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stammdaten Notprofi24</CardTitle>
          <CardDescription>Diese Daten erscheinen auf den Rechnungen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Firmenname</Label>
            <Input
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label>Adresse</Label>
            <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>UID-Nummer</Label>
              <Input value={form.uid} onChange={(e) => setForm((f) => ({ ...f, uid: e.target.value }))} />
            </div>

            <div className="grid gap-2">
              <Label>Standard Provision (€)</Label>
              <Input
                inputMode="decimal"
                value={String(form.standardProvision)}
                onChange={(e) => setForm((f) => ({ ...f, standardProvision: toNumber(e.target.value) }))}
              />
            </div>
          </div>

          <Button
            className="mt-4"
            disabled={isBusy}
            onClick={() => saveMutation.mutate()}
          >
            {isBusy ? "Speichere..." : "Speichern"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>E-Mail Einstellungen</CardTitle>
          <CardDescription>Konfiguration für automatische E-Mails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Absender Name</Label>
            <Input
              value={form.emailFromName}
              onChange={(e) => setForm((f) => ({ ...f, emailFromName: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label>Absender E-Mail</Label>
            <Input
              value={form.emailFromEmail}
              onChange={(e) => setForm((f) => ({ ...f, emailFromEmail: e.target.value }))}
            />
          </div>
          {/* Test-Mail: Backend-Route fehlt aktuell. Wenn du willst, baue ich dir die Route ein. */}
          <Button variant="outline" disabled>
            Test-Email senden
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
