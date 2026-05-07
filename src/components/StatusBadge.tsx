import type { HealthStatus } from "@/lib/healthLogic";
import { ShieldCheck, Eye, AlertTriangle, AlertCircle, Siren, OctagonX } from "lucide-react";

const statusConfig = {
  SAFE: {
    label: "SAFE",
    icon: ShieldCheck,
    className: "bg-status-safe-bg text-status-safe border-status-safe/25",
    glowClass: "glow-safe",
  },
  OBSERVE: {
    label: "OBSERVE",
    icon: Eye,
    className: "bg-status-observe-bg text-status-observe border-status-observe/25",
    glowClass: "glow-observe",
  },
  WARNING: {
    label: "WARNING",
    icon: AlertTriangle,
    className: "bg-status-warning-bg text-status-warning border-status-warning/25",
    glowClass: "glow-warning",
  },
  ALERT: {
    label: "ALERT",
    icon: AlertCircle,
    className: "bg-status-alert-bg text-status-alert border-status-alert/25",
    glowClass: "glow-alert",
  },
  CRITICAL: {
    label: "CRITICAL",
    icon: Siren,
    className: "bg-status-critical-bg text-status-critical border-status-critical/25",
    glowClass: "glow-critical",
  },
  INVALID: {
    label: "INVALID",
    icon: OctagonX,
    className: "bg-status-invalid-bg text-status-invalid border-status-invalid/25",
    glowClass: "glow-invalid",
  },
};

interface StatusBadgeProps {
  status: HealthStatus;
  size?: "sm" | "lg";
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  if (size === "lg") {
    return (
      <div
        className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-xl border-2 font-display font-bold text-lg ${config.className} ${config.glowClass} animate-pulse-gentle`}
      >
        <Icon className="w-6 h-6" />
        {config.label}
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-bold uppercase tracking-wider ${config.className}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
