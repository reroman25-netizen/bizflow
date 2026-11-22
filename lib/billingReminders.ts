import { SupabaseClient } from "@supabase/supabase-js";
import {
  getBillingStatus,
  BASE_PLAN_MONTHLY_PRICE,
} from "@/lib/subscriptionPlans";
import {
  notifyOwnerBillingReminder,
  notifySuperAdminBillingDigest,
} from "@/lib/telegramNotify";

export const BASE_PLAN_YEARLY_PRICE = 9900;

export async function runBillingRemindersCheck(
  admin: SupabaseClient,
  options?: { includeAllExpiringForAdmin?: boolean }
) {
  const { data: businesses, error } = await admin
    .from("businesses")
    .select(
      "id, name, slug, phone, whatsapp, created_at, plan_tier, trial_ends_at, paid_until, is_active"
    )
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  const { data: channelsRows } = await admin
    .from("business_channels")
    .select("business_id, owner_telegram_chat_id");

  const chatByBiz = new Map<string, string>();
  for (const row of channelsRows || []) {
    if (row.business_id && row.owner_telegram_chat_id) {
      chatByBiz.set(row.business_id, String(row.owner_telegram_chat_id).trim());
    }
  }

  const digestItems: {
    name: string;
    slug: string;
    phone: string;
    daysUsed: number;
    daysLeft: number;
    activeUntilFormatted: string;
    planTier: string;
  }[] = [];

  let notifiedOwners = 0;

  for (const biz of businesses || []) {
    const info = getBillingStatus(biz);
    const formattedUntil = info.activeUntil.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const isOwnerReminderDay =
      info.daysLeft === 7 || info.daysLeft === 1 || info.daysLeft === 0;

    if (isOwnerReminderDay) {
      const chatId = chatByBiz.get(biz.id);
      if (chatId) {
        const sent = await notifyOwnerBillingReminder({
          chatId,
          businessName: biz.name,
          daysLeft: info.daysLeft,
          activeUntilFormatted: formattedUntil,
          monthlyPrice: BASE_PLAN_MONTHLY_PRICE,
          yearlyPrice: BASE_PLAN_YEARLY_PRICE,
        });
        if (sent) notifiedOwners += 1;
      }
    }

    const shouldIncludeInDigest = options?.includeAllExpiringForAdmin
      ? info.daysLeft <= 14
      : isOwnerReminderDay || info.daysLeft < 0;

    if (shouldIncludeInDigest) {
      digestItems.push({
        name: biz.name,
        slug: biz.slug,
        phone: biz.whatsapp || biz.phone || "",
        daysUsed: info.daysUsed,
        daysLeft: info.daysLeft,
        activeUntilFormatted: formattedUntil,
        planTier: biz.plan_tier || "base",
      });
    }
  }

  digestItems.sort((a, b) => a.daysLeft - b.daysLeft);

  const adminNotified =
    digestItems.length > 0
      ? await notifySuperAdminBillingDigest({ items: digestItems })
      : false;

  return {
    checked: (businesses || []).length,
    notifiedOwners,
    adminNotified,
    digestCount: digestItems.length,
  };
}
