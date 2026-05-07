/** Evaluate health status based on vitals */
export type HealthStatus = "SAFE" | "OBSERVE" | "WARNING" | "ALERT" | "CRITICAL" | "INVALID";

export interface VitalReading {
  temperature: number;
  heart_rate: number;
  spo2: number;
}

export interface HealthEvaluation {
  status: HealthStatus;
  recommendation: string;
}

export function evaluateHealth(vitals: VitalReading): HealthEvaluation {
  const invalidReading =
    !Number.isFinite(vitals.temperature) ||
    !Number.isFinite(vitals.heart_rate) ||
    !Number.isFinite(vitals.spo2) ||
    vitals.temperature < 30 ||
    vitals.temperature > 45 ||
    vitals.heart_rate < 30 ||
    vitals.heart_rate > 220 ||
    vitals.spo2 < 70 ||
    vitals.spo2 > 100;

  if (invalidReading) {
    return {
      status: "INVALID",
      recommendation: "Invalid sensor reading. Please retake measurement",
    };
  }

  if (vitals.spo2 < 90 || vitals.temperature >= 39.5 || vitals.heart_rate >= 140) {
    return {
      status: "CRITICAL",
      recommendation: "Seek emergency care immediately",
    };
  }
  if (vitals.temperature > 38 || vitals.spo2 < 94) {
    return {
      status: "ALERT",
      recommendation: "Visit the clinic immediately",
    };
  }
  if (vitals.heart_rate > 100) {
    return {
      status: "WARNING",
      recommendation: "Rest and monitor your condition",
    };
  }
  if (
    (vitals.temperature >= 37.3 && vitals.temperature <= 38.0) ||
    (vitals.heart_rate >= 95 && vitals.heart_rate <= 100) ||
    (vitals.spo2 >= 94 && vitals.spo2 <= 95)
  ) {
    return {
      status: "OBSERVE",
      recommendation: "Recheck your vitals soon and continue observing",
    };
  }
  return {
    status: "SAFE",
    recommendation: "You are in good health",
  };
}
