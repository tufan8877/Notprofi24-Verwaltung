import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

type Manager = { id: number; name: string };
type Property = { id: number; propertyManagerId: number; name: string | null; address: string; emergencyInstructions: string | null };
type Call = { id: number; receivedAt: string; propertyManagerId: number | null; propertyId: number | null; callerName: string | null; callerPhone: string | null; issueType: string; description: string | null; status: string; resolution: string | null; jobId: number | null };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || `HTTP ${response.status}`); }
  return response.json();
}
const statuses: Record<string, string> = { received: "Aufgenommen", triaged: "Geprüft", dispatched: "Vermittelt", resolved: "Erledigt", no_dispatch: "Kein Einsatz" };

export default function EmergencyCenter() {
  const { toast } = useToast();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [busy, setBusy] = useState(false);
  const [managerId, setManagerId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [callerName, setCallerName] = useState("");
  const [callerPhone, setCallerPhone] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [issueType, setIssueType] = useState("Rohrbruch / Wasserschaden");
  const [description, setDescription] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [instructions, setInstructions] = useState("");

  async function refresh() {
    const [m, p, c] = await Promise.all([
      request<Manager[]>("/api/property-managers"),
      request<Property[]>("/api/properties"),
      request<Call[]>("/api/emergency-calls"),
    ]);
    setManagers(m); setProperties(p); setCalls(c);
  }
  useEffect(() => { refresh().catch(e => toast({ title: "Laden fehlgeschlagen", description: e.message, variant: "destructive" })); }, []);
  const filtered = properties.filter(p => String(p.propertyManagerId) === managerId);
  const selected = properties.find(p => String(p.id) === propertyId);

  async function saveCall(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await request("/api/emergency-calls", { method: "POST", body: JSON.stringify({
        propertyManagerId: managerId ? Number(managerId) : null,
        propertyId: propertyId ? Number(propertyId) : null,
        callerName: callerName || null, callerPhone: callerPhone || null,
        serviceAddress: serviceAddress || selected?.address || null,
        issueType, description: description || null, status: "received"
      }) });
      setCallerName(""); setCallerPhone(""); setDescription(""); setServiceAddress("");
      await refresh(); toast({ title: "Notruf gespeichert" });
    } catch (e: any) { toast({ title: "Fehler", description: e.message, variant: "destructive" }); }
    finally { setBusy(false); }
  }
  async function saveProperty(e: React.FormEvent) {
    e.preventDefault(); if (!managerId) return;
    setBusy(true);
    try {
      await request("/api/properties", { method: "POST", body: JSON.stringify({
        propertyManagerId: Number(managerId), name: propertyName || null,
        address: propertyAddress, emergencyInstructions: instructions || null
      }) });
      setPropertyAddress(""); setPropertyName(""); setInstructions("");
      await refresh(); toast({ title: "Objekt angelegt" });
    } catch (e: any) { toast({ title: "Fehler", description: e.message, variant: "destructive" }); }
    finally { setBusy(false); }
  }
  async function updateCall(call: Call, status: string) {
    try {
      await request(`/api/emergency-calls/${call.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await refresh();
    } catch (e: any) { toast({ title: "Fehler", description: e.message, variant: "destructive" }); }
  }
  const field = "w-full border rounded-md px-3 py-2 bg-white";
  return <div className="space-y-8">
    <div><h1 className="text-3xl font-bold">Notdienstzentrale</h1><p className="text-slate-500">Notrufe dokumentieren, Liegenschaften zuordnen und Einsätze nachverfolgen.</p></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={saveCall} className="bg-white border rounded-xl p-5 space-y-3">
        <h2 className="text-xl font-semibold">Neuen Anruf aufnehmen</h2>
        <label className="block text-sm">Hausverwaltung</label>
        <select className={field} value={managerId} onChange={e => { setManagerId(e.target.value); setPropertyId(""); }}><option value="">Keine / unbekannt</option>{managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <label className="block text-sm">Liegenschaft</label>
        <select className={field} value={propertyId} onChange={e => setPropertyId(e.target.value)}><option value="">Nicht zugeordnet</option>{filtered.map(p => <option key={p.id} value={p.id}>{p.name ? p.name + " – " : ""}{p.address}</option>)}</select>
        {selected?.emergencyInstructions && <p className="text-sm bg-amber-50 p-3 rounded">Objektanweisung: {selected.emergencyInstructions}</p>}
        <div className="grid grid-cols-2 gap-2"><input className={field} placeholder="Name Anrufer" value={callerName} onChange={e => setCallerName(e.target.value)}/><input className={field} placeholder="Rückrufnummer" value={callerPhone} onChange={e => setCallerPhone(e.target.value)}/></div>
        <input className={field} placeholder="Einsatzadresse (falls abweichend)" value={serviceAddress} onChange={e => setServiceAddress(e.target.value)}/>
        <select className={field} value={issueType} onChange={e => setIssueType(e.target.value)}>{["Rohrbruch / Wasserschaden","Heizungsausfall","Stromausfall","Dachschaden","Tür / Schloss","Sonstiges"].map(s => <option key={s}>{s}</option>)}</select>
        <textarea className={field} rows={3} placeholder="Störung, Dringlichkeit, wichtige Hinweise" value={description} onChange={e => setDescription(e.target.value)}/>
        <button disabled={busy} className="bg-slate-900 text-white rounded px-4 py-2 disabled:opacity-50">Anruf speichern</button>
      </form>
      <form onSubmit={saveProperty} className="bg-white border rounded-xl p-5 space-y-3">
        <h2 className="text-xl font-semibold">Neue Liegenschaft</h2>
        <p className="text-sm text-slate-500">Wähle links zuerst die Hausverwaltung aus.</p>
        <input className={field} placeholder="Objektbezeichnung (optional)" value={propertyName} onChange={e => setPropertyName(e.target.value)}/>
        <input className={field} required placeholder="Objektadresse" value={propertyAddress} onChange={e => setPropertyAddress(e.target.value)}/>
        <textarea className={field} rows={3} placeholder="Notdienstanweisungen / Freigabegrenzen" value={instructions} onChange={e => setInstructions(e.target.value)}/>
        <button disabled={busy || !managerId} className="bg-slate-900 text-white rounded px-4 py-2 disabled:opacity-50">Objekt anlegen</button>
        <p className="text-sm text-slate-500">{filtered.length} Objekte der ausgewählten Verwaltung</p>
      </form>
    </div>
    <section className="bg-white border rounded-xl p-5 space-y-3">
      <h2 className="text-xl font-semibold">Anrufjournal ({calls.length})</h2>
      <div className="overflow-x-auto"><table className="min-w-full text-sm text-left"><thead><tr className="border-b"><th className="p-2">Zeitpunkt</th><th className="p-2">Hausverwaltung / Objekt</th><th className="p-2">Anrufer</th><th className="p-2">Störung</th><th className="p-2">Status</th></tr></thead><tbody>{calls.map(c => <tr key={c.id} className="border-b">
        <td className="p-2 whitespace-nowrap">{new Date(c.receivedAt).toLocaleString("de-AT")}</td>
        <td className="p-2">{managers.find(m => m.id === c.propertyManagerId)?.name || "–"}<div className="text-slate-500">{properties.find(p => p.id === c.propertyId)?.address || "–"}</div></td>
        <td className="p-2">{c.callerName || "–"}<div>{c.callerPhone || ""}</div></td>
        <td className="p-2">{c.issueType}<div className="text-slate-500">{c.description}</div></td>
        <td className="p-2"><select aria-label="Anrufstatus" className={field} value={c.status} onChange={e => updateCall(c, e.target.value)}>{Object.entries(statuses).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></td>
      </tr>)}</tbody></table></div>
    </section>
  </div>;
}
