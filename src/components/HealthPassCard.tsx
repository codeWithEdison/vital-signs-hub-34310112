import { useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { jsPDF } from "jspdf";
import { Download } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { HealthStatus } from "@/lib/healthLogic";
import { format } from "date-fns";

interface HealthPassCardProps {
  status: HealthStatus;
  recommendation: string;
  temperature: number;
  heartRate: number;
  spo2: number;
  timestamp: string;
}

const statusColors: Record<HealthStatus, string> = {
  SAFE: "#1a8a5c",
  WARNING: "#e6a200",
  ALERT: "#d62828",
};

function generatePDFBlob(
  status: HealthStatus,
  temperature: number,
  heartRate: number,
  spo2: number,
  recommendation: string,
  timestamp: string,
  qrImgData: string | null
): Blob {
  const doc = new jsPDF({ unit: "mm", format: [90, 140] });
  const w = 90;
  const color = statusColors[status];
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  // Background
  doc.setFillColor(250, 250, 252);
  doc.rect(0, 0, w, 140, "F");

  // Top accent bar
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, w, 4, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 36, 60);
  doc.text("DIGITAL HEALTH PASS", w / 2, 14, { align: "center" });

  // Institution
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(120, 130, 150);
  doc.text("University of Rwanda · Smart Health Kiosk", w / 2, 19, { align: "center" });

  // Status badge
  doc.setFillColor(r, g, b);
  doc.roundedRect(w / 2 - 16, 24, 32, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(status, w / 2, 30.5, { align: "center" });

  // Divider
  doc.setDrawColor(230, 232, 240);
  doc.line(10, 38, w - 10, 38);

  // Vitals
  const vitalsY = 44;
  const col1 = 14;
  const col2 = w / 2 + 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 130, 150);
  doc.text("Temperature", col1, vitalsY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 36, 60);
  doc.text(`${temperature.toFixed(1)}°C`, col1, vitalsY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 130, 150);
  doc.text("Heart Rate", col2, vitalsY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 36, 60);
  doc.text(`${heartRate} bpm`, col2, vitalsY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 130, 150);
  doc.text("SpO2", col1, vitalsY + 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 36, 60);
  doc.text(`${spo2}%`, col1, vitalsY + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 130, 150);
  doc.text("Date & Time", col2, vitalsY + 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 36, 60);
  doc.text(format(new Date(timestamp), "dd MMM yyyy, HH:mm"), col2, vitalsY + 22);

  // Recommendation
  doc.setDrawColor(230, 232, 240);
  doc.line(10, 74, w - 10, 74);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(r, g, b);
  doc.text(recommendation, w / 2, 80, { align: "center" });

  // QR Code in PDF
  if (qrImgData) {
    doc.addImage(qrImgData, "PNG", w / 2 - 16, 86, 32, 32);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  doc.setTextColor(160, 165, 180);
  doc.text("Scan QR to download this health pass", w / 2, 122, { align: "center" });

  // Footer
  doc.setDrawColor(230, 232, 240);
  doc.line(10, 126, w - 10, 126);
  doc.setFontSize(5);
  doc.text("This pass is auto-generated. Not a medical diagnosis.", w / 2, 132, { align: "center" });

  return doc.output("blob");
}

function getQRImageData(): Promise<string | null> {
  return new Promise((resolve) => {
    const qrSvg = document.querySelector("#health-pass-qr svg");
    if (!qrSvg) return resolve(null);

    const svgData = new XMLSerializer().serializeToString(qrSvg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, 200, 200);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  });
}

export function HealthPassCard({
  status,
  recommendation,
  temperature,
  heartRate,
  spo2,
  timestamp,
}: HealthPassCardProps) {
  // Build a URL that encodes the health pass data as query params.
  // When a phone scans this QR, it opens the dashboard which auto-triggers the PDF download.
  const passParams = new URLSearchParams({
    download: "1",
    s: status,
    t: temperature.toFixed(1),
    hr: String(heartRate),
    o2: String(spo2),
    r: recommendation,
    ts: timestamp,
  });
  const qrUrl = `${window.location.origin}/?${passParams.toString()}`;

  const downloadPDF = useCallback(async () => {
    const qrImgData = await getQRImageData();
    const blob = generatePDFBlob(status, temperature, heartRate, spo2, recommendation, timestamp, qrImgData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-pass-${format(new Date(timestamp), "yyyyMMdd-HHmm")}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [status, temperature, heartRate, spo2, recommendation, timestamp]);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card animate-slide-up overflow-hidden h-full flex flex-col">
      {/* Top bar */}
      <div className={`h-1 ${status === "SAFE" ? "bg-status-safe" : status === "WARNING" ? "bg-status-warning" : "bg-status-alert"}`} />

      <div className="flex flex-col items-center p-6 flex-1">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.15em] mb-4">
          Digital Health Pass
        </p>

        <StatusBadge status={status} size="lg" />

        <p className="mt-3 text-sm text-muted-foreground text-center leading-relaxed max-w-[240px]">
          {recommendation}
        </p>

        {/* QR Code — encodes a URL so scanning devices can download the pass */}
        <div id="health-pass-qr" className="mt-5 p-3 bg-background rounded-xl border border-border">
          <QRCodeSVG
            value={qrUrl}
            size={120}
            level="M"
            bgColor="transparent"
            fgColor="hsl(228 24% 16%)"
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Scan to download on your device</p>

        {/* Timestamp */}
        <p className="text-[10px] text-muted-foreground mt-3">
          {format(new Date(timestamp), "dd MMM yyyy · HH:mm:ss")}
        </p>

        {/* Download button */}
        <button
          onClick={downloadPDF}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </button>
      </div>
    </div>
  );
}
