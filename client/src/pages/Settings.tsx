import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Settings() {
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
             <Input defaultValue="Notprofi24 GmbH" />
          </div>
           <div className="grid gap-2">
             <Label>Adresse</Label>
             <Input defaultValue="Musterstraße 1, 1010 Wien" />
          </div>
           <div className="grid grid-cols-2 gap-4">
             <div className="grid gap-2">
               <Label>UID-Nummer</Label>
               <Input defaultValue="ATU12345678" />
             </div>
             <div className="grid gap-2">
               <Label>Standard Provision (€)</Label>
               <Input defaultValue="60.00" />
             </div>
          </div>
          <Button className="mt-4">Speichern</Button>
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
             <Input defaultValue="Notprofi24 Admin" />
          </div>
           <div className="grid gap-2">
             <Label>Absender E-Mail</Label>
             <Input defaultValue="noreply@notprofi24.at" />
          </div>
          <Button variant="outline" className="mt-4">Test-Email senden</Button>
        </CardContent>
      </Card>
    </div>
  );
}
