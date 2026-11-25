import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/LegalDocumentView";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — TIYIN Space",
};

export default function Page() {
  return <LegalDocumentView docKey="privacy" />;
}
