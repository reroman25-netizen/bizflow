"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  X,
  Upload,
  Trash2,
  Package,
  Pencil,
  ExternalLink,
  Film,
  ImagePlus,
  LayoutGrid,
  Store,
  Clock,
  Eye,
  EyeOff,
  Check,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  Business,
  Product,
  ProductItemType,
  ProductBadge,
  BusinessSlide,
  BusinessCategory,
} from "@/lib/types";
import { formatKZT } from "@/lib/format";
import { uploadBusinessMedia } from "@/lib/uploadMedia";
import { uploadSlideMedia } from "@/lib/uploadSlideMedia";
import { CATEGORY_PRESETS, CategoryPreset } from "@/lib/categoryPresets";

interface VisualStorefrontEditorProps {
  business: Business;
  products: Product[];
  onProductsChange: React.Dispatch<React.SetStateAction<Product[]>>;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
  initialOpenAddProduct?: boolean;
  onConsumedInitialAdd?: () => void;
}

const BADGE_OPTIONS: { id: ProductBadge; label: string; activeClass: string }[] = [
  { id: "hit", label: "Хит", activeClass: "bg-amber-500 text-white border-amber-500" },
  { id: "new", label: "Новинка", activeClass: "bg-indigo-600 text-white border-indigo-600" },
  { id: "discount", label: "Скидка", activeClass: "bg-rose-600 text-white border-rose-600" },
  {
    id: "in_stock",
    label: "В наличии",
    activeClass: "bg-emerald-600 text-white border-emerald-600",
  },
];

const PRESET_GROUPS = ["Все", "Авто", "Еда", "Магазин", "Дом и техника", "Услуги"];

export function VisualStorefrontEditor({
  business,
  products,
  onProductsChange,
  onNotice,
  onError,
  initialOpenAddProduct,
  onConsumedInitialAdd,
}: VisualStorefrontEditorProps) {
  const brandColor = (business.brand_color || "#111827").trim() || "#111827";
  const isServiceMode = business.storefront_template === "services";

  const [viewMode, setViewMode] = useState<"shop" | "catalog">("shop");
  const [selectedCat, setSelectedCat] = useState<string>("Все");
  const [catalogDrillCat, setCatalogDrillCat] = useState<string | null>(null);

  const [slides, setSlides] = useState<BusinessSlide[]>([]);
  const [categories, setCategories] = useState<BusinessCategory[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Slide modal state
  const [slideModalOpen, setSlideModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<BusinessSlide | null>(null);
  const [slideMediaUrl, setSlideMediaUrl] = useState("");
  const [slideMediaType, setSlideMediaType] = useState<"image" | "video">("image");
  const [slideTitle, setSlideTitle] = useState("");
  const [slideSubtitle, setSlideSubtitle] = useState("");
  const [slideBadge, setSlideBadge] = useState("");
  const [slideLinkCat, setSlideLinkCat] = useState("");
  const [uploadingSlide, setUploadingSlide] = useState(false);
  const [savingSlide, setSavingSlide] = useState(false);

  // Category modal state
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<BusinessCategory | null>(null);
  const [catName, setCatName] = useState("");
  const [catImageUrl, setCatImageUrl] = useState("");
  const [catIconKey, setCatIconKey] = useState("");
  const [presetGroup, setPresetGroup] = useState("Все");
  const [uploadingCatImg, setUploadingCatImg] = useState(false);
  const [savingCat, setSavingCat] = useState(false);

  // Product modal state (Create or Edit)
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [prodType, setProdType] = useState<ProductItemType>(
    isServiceMode ? "service" : "product"
  );
  const [prodName, setProdName] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodOldPrice, setProdOldPrice] = useState("");
  const [prodCashback, setProdCashback] = useState("");
  const [prodCategory, setProdCategory] = useState("");
  const [prodDuration, setProdDuration] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodImageUrl, setProdImageUrl] = useState("");
  const [prodGallery, setProdGallery] = useState<string[]>([]);
  const [prodBadges, setProdBadges] = useState<string[]>([]);
  const [prodAvailable, setProdAvailable] = useState(true);
  const [uploadingProdImg, setUploadingProdImg] = useState(false);
  const [savingProd, setSavingProd] = useState(false);

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    const supabase = getSupabaseClient();
    const [slidesRes, catsRes] = await Promise.all([
      supabase
        .from("business_slides")
        .select("*")
        .eq("business_id", business.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("business_categories")
        .select("*")
        .eq("business_id", business.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    setSlides((slidesRes.data as BusinessSlide[]) || []);
    setCategories((catsRes.data as BusinessCategory[]) || []);
    setLoadingMeta(false);
  }, [business.id]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const openNewProductModal = useCallback(
    (presetCategoryName?: string) => {
      setEditingProd(null);
      setProdType(isServiceMode ? "service" : "product");
      setProdName("");
      setProdPrice("");
      setProdOldPrice("");
      setProdCashback("");
      setProdCategory(
        presetCategoryName ||
          (selectedCat !== "Все" ? selectedCat : categories[0]?.name || "")
      );
      setProdDuration("");
      setProdDesc("");
      setProdImageUrl("");
      setProdGallery([]);
      setProdBadges(["in_stock"]);
      setProdAvailable(true);
      setProdModalOpen(true);
    },
    [isServiceMode, selectedCat, categories]
  );

  useEffect(() => {
    if (initialOpenAddProduct) {
      openNewProductModal();
      onConsumedInitialAdd?.();
    }
  }, [initialOpenAddProduct, openNewProductModal, onConsumedInitialAdd]);

  // Merge custom visual categories + categories inferred from products
  const productCounts: Record<string, number> = {};
  const productFirstImg: Record<string, string> = {};
  for (const p of products) {
    const c = (p.category || "").trim();
    if (c) {
      productCounts[c] = (productCounts[c] || 0) + 1;
      if (!productFirstImg[c] && p.image_url?.trim()) {
        productFirstImg[c] = p.image_url.trim();
      }
    }
  }

  const mergedCategories: {
    id?: string;
    name: string;
    imageUrl: string;
    iconKey: string;
    count: number;
    record?: BusinessCategory;
  }[] = [];
  const seenCats = new Set<string>();

  for (const c of categories) {
    const clean = (c.name || "").trim();
    if (!clean || seenCats.has(clean.toLowerCase())) continue;
    seenCats.add(clean.toLowerCase());
    mergedCategories.push({
      id: c.id,
      name: clean,
      imageUrl: c.image_url?.trim() || productFirstImg[clean] || "",
      iconKey: c.icon_key || "",
      count: productCounts[clean] || 0,
      record: c,
    });
  }
  for (const [cName, cnt] of Object.entries(productCounts)) {
    const low = cName.toLowerCase();
    if (low === "основное" || seenCats.has(low)) continue;
    seenCats.add(low);
    mergedCategories.push({
      name: cName,
      imageUrl: productFirstImg[cName] || "",
      iconKey: "",
      count: cnt,
    });
  }

  const presetByKey = new Map<string, CategoryPreset>(
    CATEGORY_PRESETS.map((p) => [p.key, p])
  );

  const visibleProducts =
    viewMode === "catalog" && catalogDrillCat
      ? products.filter((p) => (p.category || "").trim() === catalogDrillCat)
      : selectedCat === "Все"
      ? products
      : products.filter((p) => (p.category || "").trim() === selectedCat);

  // ================= SLIDE HANDLERS =================
  const openNewSlideModal = () => {
    setEditingSlide(null);
    setSlideMediaUrl("");
    setSlideMediaType("image");
    setSlideTitle("");
    setSlideSubtitle("");
    setSlideBadge("");
    setSlideLinkCat("");
    setSlideModalOpen(true);
  };

  const openEditSlideModal = (slide: BusinessSlide) => {
    setEditingSlide(slide);
    setSlideMediaUrl(slide.media_url);
    setSlideMediaType(slide.media_type === "video" ? "video" : "image");
    setSlideTitle(slide.title || "");
    setSlideSubtitle(slide.subtitle || "");
    setSlideBadge(slide.badge_text || "");
    setSlideLinkCat(slide.link_category || "");
    setSlideModalOpen(true);
  };

  const handleSlideFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onError("");
    setUploadingSlide(true);
    const res = await uploadSlideMedia({ businessId: business.id, file });
    setUploadingSlide(false);
    e.target.value = "";
    if (res.error || !res.url) {
      onError(res.error || "Ошибка загрузки файла для слайда.");
      return;
    }
    setSlideMediaUrl(res.url);
    setSlideMediaType(res.mediaType || "image");
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slideMediaUrl.trim()) {
      onError("Загрузите фото или короткое видео (10–15 сек) для слайда.");
      return;
    }
    setSavingSlide(true);
    const supabase = getSupabaseClient();

    if (editingSlide) {
      const { data, error } = await supabase
        .from("business_slides")
        .update({
          media_url: slideMediaUrl.trim(),
          media_type: slideMediaType,
          title: slideTitle.trim(),
          subtitle: slideSubtitle.trim(),
          badge_text: slideBadge.trim(),
          link_category: slideLinkCat.trim(),
        })
        .eq("id", editingSlide.id)
        .select()
        .single();

      setSavingSlide(false);
      if (error) {
        onError(error.message);
        return;
      }
      if (data) {
        setSlides((prev) =>
          prev.map((s) => (s.id === editingSlide.id ? (data as BusinessSlide) : s))
        );
      }
      setSlideModalOpen(false);
      onNotice("Слайд обновлён!");
    } else {
      const { data, error } = await supabase
        .from("business_slides")
        .insert({
          business_id: business.id,
          media_url: slideMediaUrl.trim(),
          media_type: slideMediaType,
          title: slideTitle.trim(),
          subtitle: slideSubtitle.trim(),
          badge_text: slideBadge.trim(),
          link_category: slideLinkCat.trim(),
          sort_order: slides.length,
          is_active: true,
        })
        .select()
        .single();

      setSavingSlide(false);
      if (error) {
        onError(error.message);
        return;
      }
      if (data) {
        setSlides((prev) => [...prev, data as BusinessSlide]);
      }
      setSlideModalOpen(false);
      onNotice("Слайд добавлен на витрину!");
    }
  };

  const handleDeleteSlide = async (id: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("business_slides").delete().eq("id", id);
    if (!error) {
      setSlides((prev) => prev.filter((s) => s.id !== id));
      setSlideModalOpen(false);
      onNotice("Слайд удалён.");
    }
  };

  // ================= CATEGORY HANDLERS =================
  const openNewCatModal = () => {
    setEditingCat(null);
    setCatName("");
    setCatImageUrl("");
    setCatIconKey("");
    setPresetGroup("Все");
    setCatModalOpen(true);
  };

  const openEditCatModal = (item: {
    name: string;
    imageUrl: string;
    iconKey: string;
    record?: BusinessCategory;
  }) => {
    setEditingCat(item.record || null);
    setCatName(item.name);
    setCatImageUrl(item.record?.image_url || item.imageUrl || "");
    setCatIconKey(item.iconKey || "");
    setPresetGroup("Все");
    setCatModalOpen(true);
  };

  const handleCatImgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onError("");
    setUploadingCatImg(true);
    const res = await uploadBusinessMedia({
      businessId: business.id,
      folder: "products",
      file,
    });
    setUploadingCatImg(false);
    e.target.value = "";
    if (res.error || !res.url) {
      onError(res.error || "Ошибка загрузки картинки категории.");
      return;
    }
    setCatImageUrl(res.url);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = catName.trim();
    if (!cleanName) return;
    setSavingCat(true);
    const supabase = getSupabaseClient();

    if (editingCat) {
      const oldName = editingCat.name;
      const { data, error } = await supabase
        .from("business_categories")
        .update({
          name: cleanName,
          image_url: catImageUrl.trim(),
          icon_key: catIconKey,
        })
        .eq("id", editingCat.id)
        .select()
        .single();

      if (error) {
        setSavingCat(false);
        onError(error.message);
        return;
      }

      // Если переименовали категорию — обновим название и у товаров в этой категории
      if (oldName !== cleanName) {
        await supabase
          .from("products")
          .update({ category: cleanName })
          .eq("business_id", business.id)
          .eq("category", oldName);
        onProductsChange((prev) =>
          prev.map((p) => (p.category === oldName ? { ...p, category: cleanName } : p))
        );
        if (selectedCat === oldName) setSelectedCat(cleanName);
        if (catalogDrillCat === oldName) setCatalogDrillCat(cleanName);
      }

      if (data) {
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCat.id ? (data as BusinessCategory) : c))
        );
      }
      setSavingCat(false);
      setCatModalOpen(false);
      onNotice("Категория обновлена!");
    } else {
      const { data, error } = await supabase
        .from("business_categories")
        .insert({
          business_id: business.id,
          name: cleanName,
          image_url: catImageUrl.trim(),
          icon_key: catIconKey,
          sort_order: categories.length,
        })
        .select()
        .single();

      setSavingCat(false);
      if (error) {
        onError(error.message);
        return;
      }
      if (data) {
        setCategories((prev) => [...prev, data as BusinessCategory]);
      }
      setCatModalOpen(false);
      onNotice(`Категория «${cleanName}» добавлена!`);
    }
  };

  const handleDeleteCategory = async (cat: BusinessCategory) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("business_categories")
      .delete()
      .eq("id", cat.id);
    if (!error) {
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      if (selectedCat === cat.name) setSelectedCat("Все");
      if (catalogDrillCat === cat.name) setCatalogDrillCat(null);
      setCatModalOpen(false);
      onNotice("Категория удалена.");
    }
  };

  // ================= PRODUCT HANDLERS =================
  const openEditProductModal = (prod: Product) => {
    setEditingProd(prod);
    setProdType(prod.item_type === "service" ? "service" : "product");
    setProdName(prod.name);
    setProdPrice(String(prod.price));
    setProdOldPrice(prod.old_price ? String(prod.old_price) : "");
    setProdCashback(prod.cashback_percent ? String(prod.cashback_percent) : "");
    setProdCategory(prod.category === "Основное" ? "" : prod.category || "");
    setProdDuration(prod.duration_label || "");
    setProdDesc(prod.description || "");
    setProdImageUrl(prod.image_url || "");
    setProdGallery(Array.isArray(prod.gallery_urls) ? prod.gallery_urls : []);
    setProdBadges(Array.isArray(prod.badges) ? (prod.badges as string[]) : []);
    setProdAvailable(Boolean(prod.is_available));
    setProdModalOpen(true);
  };

  const handleProdMainPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onError("");
    setUploadingProdImg(true);
    const res = await uploadBusinessMedia({
      businessId: business.id,
      folder: "products",
      file,
    });
    setUploadingProdImg(false);
    e.target.value = "";
    if (res.error || !res.url) {
      onError(res.error || "Ошибка загрузки фото товара.");
      return;
    }
    setProdImageUrl(res.url);
  };

  const handleProdGalleryPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (prodGallery.length >= 4) {
      onError("Можно добавить до 4 дополнительных фото.");
      return;
    }
    onError("");
    setUploadingProdImg(true);
    const res = await uploadBusinessMedia({
      businessId: business.id,
      folder: "products",
      file,
    });
    setUploadingProdImg(false);
    e.target.value = "";
    if (res.error || !res.url) {
      onError(res.error || "Ошибка загрузки дополнительного фото.");
      return;
    }
    setProdGallery((prev) => [...prev, res.url!]);
  };

  const toggleBadge = (badgeId: ProductBadge) => {
    setProdBadges((prev) =>
      prev.includes(badgeId)
        ? prev.filter((b) => b !== badgeId)
        : [...prev, badgeId]
    );
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseInt(prodPrice, 10);
    if (!prodName.trim() || isNaN(priceNum) || priceNum < 0) return;

    const oldPriceNum = prodOldPrice.trim() ? parseInt(prodOldPrice, 10) : null;
    const validOldPrice =
      oldPriceNum && !isNaN(oldPriceNum) && oldPriceNum > priceNum
        ? oldPriceNum
        : null;
    const cashbackNum = prodCashback.trim()
      ? Math.max(0, Math.min(50, parseInt(prodCashback, 10) || 0))
      : 0;

    setSavingProd(true);
    const supabase = getSupabaseClient();
    const payload = {
      name: prodName.trim(),
      price: priceNum,
      old_price: validOldPrice,
      cashback_percent: cashbackNum,
      badges: prodBadges,
      category: prodCategory.trim(),
      description: prodDesc.trim(),
      item_type: prodType,
      duration_label: prodDuration.trim(),
      image_url: prodImageUrl.trim(),
      gallery_urls: prodGallery,
      is_available: prodAvailable,
    };

    if (editingProd) {
      const { data, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", editingProd.id)
        .select()
        .single();

      setSavingProd(false);
      if (error) {
        onError(error.message);
        return;
      }
      if (data) {
        onProductsChange((prev) =>
          prev.map((p) => (p.id === editingProd.id ? (data as Product) : p))
        );
      }
      setProdModalOpen(false);
      onNotice("Товар обновлён на витрине!");
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert({
          business_id: business.id,
          ...payload,
        })
        .select()
        .single();

      setSavingProd(false);
      if (error) {
        onError(error.message);
        return;
      }
      if (data) {
        onProductsChange((prev) => [data as Product, ...prev]);
      }
      setProdModalOpen(false);
      onNotice("Добавлено на витрину!");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) {
      onProductsChange((prev) => prev.filter((p) => p.id !== id));
      setProdModalOpen(false);
      onNotice("Позиция удалена.");
    }
  };

  const businessInitials = (business.pwa_short_name || business.name || "TS")
    .trim()
    .slice(0, 2)
    .toUpperCase();

  const filteredPresets =
    presetGroup === "Все"
      ? CATEGORY_PRESETS
      : CATEGORY_PRESETS.filter((p) => p.group === presetGroup);

  const previewDiscountPct = (() => {
    const p = parseInt(prodPrice, 10);
    const o = parseInt(prodOldPrice, 10);
    if (!isNaN(p) && !isNaN(o) && o > p && p >= 0) {
      return Math.round(((o - p) / o) * 100);
    }
    return 0;
  })();

  return (
    <div className="space-y-4">
      {/* TOP EDITOR HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-950">Витрина и каталог</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Редактируйте витрину прямо здесь — нажимайте на <strong>+</strong> или на любой элемент.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex p-1 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setViewMode("shop");
                setCatalogDrillCat(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                viewMode === "shop"
                  ? "bg-neutral-950 text-white"
                  : "text-slate-600 hover:text-neutral-950"
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Главная</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("catalog")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                viewMode === "catalog"
                  ? "bg-neutral-950 text-white"
                  : "text-slate-600 hover:text-neutral-950"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Категории</span>
            </button>
          </div>

          <Link
            href={`/${business.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-neutral-900 shadow-sm transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Как видит клиент</span>
          </Link>
        </div>
      </div>

      {/* LIVE VISUAL STOREFRONT CANVAS */}
      <div className="bg-[#F7F8FA] rounded-3xl border border-slate-200/90 overflow-hidden shadow-sm">
        {/* Mini App Header Preview */}
        <div className="bg-white px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl text-white text-[11px] font-extrabold overflow-hidden flex items-center justify-center shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {business.logo_url ? (
                <img
                  src={business.logo_url}
                  alt={business.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                businessInitials
              )}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm text-neutral-950 truncate leading-tight">
                {business.pwa_short_name || business.name}
              </div>
              <div className="text-[10px] text-slate-400 leading-tight">
                Режим редактора · цвет бренда{" "}
                <span
                  className="inline-block w-2 h-2 rounded-full align-middle ml-0.5"
                  style={{ backgroundColor: brandColor }}
                />
              </div>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold shrink-0">
            Позиций: {products.length}
          </span>
        </div>

        {/* ================= EDITOR VIEW 1: MAIN STOREFRONT ================= */}
        {viewMode === "shop" ? (
          <div className="p-3.5 sm:p-5 space-y-5">
            {/* 1. SLIDES (PROMO / VIDEO 10-15 SEC) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Слайды и акции (фото или видео 10–15 сек)
                </span>
                <span className="text-[11px] text-slate-400">{slides.length} шт.</span>
              </div>

              <div className="flex gap-2.5 overflow-x-auto pb-1 snap-x snap-mandatory no-scrollbar">
                {slides.map((slide) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => openEditSlideModal(slide)}
                    className="relative w-60 sm:w-64 h-32 sm:h-36 rounded-2xl overflow-hidden bg-neutral-900 shrink-0 text-left group"
                  >
                    {slide.media_type === "video" ? (
                      <video
                        src={slide.media_url}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={slide.media_url}
                        alt={slide.title || "Слайд"}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    {slide.badge_text && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-white/95 text-neutral-950 text-[10px] font-bold">
                        {slide.badge_text}
                      </span>
                    )}
                    <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center">
                      <Pencil className="w-3.5 h-3.5" />
                    </span>
                    <div className="absolute bottom-2 inset-x-2.5 text-white">
                      <div className="font-bold text-xs line-clamp-1">
                        {slide.title || (slide.media_type === "video" ? "Видео-слайд" : "Баннер")}
                      </div>
                      {slide.subtitle && (
                        <div className="text-[10px] text-white/75 line-clamp-1">
                          {slide.subtitle}
                        </div>
                      )}
                    </div>
                  </button>
                ))}

                {/* Always show up to 5 swipeable slide slots (or +1 if 5+ already filled) */}
                {Array.from({
                  length: Math.max(1, 5 - slides.length),
                }).map((_, idx) => {
                  const slotNumber = slides.length + idx + 1;
                  return (
                    <button
                      key={`empty-slide-${slotNumber}`}
                      type="button"
                      onClick={openNewSlideModal}
                      className="w-56 sm:w-64 h-32 sm:h-36 rounded-2xl border-2 border-dashed border-slate-300 hover:border-neutral-900 bg-white/85 hover:bg-white flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-neutral-950 shrink-0 snap-start transition"
                    >
                      <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                        <Plus className="w-5 h-5" />
                      </span>
                      <span className="text-xs font-semibold">
                        Слайд {slotNumber}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Фото или видео до 50 МБ
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. HORIZONTAL VISUAL CATEGORIES */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Категории каталога
                </span>
                <button
                  type="button"
                  onClick={openNewCatModal}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  + Выбрать из 24 готовых
                </button>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                {/* Plus Tile to Add Category */}
                <button
                  type="button"
                  onClick={openNewCatModal}
                  className="flex flex-col items-center gap-1.5 shrink-0 w-[68px] group"
                >
                  <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-300 group-hover:border-neutral-900 bg-white flex items-center justify-center text-slate-500 group-hover:text-neutral-950 transition">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 text-center leading-tight">
                    Категория
                  </span>
                </button>



                {mergedCategories.map((cat) => {
                  const active = selectedCat === cat.name;
                  const preset = cat.iconKey ? presetByKey.get(cat.iconKey) : undefined;
                  return (
                    <div
                      key={cat.name}
                      className="relative flex flex-col items-center gap-1.5 shrink-0 w-[68px]"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedCat((prev) => (prev === cat.name ? "Все" : cat.name))}
                        className="w-16 h-16 rounded-2xl bg-white overflow-hidden flex items-center justify-center border-2 transition"
                        style={{
                          borderColor: active ? brandColor : "#E2E8F0",
                          backgroundColor:
                            !cat.imageUrl && preset ? preset.bg : "#FFFFFF",
                        }}
                      >
                        {cat.imageUrl ? (
                          <img
                            src={cat.imageUrl}
                            alt={cat.name}
                            className="w-full h-full object-cover"
                          />
                        ) : preset ? (
                          <span className="text-2xl">{preset.emoji}</span>
                        ) : (
                          <span className="text-sm font-bold text-slate-500">
                            {cat.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditCatModal(cat)}
                        className="absolute -top-1 -right-0.5 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:text-neutral-950"
                        title="Редактировать категорию"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>

                      <span className="text-[11px] font-medium text-neutral-800 text-center line-clamp-2 leading-tight">
                        {cat.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. PRODUCTS GRID / SERVICES LIST WITH "+" CARD */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {isServiceMode ? "Услуги на витрине" : "Товары на витрине"}
                  {selectedCat !== "Все" ? ` · ${selectedCat}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => openNewProductModal()}
                  style={{ backgroundColor: brandColor }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-white text-xs font-semibold shadow-sm hover:opacity-95 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isServiceMode ? "Услуга" : "Товар"}</span>
                </button>
              </div>

              {isServiceMode ? (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => openNewProductModal()}
                    className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-300 hover:border-neutral-900 bg-white/80 hover:bg-white flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 hover:text-neutral-950 transition"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Добавить новую услугу</span>
                  </button>

                  {visibleProducts.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => openEditProductModal(service)}
                      className={`w-full text-left bg-white rounded-2xl border border-slate-200/80 p-3.5 flex items-center justify-between gap-3 hover:border-neutral-400 transition ${
                        !service.is_available ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                          {service.image_url ? (
                            <img
                              src={service.image_url}
                              alt={service.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Sparkles className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-neutral-950 truncate">
                            {service.name}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="font-extrabold text-sm text-neutral-950">
                              {formatKZT(service.price)}
                            </span>
                            {service.duration_label && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                <Clock className="w-3 h-3" />
                                {service.duration_label}
                              </span>
                            )}
                            {!service.is_available && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-semibold">
                                Скрыто
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                        <Pencil className="w-4 h-4" />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  {/* Plus Card to Add Product */}
                  <button
                    type="button"
                    onClick={() => openNewProductModal()}
                    className="min-h-[220px] rounded-2xl border-2 border-dashed border-slate-300 hover:border-neutral-900 bg-white/80 hover:bg-white flex flex-col items-center justify-center gap-2 p-4 text-slate-500 hover:text-neutral-950 transition"
                  >
                    <span className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <Plus className="w-6 h-6" />
                    </span>
                    <span className="text-xs font-bold text-center">
                      Добавить товар
                    </span>
                    <span className="text-[10px] text-slate-400 text-center">
                      Фото, цена, скидка, кэшбэк
                    </span>
                  </button>

                  {visibleProducts.map((product) => {
                    const hasDiscount = Boolean(
                      product.old_price && product.old_price > product.price
                    );
                    const discountPct = hasDiscount
                      ? Math.round(
                          ((Number(product.old_price) - product.price) /
                            Number(product.old_price)) *
                            100
                        )
                      : 0;
                    const cashback = Number(product.cashback_percent || 0);
                    const badges = Array.isArray(product.badges) ? product.badges : [];

                    return (
                      <div
                        key={product.id}
                        onClick={() => openEditProductModal(product)}
                        className={`bg-white rounded-2xl border border-slate-200/80 hover:border-neutral-400 overflow-hidden flex flex-col cursor-pointer transition ${
                          !product.is_available ? "opacity-60" : ""
                        }`}
                      >
                        <div className="relative aspect-square bg-[#F4F5F7] overflow-hidden">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <Package className="w-8 h-8" />
                            </div>
                          )}

                          <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[72%]">
                            {hasDiscount && discountPct > 0 && (
                              <span className="px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-bold leading-none">
                                -{discountPct}%
                              </span>
                            )}
                            {badges.includes("hit") && (
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-bold leading-none">
                                Хит
                              </span>
                            )}
                            {badges.includes("new") && (
                              <span className="px-1.5 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-bold leading-none">
                                Новинка
                              </span>
                            )}
                          </div>

                          <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 shadow-sm text-neutral-800 flex items-center justify-center">
                            <Pencil className="w-3.5 h-3.5" />
                          </span>

                          {!product.is_available && (
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-semibold">
                              Скрыто с витрины
                            </span>
                          )}
                        </div>

                        <div className="p-2.5 flex-1 flex flex-col justify-between gap-1.5">
                          <div className="space-y-1">
                            {cashback > 0 && (
                              <span className="inline-flex px-1.5 py-0.5 rounded-md bg-[#48B81A] text-white text-[10px] font-extrabold leading-none">
                                {cashback}% Б
                              </span>
                            )}
                            <div className="font-semibold text-xs text-neutral-950 line-clamp-2 leading-snug">
                              {product.name}
                            </div>
                          </div>

                          <div className="pt-1">
                            {hasDiscount && product.old_price && (
                              <div className="text-[10px] text-slate-400 line-through leading-none">
                                {formatKZT(product.old_price)}
                              </div>
                            )}
                            <div className="font-extrabold text-sm text-neutral-950">
                              {formatKZT(product.price)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ================= EDITOR VIEW 2: 3-COLUMN CATALOG CATEGORIES ================= */
          <div className="p-3.5 sm:p-5 space-y-4">
            {catalogDrillCat ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setCatalogDrillCat(null)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-neutral-950"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Ко всем категориям</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-950">
                      {catalogDrillCat}
                    </span>
                    <button
                      type="button"
                      onClick={() => openNewProductModal(catalogDrillCat)}
                      style={{ backgroundColor: brandColor }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-white text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Добавить сюда</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => openNewProductModal(catalogDrillCat)}
                    className="min-h-[180px] rounded-2xl border-2 border-dashed border-slate-300 hover:border-neutral-900 bg-white flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-neutral-950 transition"
                  >
                    <Plus className="w-6 h-6" />
                    <span className="text-xs font-semibold">Добавить товар</span>
                  </button>
                  {visibleProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openEditProductModal(p)}
                      className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden text-left flex flex-col"
                    >
                      <div className="aspect-square bg-slate-100 overflow-hidden">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <Package className="w-7 h-7" />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <div className="text-xs font-semibold text-neutral-950 line-clamp-1">
                          {p.name}
                        </div>
                        <div className="text-sm font-extrabold text-neutral-950 mt-0.5">
                          {formatKZT(p.price)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Сетка категорий (как на экране «Каталог» у клиента)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {mergedCategories.length} категорий
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={openNewCatModal}
                    className="h-32 rounded-2xl border-2 border-dashed border-slate-300 hover:border-neutral-900 bg-white/80 hover:bg-white p-2.5 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-neutral-950 transition"
                  >
                    <Plus className="w-6 h-6" />
                    <span className="text-[11px] font-bold text-center leading-tight">
                      Новая категория
                    </span>
                  </button>

                  {mergedCategories.map((cat) => {
                    const preset = cat.iconKey ? presetByKey.get(cat.iconKey) : undefined;
                    return (
                      <div
                        key={cat.name}
                        onClick={() => setCatalogDrillCat(cat.name)}
                        className="relative bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 h-32 flex flex-col justify-between text-left cursor-pointer transition overflow-hidden"
                      >
                        <div className="flex items-start justify-between gap-1 z-10">
                          <span className="text-[11px] font-semibold text-neutral-900 leading-tight line-clamp-2">
                            {cat.name}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditCatModal(cat);
                            }}
                            className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0"
                            title="Изменить категорию"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex items-end justify-between">
                          <span className="text-[10px] font-semibold text-slate-400">
                            {cat.count} шт.
                          </span>
                          <div
                            className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor:
                                !cat.imageUrl && preset ? preset.bg : "#F1F5F9",
                            }}
                          >
                            {cat.imageUrl ? (
                              <img
                                src={cat.imageUrl}
                                alt={cat.name}
                                className="w-full h-full object-cover"
                              />
                            ) : preset ? (
                              <span className="text-2xl">{preset.emoji}</span>
                            ) : (
                              <Package className="w-5 h-5 text-slate-300" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {loadingMeta && (
          <div className="px-5 pb-4 text-xs text-slate-400">
            Синхронизация слайдов и категорий...
          </div>
        )}
      </div>

      {/* ==================== MODAL 1: ADD / EDIT SLIDE ==================== */}
      {slideModalOpen && (
        <div
          onClick={() => setSlideModalOpen(false)}
          className="fixed inset-0 bg-black/55 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md max-h-[90vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-base text-neutral-950">
                {editingSlide ? "Редактировать слайд" : "Новый слайд (акция / видео)"}
              </h2>
              <button
                type="button"
                onClick={() => setSlideModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="slide-editor-form"
              onSubmit={handleSaveSlide}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              {/* Preview + Upload */}
              <div className="space-y-2.5">
                <div className="relative h-44 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                  {slideMediaUrl ? (
                    slideMediaType === "video" ? (
                      <video
                        src={slideMediaUrl}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={slideMediaUrl}
                        alt="Превью слайда"
                        className="w-full h-full object-cover"
                      />
                    )
                  ) : (
                    <div className="text-center text-slate-400 space-y-1">
                      <Film className="w-8 h-8 mx-auto opacity-60" />
                      <div className="text-xs font-medium">
                        Загрузите фото или короткое видео (10–15 сек)
                      </div>
                    </div>
                  )}
                </div>

                <label className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-neutral-900 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition">
                  <Upload className="w-4 h-4" />
                  <span>
                    {uploadingSlide
                      ? "Загружаем медиа..."
                      : slideMediaUrl
                      ? "Заменить фото / видео"
                      : "Выбрать фото (до 15 МБ) или видео (до 50 МБ)"}
                  </span>
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/webm,video/quicktime"
                    onChange={handleSlideFileChange}
                    disabled={uploadingSlide}
                    className="hidden"
                  />
                </label>
                <p className="text-[11px] text-slate-400">
                  На витрине видео проигрывается без звука, а когда клиент нажимает на слайд — открывается крупно и со звуком.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Заголовок (необяз.)
                  </label>
                  <input
                    type="text"
                    value={slideTitle}
                    onChange={(e) => setSlideTitle(e.target.value)}
                    placeholder="Напр. Скидки недели"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Бейдж (необяз.)
                  </label>
                  <input
                    type="text"
                    value={slideBadge}
                    onChange={(e) => setSlideBadge(e.target.value)}
                    placeholder="Напр. -30% или ХИТ"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Короткий текст (необяз.)
                </label>
                <input
                  type="text"
                  value={slideSubtitle}
                  onChange={(e) => setSlideSubtitle(e.target.value)}
                  placeholder="Напр. Только до конца месяца"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Кнопка перехода в категорию (необяз.)
                </label>
                <select
                  value={slideLinkCat}
                  onChange={(e) => setSlideLinkCat(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="">Без перехода</option>
                  {mergedCategories.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </form>

            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0">
              {editingSlide ? (
                <button
                  type="button"
                  onClick={() => handleDeleteSlide(editingSlide.id)}
                  className="px-3.5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </button>
              ) : (
                <span />
              )}
              <button
                type="submit"
                form="slide-editor-form"
                disabled={savingSlide || uploadingSlide || !slideMediaUrl}
                className="px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition"
              >
                {savingSlide ? "Сохраняем..." : "Сохранить слайд"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: ADD / EDIT CATEGORY (24 PRESETS) ==================== */}
      {catModalOpen && (
        <div
          onClick={() => setCatModalOpen(false)}
          className="fixed inset-0 bg-black/55 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-base text-neutral-950">
                {editingCat ? "Настройка категории" : "Добавить категорию"}
              </h2>
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="cat-editor-form"
              onSubmit={handleSaveCategory}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              {/* Ready presets picker */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-600">
                  Выберите готовую категорию (или введите свою ниже)
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {PRESET_GROUPS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setPresetGroup(g)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition ${
                        presetGroup === g
                          ? "bg-neutral-950 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                  {filteredPresets.map((pr) => {
                    const selected = catIconKey === pr.key && catName === pr.name;
                    return (
                      <button
                        key={pr.key}
                        type="button"
                        onClick={() => {
                          setCatName(pr.name);
                          setCatIconKey(pr.key);
                        }}
                        className={`p-2 rounded-xl border text-center flex flex-col items-center gap-1 transition ${
                          selected
                            ? "border-neutral-950 bg-neutral-50 ring-1 ring-neutral-950"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <span
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                          style={{ backgroundColor: pr.bg }}
                        >
                          {pr.emoji}
                        </span>
                        <span className="text-[10px] font-semibold text-neutral-800 line-clamp-2 leading-tight">
                          {pr.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Название категории
                  </label>
                  <input
                    type="text"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="Например: Моторные масла"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    required
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {catImageUrl ? (
                      <img
                        src={catImageUrl}
                        alt="Иконка категории"
                        className="w-full h-full object-cover"
                      />
                    ) : catIconKey && presetByKey.get(catIconKey) ? (
                      <span className="text-2xl">
                        {presetByKey.get(catIconKey)?.emoji}
                      </span>
                    ) : (
                      <ImagePlus className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-neutral-900 text-xs font-semibold cursor-pointer transition">
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {uploadingCatImg ? "Загрузка..." : "Загрузить своё фото"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCatImgUpload}
                          disabled={uploadingCatImg}
                          className="hidden"
                        />
                      </label>
                      {catImageUrl && (
                        <button
                          type="button"
                          onClick={() => setCatImageUrl("")}
                          className="px-2.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-50"
                        >
                          Убрать фото
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Необязательно — если не загружать, возьмётся фото первого товара в категории.
                    </p>
                  </div>
                </div>
              </div>
            </form>

            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0">
              {editingCat ? (
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(editingCat)}
                  className="px-3.5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </button>
              ) : (
                <span />
              )}
              <button
                type="submit"
                form="cat-editor-form"
                disabled={savingCat || uploadingCatImg || !catName.trim()}
                className="px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition"
              >
                {savingCat ? "Сохраняем..." : "Сохранить категорию"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 3: ADD / EDIT PRODUCT ==================== */}
      {prodModalOpen && (
        <div
          onClick={() => setProdModalOpen(false)}
          className="fixed inset-0 bg-black/55 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-base text-neutral-950">
                {editingProd ? "Редактировать позицию" : "Новый товар или услуга"}
              </h2>
              <button
                type="button"
                onClick={() => setProdModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="prod-editor-form"
              onSubmit={handleSaveProduct}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setProdType("product")}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold transition ${
                    prodType === "product"
                      ? "bg-white text-neutral-950 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  Товар
                </button>
                <button
                  type="button"
                  onClick={() => setProdType("service")}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold transition ${
                    prodType === "service"
                      ? "bg-white text-neutral-950 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  Услуга
                </button>
              </div>

              {/* Main photo + gallery */}
              <div className="flex items-center gap-3.5">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {prodImageUrl ? (
                    <img
                      src={prodImageUrl}
                      alt="Фото"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-neutral-900 text-xs font-semibold cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadingProdImg
                          ? "Загружаем..."
                          : prodImageUrl
                          ? "Заменить фото"
                          : "Загрузить фото"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProdMainPhoto}
                        disabled={uploadingProdImg}
                        className="hidden"
                      />
                    </label>
                    {prodGallery.length < 4 && (
                      <label className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-blue-600 hover:bg-blue-50 cursor-pointer transition">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Доп. фото ({prodGallery.length}/4)</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProdGalleryPhoto}
                          disabled={uploadingProdImg}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  {prodGallery.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap pt-1">
                      {prodGallery.map((url, idx) => (
                        <div
                          key={url + idx}
                          className="relative w-11 h-11 rounded-lg overflow-hidden border border-slate-200"
                        >
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() =>
                              setProdGallery((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Name & Category */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Название
                  </label>
                  <input
                    type="text"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    placeholder="Например: Масло Liqui Moly 5W-40"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Категория из каталога
                  </label>
                  <input
                    type="text"
                    list="tiyin-cat-list"
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    placeholder="Например: Пицца или Шины"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                  <datalist id="tiyin-cat-list">
                    {mergedCategories.map((c) => (
                      <option key={c.name} value={c.name} />
                    ))}
                  </datalist>
                  {mergedCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {mergedCategories.map((c) => {
                        const active = prodCategory.trim() === c.name;
                        return (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => setProdCategory(c.name)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                              active
                                ? "bg-neutral-950 text-white"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Price, Old Price (Discount), Cashback */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Цена (₸)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    placeholder="15000"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Старая цена
                    {previewDiscountPct > 0 && (
                      <span className="ml-1 text-rose-600 font-bold">
                        -{previewDiscountPct}%
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={prodOldPrice}
                    onChange={(e) => setProdOldPrice(e.target.value)}
                    placeholder="Необяз."
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Кэшбэк (% Б)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={prodCashback}
                    onChange={(e) => setProdCashback(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              {prodType === "service" && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Длительность услуги
                  </label>
                  <input
                    type="text"
                    value={prodDuration}
                    onChange={(e) => setProdDuration(e.target.value)}
                    placeholder="Например: 45 мин или 1 час"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              )}

              {/* Badges selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600">
                  Бейджи на карточке
                </label>
                <div className="flex flex-wrap gap-2">
                  {BADGE_OPTIONS.map((b) => {
                    const active = prodBadges.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleBadge(b.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1 transition ${
                          active
                            ? b.activeClass
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {active && <Check className="w-3.5 h-3.5" />}
                        <span>{b.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Описание (необязательно)
                </label>
                <textarea
                  rows={2}
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  placeholder="Характеристики, объём, состав..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              {/* Availability toggle */}
              <button
                type="button"
                onClick={() => setProdAvailable((prev) => !prev)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition ${
                  prodAvailable
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-800"
                    : "bg-slate-100 border-slate-200 text-slate-600"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  {prodAvailable ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                  <span>
                    {prodAvailable
                      ? "В наличии (видно на витрине)"
                      : "Скрыто (клиенты не видят)"}
                  </span>
                </span>
                <span className="text-[11px] underline">Переключить</span>
              </button>
            </form>

            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0">
              {editingProd ? (
                <button
                  type="button"
                  onClick={() => handleDeleteProduct(editingProd.id)}
                  className="px-3.5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </button>
              ) : (
                <span />
              )}
              <button
                type="submit"
                form="prod-editor-form"
                disabled={savingProd || uploadingProdImg}
                className="px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition"
              >
                {savingProd ? "Сохраняем..." : editingProd ? "Сохранить" : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
