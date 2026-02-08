import { DataTable } from "@/components/DataTable";
import { useCompanies, useCreateCompany, useUpdateCompany } from "@/hooks/use-companies";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@shared/routes";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";

export default function Companies() {
  const { data: companies, isLoading } = useCompanies();
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [, setLocation] = useLocation();

  const columns = [
    { header: "Firma", accessorKey: "companyName", className: "font-bold" },
    { header: "Kontakt", accessorKey: "contactName" },
    { header: "Telefon", accessorKey: "phone" },
    { header: "Email", accessorKey: "email" },
    {
      header: "Gewerke",
      accessorKey: "trades",
      cell: (item: any) => (
        <div className="flex flex-wrap gap-1">
          {(item.trades || []).map((t: string) => (
            <Badge key={t} variant="secondary" className="text-xs">
              {t}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "isActive",
      cell: (item: any) => <Badge variant={item.isActive ? "default" : "destructive"}>{item.isActive ? "Aktiv" : "Inaktiv"}</Badge>,
    },
    {
      header: "Aktionen",
      cell: (item: any) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setLocation(`/jobs?companyId=${item.id}`)}
            title="Alle vermittelten Einsätze ansehen"
          >
            Einsätze
          </Button>

          <Button
            variant="link"
            onClick={() => {
              setEditingItem(item);
              setIsOpen(true);
            }}
          >
            Bearbeiten
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold text-slate-900">Partnerbetriebe</h2>
        <p className="text-slate-500 mt-2">Handwerker und Firmen verwalten</p>
      </div>

      <DataTable
        data={companies || []}
        columns={columns as any}
        searchKeys={["companyName", "contactName", "address", "phone", "email", "notes", "trades", "isActive"]}
        searchPlaceholder="Suche: Firma, Kontakt, Adresse, Telefon, Email, Gewerk, Notes..."
        isLoading={isLoading}
        onCreate={() => {
          setEditingItem(null);
          setIsOpen(true);
        }}
        createLabel="Neue Firma"
      />

      <CompanyDialog open={isOpen} onOpenChange={setIsOpen} item={editingItem} />
    </div>
  );
}

function CompanyDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (open: boolean) => void; item?: any }) {
  const { mutateAsync: create } = useCreateCompany();
  const { mutateAsync: update } = useUpdateCompany();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(api.companies.create.input),
    defaultValues: item || {
      companyName: "",
      contactName: "",
      address: "",
      phone: "",
      email: "",
      trades: [],
      isActive: true,
      notes: "",
    },
    values: item,
  });

  const availableTrades = ["Installateur", "Elektriker", "Dachdecker", "Schlosser"];

  async function onSubmit(data: any) {
    try {
      if (item) await update({ id: item.id, ...data });
      else await create(data);

      toast({ title: item ? "Aktualisiert" : "Erstellt" });
      onOpenChange(false);
      form.reset();
    } catch (e: any) {
      toast({ title: "Fehler", description: String(e?.message ?? e), variant: "destructive" });
      console.error(e);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? "Firma bearbeiten" : "Neue Partnerfirma"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Firmenname</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ansprechpartner</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefon</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="trades"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="mb-2 block">Gewerke</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {availableTrades.map((trade) => (
                      <div key={trade} className="flex items-center space-x-2">
                        <Checkbox
                          id={trade}
                          checked={field.value.includes(trade)}
                          onCheckedChange={(checked) => {
                            if (checked) field.onChange([...field.value, trade]);
                            else field.onChange(field.value.filter((t: string) => t !== trade));
                          }}
                        />
                        <label htmlFor={trade} className="text-sm font-medium leading-none">{trade}</label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Aktiv</FormLabel>
                    <p className="text-sm text-muted-foreground">Ist diese Firma aktuell verfügbar?</p>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notizen</FormLabel>
                  <FormControl><Textarea rows={4} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button type="submit">{item ? "Speichern" : "Erstellen"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
