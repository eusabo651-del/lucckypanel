export const PLAN_CATALOG = [
  { id: "hourly", name: "1 hora", description: "Acesso por 1 hora após a ativação", accent: "gray" },
  { id: "daily", name: "1 dia", description: "Acesso diário", accent: "gray" },
  { id: "weekly", name: "1 semana", description: "Acesso semanal", accent: "blue" },
  { id: "perm", name: "Permanente", description: "Acesso sem expiração", accent: "gold" },
] as const;

export const OPERATING_SYSTEMS = ["android", "ios"] as const;
export const PERFORMANCE_LEVELS = ["low", "medium", "high"] as const;
export const DURATION_UNITS = ["hours", "days", "weeks", "months", "years"] as const;

/** Returns a MockAPI expiresAt Unix timestamp; hourly licenses last exactly one hour from first activation. */
export function activationExpirySeconds(type: string, expire: number, activatedAt: number) {
  if (type === "perm") return 0;
  const secondsPerUnit = type === "hourly" ? 60 * 60 : 24 * 60 * 60;
  return activatedAt + Math.max(1, Number(expire) || 1) * secondsPerUnit;
}

export type RbxisRole = "admin" | "user";
export type RbxisSession = {
  role: RbxisRole;
  userId?: number;
  licenseId?: number;
  username?: string;
  expiresAt: number;
};

export type SensitivityValues = {
  general: number;
  redDot: number;
  scope2x: number;
  scope4x: number;
  awm: number;
};

export const PERFORMANCE_LABELS: Record<(typeof PERFORMANCE_LEVELS)[number], string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
};

export const OS_LABELS: Record<(typeof OPERATING_SYSTEMS)[number], string> = {
  android: "Android",
  ios: "iOS",
};

export function planName(planId: string) {
  return PLAN_CATALOG.find(plan => plan.id === planId)?.name ?? planId;
}
