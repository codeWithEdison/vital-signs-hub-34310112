import { StatusBadge } from "./StatusBadge";
import type { HealthStatus } from "@/lib/healthLogic";
import { format } from "date-fns";
import { useState } from "react";
import { Thermometer, Heart, Wind, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VitalRecord {
  id: string;
  temperature: number;
  heart_rate: number;
  spo2: number;
  status: string;
  recommendation: string;
  created_at: string;
}

interface HistoryTableProps {
  records: VitalRecord[];
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

function csvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

async function buildExportAllCSV() {
  toast.info("Preparing CSV export…");
  let allData: VitalRecord[] = [];
  let from = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("vitals")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + batchSize - 1);

    if (error) {
      toast.error(`Export failed: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) break;
    allData = allData.concat(data as VitalRecord[]);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  if (allData.length === 0) {
    toast.info("No records to export");
    return;
  }

  const header = "ID,Temperature (°C),Heart Rate (bpm),SpO2 (%),Status,Recommendation,Timestamp\n";
  const rows = allData.map((r) =>
    [
      csvCell(r.id),
      csvCell(r.temperature),
      csvCell(r.heart_rate),
      csvCell(r.spo2),
      csvCell(r.status),
      csvCell(r.recommendation),
      csvCell(r.created_at),
    ].join(",")
  ).join("\n");

  const filename = `vitals_export_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`;
  // Add UTF-8 BOM so Excel opens Unicode headers/text correctly.
  const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  toast.success(`Prepared ${allData.length} records for download`);
  return { url, filename, count: allData.length };
}

export function HistoryTable({ records, page, totalPages, totalCount, onPageChange }: HistoryTableProps) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const onExportAll = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
      const result = await buildExportAllCSV();
      if (!result) return;
      setDownloadUrl(result.url);
      setDownloadName(result.filename);
      // Try automatic download first. If browser blocks it, fallback link remains visible.
      triggerDownload(result.url, result.filename);
    } finally {
      setIsExporting(false);
    }
  };

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <Thermometer className="w-5 h-5 text-muted-foreground/50" />
        </div>
        <p className="font-medium text-sm">No readings yet</p>
        <p className="text-xs mt-1">Data will appear when sensors send readings</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-3 px-5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
              <th className="text-left py-3 px-5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span className="flex items-center gap-1.5"><Thermometer className="w-3 h-3" /> Temp</span>
              </th>
              <th className="text-left py-3 px-5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span className="flex items-center gap-1.5"><Heart className="w-3 h-3" /> HR</span>
              </th>
              <th className="text-left py-3 px-5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span className="flex items-center gap-1.5"><Wind className="w-3 h-3" /> SpO₂</span>
              </th>
              <th className="text-left py-3 px-5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, i) => (
              <tr
                key={record.id}
                className="border-b border-border/40 hover:bg-muted/20 transition-colors"
              >
                <td className="py-3 px-5 text-xs text-muted-foreground font-medium">
                  {format(new Date(record.created_at), "MMM d, HH:mm:ss")}
                </td>
                <td className="py-3 px-5 text-sm font-semibold text-foreground tabular-nums">
                  {record.temperature.toFixed(1)}°C
                </td>
                <td className="py-3 px-5 text-sm font-semibold text-foreground tabular-nums">
                  {record.heart_rate} <span className="text-xs text-muted-foreground font-normal">bpm</span>
                </td>
                <td className="py-3 px-5 text-sm font-semibold text-foreground tabular-nums">
                  {record.spo2}%
                </td>
                <td className="py-3 px-5">
                  <StatusBadge status={record.status as HealthStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer: pagination + export */}
      <div className="px-5 py-3 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExportAll} className="gap-1.5 text-xs" disabled={isExporting}>
            <Download className="w-3.5 h-3.5" /> Export All Data
          </Button>
          {downloadUrl && (
            <button
              type="button"
              onClick={() => triggerDownload(downloadUrl, downloadName)}
              className="text-[11px] text-primary hover:underline"
            >
              Click here if download did not start
            </button>
          )}
          <span className="text-[11px] text-muted-foreground">{totalCount.toLocaleString()} records</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground px-2 tabular-nums">
            {page} / {totalPages.toLocaleString()}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
