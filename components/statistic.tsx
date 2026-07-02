"use client";

import { useEffect, useRef, useState } from "react";

type StatisticProps = {
  value: string;
  label: string;
};

function formatValue(value: string, progress: number) {
  const range = value.match(/^(\d+(?:\.\d+)?)\s*->\s*(\d+(?:\.\d+)?)(.*)$/);

  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    return `${Math.round(start * progress)} -> ${Math.round(end * progress)}${range[3]}`;
  }

  const single = value.match(/^(\d+(?:\.\d+)?)(.*)$/);

  if (!single) {
    return value;
  }

  const target = Number(single[1]);
  const suffix = single[2];
  const current = target * progress;
  const hasDecimal = single[1].includes(".");

  return `${hasDecimal ? current.toFixed(1) : Math.round(current)}${suffix}`;
}

export function Statistic({ value, label }: StatisticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return;
        }

        const startedAt = performance.now();
        const duration = 900;

        function tick(now: number) {
          const elapsed = Math.min((now - startedAt) / duration, 1);
          const eased = 1 - Math.pow(1 - elapsed, 3);
          setProgress(eased);

          if (elapsed < 1) {
            requestAnimationFrame(tick);
          }
        }

        requestAnimationFrame(tick);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="border-l border-line pl-6">
      <p className="font-heading text-4xl font-semibold text-navy sm:text-5xl">
        {formatValue(value, progress)}
      </p>
      <p className="mt-3 text-sm leading-6 text-body">{label}</p>
    </div>
  );
}
