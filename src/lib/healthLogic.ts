/** Evaluate health status based on vitals */
export type HealthStatus = "SAFE" | "OBSERVE" | "WARNING" | "ALERT" | "CRITICAL";

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
