import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

interface TelegramUserPayload {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: number | string;
  hash?: string;
}

interface VerifiedTelegramUser {
  id: string;
  fullName: string;
  username: string;
}

const MAX_AUTH_AGE_SECONDS = 86400; // 24 часа

function timingSafeHexEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length !== bufB.length || bufA.length === 0) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function verifyWebAppInitData(
  initData: string,
  botToken: string
): { ok: true; user: VerifiedTelegramUser } | { ok: false; error: string } {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  if (!hash) {
    return { ok: false, error: "Отсутствует подпись Telegram Mini App." };
  }

  const authDate = Number(params.get("auth_date") || "0");
  const nowSec = Math.floor(Date.now() / 1000);
  if (!authDate || Math.abs(nowSec - authDate) > MAX_AUTH_AGE_SECONDS) {
    return { ok: false, error: "Сессия Telegram устарела. Откройте приложение заново." };
  }

  const entries: string[] = [];
  params.forEach((value, key) => {
    if (key !== "hash") {
      entries.push(`${key}=${value}`);
    }
  });
  entries.sort();
  const dataCheckString = entries.join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!timingSafeHexEqual(computedHash, hash)) {
    return { ok: false, error: "Неверная подпись Telegram Mini App." };
  }

  const rawUser = params.get("user");
  if (!rawUser) {
    return { ok: false, error: "Не удалось получить данные профиля Telegram." };
  }

  try {
    const parsed = JSON.parse(rawUser) as TelegramUserPayload;
    if (!parsed.id) {
      return { ok: false, error: "Некорректный Telegram ID." };
    }
    const fullName = [parsed.first_name, parsed.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    return {
      ok: true,
      user: {
        id: String(parsed.id),
        fullName: fullName || parsed.username || `Пользователь ${parsed.id}`,
        username: String(parsed.username || "").trim(),
      },
    };
  } catch {
    return { ok: false, error: "Ошибка разбора данных Telegram." };
  }
}

function verifyWidgetData(
  widgetData: TelegramUserPayload,
  botToken: string
): { ok: true; user: VerifiedTelegramUser } | { ok: false; error: string } {
  const hash = String(widgetData.hash || "");
  if (!hash || !widgetData.id) {
    return { ok: false, error: "Неполные данные авторизации Telegram." };
  }

  const authDate = Number(widgetData.auth_date || 0);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!authDate || Math.abs(nowSec - authDate) > MAX_AUTH_AGE_SECONDS) {
    return { ok: false, error: "Запрос входа устарел. Попробуйте ещё раз." };
  }

  const allowedKeys = [
    "auth_date",
    "first_name",
    "id",
    "last_name",
    "photo_url",
    "username",
  ] as const;

  const entries: string[] = [];
  for (const key of allowedKeys) {
    const val = widgetData[key];
    if (val !== undefined && val !== null && String(val) !== "") {
      entries.push(`${key}=${String(val)}`);
    }
  }
  entries.sort();
  const dataCheckString = entries.join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!timingSafeHexEqual(computedHash, hash)) {
    return { ok: false, error: "Подпись Telegram не прошла проверку." };
  }

  const fullName = [widgetData.first_name, widgetData.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    ok: true,
    user: {
      id: String(widgetData.id),
      fullName: fullName || widgetData.username || `Пользователь ${widgetData.id}`,
      username: String(widgetData.username || "").trim(),
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const botToken = (
      process.env.TELEGRAM_AUTH_BOT_TOKEN ||
      process.env.TELEGRAM_NOTIFY_BOT_TOKEN ||
      ""
    ).trim();

    if (!botToken) {
      return NextResponse.json(
        { error: "Токен Telegram-бота не настроен на сервере." },
        { status: 500 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Не настроены ключи Supabase на сервере." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const mode: "webapp" | "widget" = body.mode === "webapp" ? "webapp" : "widget";
    const action: "login" | "link" = body.action === "link" ? "link" : "login";
    const roleMode: "business" | "client" =
      body.roleMode === "client" ? "client" : "business";

    const verified =
      mode === "webapp"
        ? verifyWebAppInitData(String(body.initData || ""), botToken)
        : verifyWidgetData((body.widgetData || {}) as TelegramUserPayload, botToken);

    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: 401 });
    }

    const tgUser = verified.user;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // MODE A: ПРИВЯЗКА TELEGRAM К УЖЕ АВТОРИЗОВАННОМУ АККАУНТУ
    if (action === "link") {
      const authHeader = req.headers.get("authorization") || "";
      const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!accessToken) {
        return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
      }

      const { data: userRes, error: userErr } = await admin.auth.getUser(accessToken);
      if (userErr || !userRes.user) {
        return NextResponse.json({ error: "Сессия недействительна." }, { status: 401 });
      }

      const currentUserId = userRes.user.id;

      // Проверяем, не привязан ли этот Telegram к другому аккаунту
      const { data: conflict } = await admin
        .from("profiles")
        .select("id, email")
        .eq("telegram_id", tgUser.id)
        .neq("id", currentUserId)
        .maybeSingle();

      if (conflict) {
        const isSyntheticTgAccount =
          typeof conflict.email === "string" &&
          conflict.email.startsWith("tg_") &&
          conflict.email.endsWith("@telegram.tiyin.kz");

        let canAutoMerge = false;
        if (isSyntheticTgAccount) {
          const { data: conflictBiz } = await admin
            .from("businesses")
            .select("id")
            .eq("owner_id", conflict.id)
            .maybeSingle();

          if (!conflictBiz) {
            canAutoMerge = true;
          }
        }

        if (!canAutoMerge) {
          return NextResponse.json(
            { error: "Этот Telegram уже привязан к другому аккаунту TIYIN Space." },
            { status: 409 }
          );
        }

        // Освобождаем telegram_id и удаляем пустой технический дубль
        await admin
          .from("profiles")
          .update({ telegram_id: null, telegram_username: null })
          .eq("id", conflict.id);

        await admin.from("profiles").delete().eq("id", conflict.id);
        await admin.auth.admin.deleteUser(conflict.id);
      }

      const { error: profErr } = await admin
        .from("profiles")
        .update({
          telegram_id: tgUser.id,
          telegram_username: tgUser.username,
        })
        .eq("id", currentUserId);

      if (profErr) {
        return NextResponse.json(
          { error: "Не удалось сохранить привязку Telegram в профиле." },
          { status: 500 }
        );
      }

      // Если у пользователя уже есть бизнес — автоматически подставим Chat ID для уведомлений (если пусто)
      const { data: biz } = await admin
        .from("businesses")
        .select("id")
        .eq("owner_id", currentUserId)
        .maybeSingle();

      if (biz?.id) {
        const { data: ch } = await admin
          .from("business_channels")
          .select("owner_telegram_chat_id")
          .eq("business_id", biz.id)
          .maybeSingle();

        if (!ch?.owner_telegram_chat_id) {
          await admin.from("business_channels").upsert(
            {
              business_id: biz.id,
              owner_telegram_chat_id: tgUser.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "business_id" }
          );
        }
      }

      return NextResponse.json({
        ok: true,
        linked: true,
        telegram_id: tgUser.id,
        telegram_username: tgUser.username,
      });
    }

    // MODE B: ВХОД ИЛИ РЕГИСТРАЦИЯ ЧЕРЕЗ TELEGRAM
    let { data: existingProfile } = await admin
      .from("profiles")
      .select("id, email, role, full_name")
      .eq("telegram_id", tgUser.id)
      .maybeSingle();

    // Если в profiles ещё нет telegram_id, проверяем, не привязан ли он уже в business_channels (уведомления)
    if (!existingProfile) {
      const { data: chMatches } = await admin
        .from("business_channels")
        .select("business_id")
        .eq("owner_telegram_chat_id", tgUser.id)
        .limit(2);

      if (chMatches && chMatches.length === 1 && chMatches[0].business_id) {
        const { data: matchedBiz } = await admin
          .from("businesses")
          .select("owner_id")
          .eq("id", chMatches[0].business_id)
          .maybeSingle();

        if (matchedBiz?.owner_id) {
          const { data: ownerProf } = await admin
            .from("profiles")
            .select("id, email, role, full_name, telegram_id")
            .eq("id", matchedBiz.owner_id)
            .maybeSingle();

          if (ownerProf && !ownerProf.telegram_id) {
            await admin
              .from("profiles")
              .update({
                telegram_id: tgUser.id,
                telegram_username: tgUser.username,
              })
              .eq("id", ownerProf.id);

            existingProfile = {
              id: ownerProf.id,
              email: ownerProf.email,
              role: ownerProf.role,
              full_name: ownerProf.full_name,
            };
          }
        }
      }
    }

    let targetUserId = existingProfile?.id || "";
    let targetEmail = existingProfile?.email || "";
    let targetRole: string = existingProfile?.role || roleMode;

    if (targetUserId) {
      // Обновляем username, если сменился, и берём актуальный email из auth.users
      const { data: authUserData } = await admin.auth.admin.getUserById(targetUserId);
      if (authUserData?.user?.email) {
        targetEmail = authUserData.user.email;
      }

      await admin
        .from("profiles")
        .update({
          telegram_username: tgUser.username,
          full_name: existingProfile?.full_name || tgUser.fullName,
        })
        .eq("id", targetUserId);
    } else {
      const syntheticEmail = `tg_${tgUser.id}@telegram.tiyin.kz`;

      // Пытаемся создать нового пользователя в Supabase Auth
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: {
          full_name: tgUser.fullName,
          telegram_id: tgUser.id,
          telegram_username: tgUser.username,
        },
      });

      if (createErr) {
        // Если пользователь с таким syntheticEmail уже есть в auth.users — переиспользуем его
        const { data: fallbackLink, error: fallbackErr } =
          await admin.auth.admin.generateLink({
            type: "magiclink",
            email: syntheticEmail,
          });

        if (fallbackErr || !fallbackLink?.user) {
          return NextResponse.json(
            { error: createErr.message || "Не удалось создать аккаунт." },
            { status: 500 }
          );
        }

        targetUserId = fallbackLink.user.id;
        targetEmail = syntheticEmail;
      } else if (created.user) {
        targetUserId = created.user.id;
        targetEmail = created.user.email || syntheticEmail;
      }

      await admin.from("profiles").upsert({
        id: targetUserId,
        email: targetEmail,
        full_name: tgUser.fullName,
        role: roleMode,
        telegram_id: tgUser.id,
        telegram_username: tgUser.username,
      });

      targetRole = roleMode;
    }

    // Если у пользователя есть бизнес — автоматически подставляем Chat ID для уведомлений (если ещё не задан)
    if (targetUserId) {
      const { data: biz } = await admin
        .from("businesses")
        .select("id")
        .eq("owner_id", targetUserId)
        .maybeSingle();

      if (biz?.id) {
        const { data: ch } = await admin
          .from("business_channels")
          .select("owner_telegram_chat_id")
          .eq("business_id", biz.id)
          .maybeSingle();

        if (!ch?.owner_telegram_chat_id) {
          await admin.from("business_channels").upsert(
            {
              business_id: biz.id,
              owner_telegram_chat_id: tgUser.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "business_id" }
          );
        }
      }
    }

    // Генерируем одноразовый magiclink-токен, чтобы браузер получил полноценную сессию Supabase
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      return NextResponse.json(
        { error: linkErr?.message || "Не удалось создать сессию входа." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      token_hash: linkData.properties.hashed_token,
      role: targetRole,
      telegram_id: tgUser.id,
      telegram_username: tgUser.username,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ошибка авторизации Telegram" },
      { status: 500 }
    );
  }
}
