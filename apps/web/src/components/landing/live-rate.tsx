"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Indicative rate that drifts gently around a base value.
 * Derived from wall-clock time so duplicated tape copies stay in sync.
 */
export function LiveRate({
  base,
  decimals = 2,
  prefix = "",
}: {
  base: number;
  decimals?: number;
  prefix?: string;
}) {
  const [value, setValue] = useState(base);
  const [dir, setDir] = useState<-1 | 0 | 1>(0);
  const prev = useRef(base);

  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      const next =
        base *
        (1 + 0.0022 * Math.sin(t / 9000) + 0.0011 * Math.sin(t / 2700));
      setDir(next > prev.current ? 1 : next < prev.current ? -1 : 0);
      prev.current = next;
      setValue(next);
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [base]);

  return (
    <span
      className={`tabular-nums transition-colors duration-500 ${
        dir > 0 ? "text-mint" : dir < 0 ? "text-gold" : "text-white/80"
      }`}
    >
      {prefix}
      {value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
}
