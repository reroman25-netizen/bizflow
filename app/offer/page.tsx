import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/LegalDocumentView";

export const metadata: Metadata = {
  title: "Оферта для бизнеса — TIYIN Space",
};

export default function Page() {
  return <LegalDocumentView docKey="offer" />;
}
