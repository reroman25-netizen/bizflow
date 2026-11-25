export const SAAS_BASE_MONTHLY_PRICE = 990;
export const SAAS_BASE_TRIAL_MONTHS = 3;
export const SAAS_PRO_MONTHLY_PRICE = 4990;
export const SAAS_PRO_TRIAL_DAYS = 30;

export interface PlanCheckInput {
  plan_tier?: string | null;
  trial_ends_at?: string | null;
  pro_trial_ends_at?: string | null;
  paid_until?: string | null;
  pro_trial_used?: boolean | null;
}

/**
 * Проверяет, активен ли у компании доступ к PRO-интеграциям (API банков Halyk/Freedom и API Яндекс Доставки).
 * Если срок PRO истёк, возвращает false (мягкий откат на Базовый тариф без удаления сохранённых ключей).
 */
export function hasActiveProAccess(biz: PlanCheckInput | null | undefined): boolean {
  if (!biz) return false;
  const tier = biz.plan_tier || "base";
  if (tier !== "pro" && tier !== "ai_autopilot") return false;

  const dates = [biz.paid_until, biz.pro_trial_ends_at, biz.trial_ends_at]
    .filter((d): d is string => Boolean(d))
    .map((d) => new Date(d).getTime())
    .filter((ms) => Number.isFinite(ms));

  // Если дата окончания не задана (включено вручную администратором) — считаем активным
  if (dates.length === 0) return true;

  const maxUntil = Math.max(...dates);
  return maxUntil >= Date.now();
}

export function canActivateFreeProTrial(biz: PlanCheckInput | null | undefined): boolean {
  if (!biz) return false;
  if (biz.pro_trial_used) return false;
  if (hasActiveProAccess(biz)) return false;
  return true;
}

export function getProPlanLabel(tier?: string | null): string {
  if (tier === "ai_autopilot") return "TIYIN AI Автопилот";
  if (tier === "pro") return "Бизнес PRO (4 990 ₸/мес)";
  return "Базовый (990 ₸/мес)";
}
