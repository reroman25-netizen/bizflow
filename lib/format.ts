export function formatKZT(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount || 0) + " ₸";
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function slugify(input: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
    з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
    п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
    ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
    я: "ya", ә: "a", і: "i", ң: "n", ғ: "g", ү: "u", ұ: "u", қ: "q",
    ө: "o", һ: "h",
  };
  return input
    .toLowerCase()
    .split("")
    .map((ch) => (map[ch] !== undefined ? map[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function cleanPhoneForWa(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("8") && digits.length === 11) {
    return "7" + digits.slice(1);
  }
  return digits;
}

export function cleanTelegramHandle(tg: string): string {
  return tg.trim().replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "");
}
