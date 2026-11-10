"use client";

import { useEffect, useState } from "react";

// Мелкие эффекты подписей: служебная строка собирается из случайных знаков, крупное слово
// поднимается по буквам. Оба ждут, пока панель проявится, и выключаются, если просили меньше движения.

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>—+";
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Строка проявляется слева направо, ещё не готовые знаки мелькают случайными. */
export function Scramble({ text, delay = 0.3, duration = 0.55 }: { text: string; delay?: number; duration?: number }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (reduced()) return setShown(text);
    let frame = 0;
    const start = performance.now() + delay * 1000;
    const tick = (now: number) => {
      const t = (now - start) / (duration * 1000);
      if (t >= 1) return setShown(text);
      setShown(
        [...text]
          .map((ch, i) => (ch === " " || t * 1.35 > i / text.length + 0.08 ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join(""),
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, delay, duration]);
  return (
    <>
      <span aria-hidden>{shown}</span>
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>{text}</span>
    </>
  );
}

/** Крупная строка: буквы по одной поднимаются из-под нижнего края, как буквы на барабане. Движение — в CSS.
 *  Слово — отдельная маска и не рвётся при переносе строки. */
export function Rise({ text, delay = 0.4, step = 0.035 }: { text: string; delay?: number; step?: number }) {
  let n = 0;
  return (
    <>
      <span data-rise aria-hidden>
        {text.split(" ").map((word, w) => (
          <span key={w}>
            {[...word].map((ch) => (
              <span key={n} style={{ animationDelay: `${delay + n++ * step}s` }}>
                {ch}
              </span>
            ))}
          </span>
        ))}
      </span>
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>{text}</span>
    </>
  );
}
