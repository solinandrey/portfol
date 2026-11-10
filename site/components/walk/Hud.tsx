"use client";

import { useEffect, useRef } from "react";
import { STAGES } from "@/lib/stages";
import { walkState } from "./state";
import styles from "./walk.module.css";

export function Hud({ active, ready }: { active: number; ready: boolean }) {
  const stage = STAGES[active];
  const bar = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const outro = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);

  // полоса прогресса и финальная надпись меняются каждый кадр — мимо React
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const last = STAGES.length - 1;
      bar.current?.style.setProperty("--p", String(walkState.stage / last));
      const end = Math.min(1, Math.max(0, (walkState.progress - 0.93) / 0.07));
      outro.current?.style.setProperty("opacity", String(end));
      card.current?.style.setProperty("opacity", String(1 - end));
      hint.current?.style.setProperty("opacity", String(walkState.progress < 0.015 ? 1 : 0));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className={styles.hud}>
      <header className={styles.top}>
        <span className={styles.name}>Andrey Solin</span>
        <span className={styles.what}>Product designer · ex-senior frontend</span>
        <a className={styles.mail} href="mailto:solinandrey@gmail.com">
          solinandrey@gmail.com
        </a>
      </header>

      <div className={styles.cardWrap} ref={card}>
        <section className={styles.card} key={stage.id} aria-live="polite">
          <div className={styles.years}>{stage.years}</div>
          <div className={styles.place}>{stage.place}</div>
          <div className={styles.role}>{stage.role}</div>
          <p className={styles.line}>{stage.line}</p>
          <div className={styles.stack}>{stage.stack}</div>
        </section>
      </div>

      <div className={styles.outro} ref={outro}>
        <p>Eight years, one direction: closer to the people who use the thing.</p>
        <div className={styles.links}>
          <a href="mailto:solinandrey@gmail.com">Email</a>
          <a href="https://t.me/soul_in" target="_blank" rel="noreferrer">Telegram</a>
          <a href="https://www.linkedin.com/in/andreysolin/" target="_blank" rel="noreferrer">LinkedIn</a>
        </div>
      </div>

      <div className={styles.hint} ref={hint}>
        {ready ? "Scroll to walk through eight years" : "Assembling particles…"}
      </div>

      <footer className={styles.timeline}>
        <div className={styles.bar} ref={bar} />
        <ol>
          {STAGES.map((s, i) => (
            <li key={s.id} className={i === active ? styles.on : undefined}>
              {s.years.replace(" — ", "–").replace(/ —$/, "+")}
            </li>
          ))}
        </ol>
      </footer>
    </div>
  );
}
