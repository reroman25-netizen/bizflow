import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/LegalDocumentView";

export const metadata: Metadata = {
  title: "Пользовательское соглашение — TIYIN Space",
};

export default function Page() {
  return <LegalDocumentView docKey="terms" />;
}
