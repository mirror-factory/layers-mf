"use client";

import { useState } from "react";
import { Download, FileText, FileJson, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { exportItemsAsPdf } from "@/components/export-pdf-button";

type ExportPayload = {
  format: "markdown" | "json";
  items?: string[];
  sessionId?: string;
  query?: string;
  limit?: number;
};

async function triggerExport(payload: ExportPayload) {
  const res = await fetch("/api/context/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Export failed");
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename =
    match?.[1] ??
    `layers-export.${payload.format === "markdown" ? "md" : "json"}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportDropdown({
  itemIds,
  sessionId,
  query,
  label,
}: {
  itemIds?: string[];
  sessionId?: string;
  query?: string;
  label?: string;
}) {
  const [exporting, setExporting] = useState(false);

  async function handleExport(format: "markdown" | "json" | "pdf") {
    setExporting(true);
    try {
      if (format === "pdf") {
        // For PDF, fetch the data as JSON and open the print-friendly view
        const payload: ExportPayload = { format: "json" };
        if (itemIds && itemIds.length > 0) payload.items = itemIds;
        else if (sessionId) payload.sessionId = sessionId;
        else if (query) payload.query = query;
        else {
          toast.error("Nothing to export");
          return;
        }

        const res = await fetch("/api/context/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("Export failed");

        const json = await res.json();
        exportItemsAsPdf(json.items ?? [], json.title);
        toast.success("PDF preview opened — use Save as PDF in the print dialog");
        return;
      }

      const payload: ExportPayload = { format };
      if (itemIds && itemIds.length > 0) payload.items = itemIds;
      else if (sessionId) payload.sessionId = sessionId;
      else if (query) payload.query = query;
      else {
        toast.error("Nothing to export");
        return;
      }

      await triggerExport(payload);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={exporting}
          aria-label={label ?? "Export"}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("markdown")}>
          <FileText className="h-3.5 w-3.5 mr-2" />
          Export as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("json")}>
          <FileJson className="h-3.5 w-3.5 mr-2" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          <Printer className="h-3.5 w-3.5 mr-2" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
