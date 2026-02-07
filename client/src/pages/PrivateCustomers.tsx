import { DataTable } from "@/components/DataTable";
import {
  usePrivateCustomers,
  useCreatePrivateCustomer,
  useUpdatePrivateCustomer,
} from "@/hooks/use-private-customers";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@shared/routes";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

export default function PrivateCustomers() {
  const { data: customers, isLoading } = usePrivateCustomers();
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const columns = [
    { header: "Name", accessorKey: "name", className: "font-semibold" },
    { header: "Adresse", accessorKey: "address" },
    { header: "Telefon", accessorKey: "phone" },
    { header: "Email", accessorKey: "email" },
    {
      header: "Aktionen",
      cell: (item: any) => (
        <Button
          variant="link"
          onClick={() => {
            setEditingItem(item);
            setIsOpen(true);
          }}
        >
          Bearbeiten
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold text-slate-900">Privatkunden</h2>
        <p className="text-slate-500 mt-2">Privatkunden anlegen & durchsuchen</p>
      </div>

      <DataTable
        data={customers || []}
        columns={columns}
        searchKeys={["name", "address", "phone", "email", "notes"]}
        searchPlaceholder="Suche: Name, Adresse, Telefon, Email, Notes..."
        isLoading={isLoading}
        onCreate={() => {
          setEditingItem(null);
          setIsOpen(true);
        }}
        createLabel="Neuer Privatkunde"
      />

      <CustomerDialog open={isOpen} onOpenChange={setIsOpen} item={editingItem} />
    </div>
  );
}

function CustomerDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: any;
}) {
  const { mutateAsync: create } = useCreatePrivateCustomer();
  const { mutateAsync: update } = useUpdatePrivateCustomer();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(api.privateCustomers.create.input),
    defaultValues: item || { name: "", address: "", phone: "", email: "", notes: "" },
    values: item,
  });

  async function onSubmit(data: any) {
    try {
      if (item) {
        await update({ id: item.id, ...data });
        toast({ title: "Aktualisiert" });
      } else {
        await create(data);
        toast({ title: "Erstellt" });
      }
      onOpenChange(false);
      form.reset();
    } catch (e: any) {
      toast({ title: "Fehler", description: String(e?.message ?? e), variant: "destructive" });
      console.error(e);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Privatkunde bearbeiten" : "Neuer Privatkunde"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
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
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notizen</FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} />
                  </FormControl>
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
