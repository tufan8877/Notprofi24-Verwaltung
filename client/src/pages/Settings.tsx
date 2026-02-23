import * as React from "react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

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

  const [form, setForm] = useState<Required<SettingsDto>>({
    companyName: "",
    address: "",
    uid: "",
    emailFromName: "",
    emailFromEmail: "",
    standardProvision: 0,
    defaultReferralFee: 0,
  });

  const settingsQuery = useQuery<SettingsDto>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings", { method: "GET" });
      if (!res.ok) throw new Error("Konnte Einstellungen nicht laden");
      return await res.json();
    },
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
      defaultReferralFee: prov,
    });
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: SettingsDto) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Speichern fehlgeschlagen");
      }
      return (await res.json()) as SettingsDto;
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "Gespeichert", description: "Einstellungen wurden gespeichert." });

      // ensure UI shows saved values
      const prov = toNumber(data.standardProvision ?? data.defaultReferralFee);
      setForm((f) => ({
        ...f,
        companyName: data.companyName ?? f.companyName,
        address: data.address ?? f.address,
        uid: data.uid ?? f.uid,
        emailFromName: data.emailFromName ?? f.emailFromName,
        emailFromEmail: data.emailFromEmail ?? f.emailFromEmail,
        standardProvision: prov,
        defaultReferralFee: prov,
      }));
    },
    onError: (err: any) => {
      toast({
        title: "Fehler",
        description: String(err?.message ?? err ?? "Speichern fehlgeschlagen"),
        variant: "destructive",
      });
    },
  });

  const isLoading = settingsQuery.isLoading || settingsQuery.isFetching;

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
              placeholder="z.B. Notprofi24 GmbH"
            />
          </div>

          <div className="grid gap-2">
            <Label>Adresse</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="z.B. Musterstraße 1, 1010 Wien"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>UID-Nummer</Label>
              <Input
                value={form.uid}
                onChange={(e) => setForm((f) => ({ ...f, uid: e.target.value }))}
                placeholder="z.B. ATU12345678"
              />
            </div>

            <div className="grid gap-2">
              <Label>Standard Provision (Netto €)</Label>
              <Input
                inputMode="decimal"
                value={String(form.standardProvision)}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({
                    ...f,
                    standardProvision: v,
                    defaultReferralFee: v,
                  }));
                }}
                placeholder="z.B. 49"
              />
            </div>
          </div>

          <Button
            className="mt-4"
            disabled={saveMutation.isPending || isLoading}
            onClick={() =>
              saveMutation.mutate({
                companyName: form.companyName,
                address: form.address,
                uid: form.uid,
                emailFromName: form.emailFromName,
                emailFromEmail: form.emailFromEmail,
                standardProvision: toNumber(form.standardProvision),
                defaultReferralFee: toNumber(form.standardProvision),
              })
            }
          >
            {saveMutation.isPending ? "Speichert..." : "Speichern"}
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
              placeholder="z.B. Notprofi24 Admin"
            />
          </div>

          <div className="grid gap-2">
            <Label>Absender E-Mail</Label>
            <Input
              value={form.emailFromEmail}
              onChange={(e) => setForm((f) => ({ ...f, emailFromEmail: e.target.value }))}
              placeholder="z.B. noreply@notprofi24.at"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              disabled={isLoading}
              onClick={async () => {
                // optional: simple ping - keeps UI consistent even without backend test endpoint
                toast({ title: "Info", description: "Test-Email ist in dieser Version nicht implementiert." });
              }}
            >
              Test-Email senden
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
