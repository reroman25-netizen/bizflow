export interface BrandColorPreset {
  name: string;
  hex: string;
}

export const BRAND_COLOR_PRESETS: BrandColorPreset[] = [
  { name: "Графит", hex: "#111827" },
  { name: "Сапфир", hex: "#2563EB" },
  { name: "Изумруд", hex: "#059669" },
  { name: "Рубин", hex: "#DC2626" },
  { name: "Терракота", hex: "#EA580C" },
  { name: "Индиго", hex: "#4F46E5" },
  { name: "Пурпур", hex: "#7C3AED" },
  { name: "Бирюза", hex: "#0D9488" },
  { name: "Шоколад", hex: "#78350F" },
  { name: "Малина", hex: "#DB2777" },
];

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function extractColorFromImageElement(img: HTMLImageElement): string | null {
  if (typeof document === "undefined") return null;
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, size, size);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return null;
  }

  const buckets = new Map<
    string,
    { rSum: number; gSum: number; bSum: number; weight: number }
  >();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 180) continue; // пропускаем прозрачные пиксели

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const saturation = max === 0 ? 0 : (max - min) / max;

    // Пропускаем почти белый и светло-серый фон
    if (brightness > 230 && saturation < 0.2) continue;

    // Квантизация по шагу 24 для группировки похожих оттенков
    const qr = Math.floor(r / 24);
    const qg = Math.floor(g / 24);
    const qb = Math.floor(b / 24);
    const key = `${qr}-${qg}-${qb}`;

    // Насыщенные цвета получают больший вес, чем серые
    const weight = 1 + saturation * 3.5;
    const prev = buckets.get(key);
    if (prev) {
      prev.rSum += r * weight;
      prev.gSum += g * weight;
      prev.bSum += b * weight;
      prev.weight += weight;
    } else {
      buckets.set(key, {
        rSum: r * weight,
        gSum: g * weight,
        bSum: b * weight,
        weight,
      });
    }
  }

  if (buckets.size === 0) return "#111827";

  let best: { rSum: number; gSum: number; bSum: number; weight: number } | null = null;
  buckets.forEach((entry) => {
    if (!best || entry.weight > best.weight) {
      best = entry;
    }
  });

  if (!best) return "#111827";
  const winner = best as { rSum: number; gSum: number; bSum: number; weight: number };
  let r = winner.rSum / winner.weight;
  let g = winner.gSum / winner.weight;
  let b = winner.bSum / winner.weight;

  // Если доминирующий цвет слишком светлый (плохо читается белый текст), слегка затемняем
  const lum = (r * 299 + g * 587 + b * 114) / 1000;
  if (lum > 185) {
    const factor = 165 / lum;
    r *= factor;
    g *= factor;
    b *= factor;
  }

  return rgbToHex(r, g, b);
}

export function extractDominantColorFromFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const hex = extractColorFromImageElement(img);
      URL.revokeObjectURL(url);
      resolve(hex);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export function extractDominantColorFromUrl(imageUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !imageUrl) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      resolve(extractColorFromImageElement(img));
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = imageUrl;
  });
}
