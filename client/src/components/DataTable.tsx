import React, { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];

  // ALT (bleibt kompatibel)
  searchKey?: keyof T;

  // NEU: Mehrere Felder + Deep Paths: "company.companyName"
  searchKeys?: string[];

  searchPlaceholder?: string;
  onCreate?: () => void;
  createLabel?: string;
  isLoading?: boolean;
}

function getByPath(obj: any, path: string) {
  if (!obj) return undefined;
  if (!path) return undefined;
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function normalizeValue(v: any): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(normalizeValue).join(" ");
  if (typeof v === "object") {
    // wenn es ein Date-String ist, bleibt es String
    return Object.values(v).map(normalizeValue).join(" ");
  }
  return String(v);
}

export function DataTable<T extends { id: number | string }>({
  data,
  columns,
  searchKey,
  searchKeys,
  searchPlaceholder = "Suchen...",
  onCreate,
  createLabel = "Neu erstellen",
  isLoading,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");

  const effectiveSearchKeys = useMemo(() => {
    if (searchKeys && searchKeys.length > 0) return searchKeys;
    if (searchKey) return [String(searchKey)];
    return [];
  }, [searchKeys, searchKey]);

  const filteredData = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return data;
    if (effectiveSearchKeys.length === 0) return data;

    return data.filter((item: any) => {
      for (const key of effectiveSearchKeys) {
        const val = getByPath(item, key);
        const text = normalizeValue(val).toLowerCase();
        if (text.includes(q)) return true;
      }
      return false;
    });
  }, [data, searchTerm, effectiveSearchKeys]);

  const showSearch = effectiveSearchKeys.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        {showSearch && (
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 transition-all rounded-xl"
            />
          </div>
        )}

        {onCreate && (
          <Button
            onClick={onCreate}
            className="w-full sm:w-auto rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-200"
          >
            <Plus className="mr-2 h-4 w-4" />
            {createLabel}
          </Button>
        )}
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              {columns.map((col, idx) => (
                <TableHead key={idx} className={cn("font-semibold text-slate-700", col.className)}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex justify-center items-center gap-2 text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" />
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  Keine Einträge gefunden.
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((item: any) => (
                <TableRow key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  {columns.map((col, idx) => (
                    <TableCell key={idx} className={cn("py-3", col.className)}>
                      {col.cell
                        ? col.cell(item)
                        : String(item[col.accessorKey as keyof T] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
