import { jsPDF } from "jspdf";
import { format } from "date-fns";
import type { HealthStatus } from "@/lib/healthLogic";

const STATUS_COLORS: Record<string, string> = {
  SAFE: "#1a8a5c",
  WARNING: "#e6a200",
  ALERT: "#d62828",
};

export function buildHealthPassPDF(
  status: HealthStatus,
  temperature: number,
  heartRate: number,
  spo2: number,
  recommendation: string,
  timestamp: string,
  qrImageData?: string | null
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: [90, 140] });
  const w = 90;
  const hex = STATUS_COLORS[status] || STATUS_COLORS.SAFE;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Background
  doc.setFillColor(250, 250, 252);
  doc.rect(0, 0, w, 140, "F");

  // Top accent
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, w, 4, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 36, 60);
  doc.text("DIGITAL HEALTH PASS", w / 2, 14, { align: "center" });

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

  doc.setDrawColor(230, 232, 240);
  doc.line(10, 38, w - 10, 38);

  // Vitals grid
  const y = 44;
  const c1 = 14;
  const c2 = w / 2 + 2;

  const writeLabel = (text: string, x: number, ly: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 130, 150);
    doc.text(text, x, ly);
  };
  const writeValue = (text: string, x: number, vy: number, size = 12) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(30, 36, 60);
    doc.text(text, x, vy);
  };

  writeLabel("Temperature", c1, y);
  writeValue(`${temperature.toFixed(1)}°C`, c1, y + 6);
  writeLabel("Heart Rate", c2, y);
  writeValue(`${heartRate} bpm`, c2, y + 6);
  writeLabel("SpO2", c1, y + 16);
  writeValue(`${spo2}%`, c1, y + 22);
  writeLabel("Date & Time", c2, y + 16);
  writeValue(format(new Date(timestamp), "dd MMM yyyy, HH:mm"), c2, y + 22, 8);

  // Recommendation
  doc.setDrawColor(230, 232, 240);
  doc.line(10, 74, w - 10, 74);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(r, g, b);
  doc.text(recommendation, w / 2, 80, { align: "center" });

  // QR if provided
  if (qrImageData) {
    doc.addImage(qrImageData, "PNG", w / 2 - 16, 86, 32, 32);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  doc.setTextColor(160, 165, 180);
  doc.text("Scan QR to download this health pass", w / 2, 122, { align: "center" });

  doc.setDrawColor(230, 232, 240);
  doc.line(10, 126, w - 10, 126);
  doc.setFontSize(5);
  doc.text("This pass is auto-generated. Not a medical diagnosis.", w / 2, 132, { align: "center" });

  return doc;
}

export function downloadHealthPassPDF(
  status: HealthStatus,
  temperature: number,
  heartRate: number,
  spo2: number,
  recommendation: string,
  timestamp: string,
  qrImageData?: string | null
) {
  const doc = buildHealthPassPDF(status, temperature, heartRate, spo2, recommendation, timestamp, qrImageData);
  doc.save(`health-pass-${format(new Date(timestamp), "yyyyMMdd-HHmm")}.pdf`);
}
