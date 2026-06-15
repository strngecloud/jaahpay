"use client";

import { cn } from "@/lib/utils";
import { getBankInitials } from "@/lib/spend/constants";

const BANK_COLORS = [
  "from-brand-blue to-brand-green",
  "from-red-500 to-orange-500",
  "from-purple-500 to-pink-500",
  "from-cyan-500 to-blue-500",
  "from-amber-500 to-yellow-500",
];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BANK_COLORS[Math.abs(hash) % BANK_COLORS.length];
}

export function BankAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const sz = size === "sm" ? "w-8 h-8 text-[10px]" : "w-10 h-10 text-xs";

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-bold text-white shrink-0 bg-gradient-to-br",
        hashColor(name),
        sz,
        className,
      )}
    >
      {getBankInitials(name)}
    </div>
  );
}
