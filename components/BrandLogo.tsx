import React from "react";

interface BrandLogoProps {
  inverted?: boolean;
  size?: "sm" | "md";
}

export function BrandLogo({ inverted = false, size = "md" }: BrandLogoProps) {
  const boxSize = size === "sm" ? "w-7 h-7 text-[11px]" : "w-9 h-9 text-xs";
  const textSize = size === "sm" ? "text-base" : "text-lg";

  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <span
        className={`${boxSize} rounded-xl flex items-center justify-center font-extrabold tracking-tight shadow-sm ${
          inverted
            ? "bg-white text-neutral-950"
            : "bg-neutral-950 text-white"
        }`}
      >
        T.S
      </span>
      <span className={`inline-flex items-baseline gap-1.5 ${textSize} tracking-tight`}>
        <span className={`font-extrabold ${inverted ? "text-white" : "text-neutral-950"}`}>
          TIYIN
        </span>
        <span
          className={`font-medium ${
            inverted ? "text-neutral-400" : "text-neutral-500"
          }`}
        >
          Space
        </span>
      </span>
    </span>
  );
}
