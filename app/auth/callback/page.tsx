"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const finishOAuth = async () => {
      try {
        const supabase = getSupabaseClient();
        const roleMode = searchParams.get("role") === "client" ? "client" : "business";
        const code = searchParams.get("code");

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }

        // Ждём немного, если Supabase разбирает hash-токен
        let { data } = await supabase.auth.getSession();
        if (!data.session) {
          await new Promise((r) => setTimeout(r, 400));
          const retry = await supabase.auth.getSession();
          data = retry.data;
        }

        const session = data.session;
        const user = session?.user;

        if (!session || !user) {
          setErrorMsg("Не удалось завершить вход через Google. Попробуйте ещё раз.");
          return;
        }

        // Проверяем/создаём профиль
        const { data: existingProf } = await supabase
          .from("profiles")
          .select("id, role, full_name")
          .eq("id", user.id)
          .maybeSingle();

        const metaName =
          (user.user_metadata?.full_name as string | undefined) ||
          (user.user_metadata?.name as string | undefined) ||
          "";

        let finalRole = existingProf?.role || roleMode;

        if (!existingProf) {
          await supabase.from("profiles").upsert({
            id: user.id,
            email: user.email || "",
            full_name: metaName,
            role: roleMode,
          });
          finalRole = roleMode;
        } else if (!existingProf.full_name && metaName) {
          await supabase
            .from("profiles")
            .update({ full_name: metaName })
            .eq("id", user.id);
        }

        const checkRes = await fetch("/api/admin/check", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (checkRes.ok) {
          const checkJson = await checkRes.json();
          if (checkJson.isAdmin) {
            router.replace("/admin");
            return;
          }
        }

        if (finalRole === "client") {
          router.replace("/");
        } else {
          router.replace("/dashboard");
        }
      } catch {
        setErrorMsg("Ошибка соединения при завершении входа через Google.");
      }
    };

    finishOAuth();
  }, [router, searchParams]);

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#FAFAFB] flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white rounded-3xl border border-slate-200 p-6 text-center space-y-4 shadow-sm">
          <div className="text-sm font-semibold text-red-700">{errorMsg}</div>
          <button
            type="button"
            onClick={() => router.replace("/auth?mode=business&tab=login")}
            className="w-full py-3 rounded-xl bg-neutral-950 text-white text-sm font-semibold"
          >
            Вернуться ко входу
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFB] flex items-center justify-center text-sm text-slate-500">
      Выполняем вход через Google...
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFAFB] flex items-center justify-center text-sm text-slate-500">
          Выполняем вход...
        </div>
      }
    >
      <AuthCallbackHandler />
    </Suspense>
  );
}
