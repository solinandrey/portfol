"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { CHAPTERS, CONTACTS, INTRO, THESIS, WORK, type Chapter } from "@/lib/story";
import styles from "./story.module.css";

// История как одна линия: слева дизайн, справа код. Скролл двигает линию от 2018-го к сегодня,
// дизайна становится больше. Линию можно потянуть руками и посмотреть код любого этапа.

/** доля шага, которую линия стоит на этапе; остальное время она едет к следующему */
const HOLD = 0.62;
const NARROW = "(max-width: 760px)";

const STATIONS = [{ split: INTRO.split, splitNarrow: INTRO.splitNarrow }, ...CHAPTERS];

const fill = (code: string, chapter: Chapter) =>
  code.replaceAll("{{place}}", chapter.place).replaceAll("{{role}}", chapter.role);

/** Позиция линии и текущий этап по прогрессу прокрутки. */
function locate(progress: number, narrow: boolean) {
  const last = STATIONS.length - 1;
  const units = progress * (last + HOLD);
  const i = Math.min(Math.floor(units), last);
  const frac = units - i;
  const at = (k: number) => (narrow ? STATIONS[k].splitNarrow : STATIONS[k].split);
  if (i === last) return { split: at(last), active: last };
  const gap = at(i + 1) - at(i);
  if (frac < HOLD) return { split: at(i) + gap * 0.05 * (frac / HOLD), active: i };
  const t = (frac - HOLD) / (1 - HOLD);
  const eased = t * t * (3 - 2 * t);
  return { split: at(i) + gap * (0.05 + 0.95 * eased), active: t < 0.5 ? i : i + 1 };
}

/** Код с подсветкой: истории ярко, комментарии тускло, остальное между ними. */
function Code({ source, base = 1 }: { source: string; base?: number }) {
  return (
    <pre className={styles.pre}>
      {source.split("\n").map((row, n) => {
        const comment = /^\s*(\/\/|<!--)/.test(row);
        return (
          <span key={n} className={styles.row}>
            <span className={styles.num}>{n + base}</span>
            <span className={comment ? styles.comment : undefined}>
              {row.split(/(⟦[^⟧]*⟧)/).map((part, k) =>
                part.startsWith("⟦") ? (
                  <b key={k} className={styles.bright}>
                    {part.slice(1, -1)}
                  </b>
                ) : (
                  part
                ),
              )}
            </span>
          </span>
        );
      })}
    </pre>
  );
}

function ChapterDesign({ chapter, on }: { chapter: Chapter; on: boolean }) {
  const style = { "--w": `${chapter.split}%`, "--wn": `${chapter.splitNarrow}%`, "--stretch": `${chapter.stretch}%`, "--fit": chapter.fit } as CSSProperties;
  return (
    <article className={styles.chapter} data-on={on || undefined} data-plain={!chapter.media || undefined} style={style} aria-hidden={!on}>
      <div className={styles.inner}>
        {chapter.kicker && <p className={styles.kicker}>{chapter.kicker}</p>}
        <p className={styles.years}>{chapter.years}</p>
        <h2 className={styles.place} data-lower={chapter.lowercase || undefined}>
          {chapter.place}
        </h2>
        <div className={styles.columns}>
          <div className={styles.text}>
            <p className={styles.role}>{chapter.role}</p>
            <p className={styles.line}>{chapter.line}</p>
          </div>
          {chapter.media && (
            <figure className={styles.media} style={{ aspectRatio: chapter.media.ratio }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={chapter.media.src} alt={chapter.media.alt} />
            </figure>
          )}
        </div>
      </div>
    </article>
  );
}

export function Story() {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const state = useRef({ current: INTRO.split, override: null as number | null, dragging: false, narrow: false });

  useEffect(() => {
    const el = root.current!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const narrowQuery = window.matchMedia(NARROW);
    const lenis = reduce ? null : new Lenis({ autoRaf: true, lerp: 0.1 });

    const s = state.current;
    s.narrow = narrowQuery.matches;
    s.current = s.narrow ? INTRO.splitNarrow : INTRO.split;

    let frame = 0;
    let lastY = window.scrollY;
    let lastActive = 0;
    const tick = () => {
      const box = track.current!;
      const range = box.offsetHeight - window.innerHeight;
      const y = window.scrollY;
      const progress = range > 0 ? Math.min(1, Math.max(0, y / range)) : 0;
      // прокрутили — линия отпускается и возвращается на место этапа
      if (!s.dragging && Math.abs(y - lastY) > 2) s.override = null;
      lastY = y;
      const { split, active: now } = locate(progress, s.narrow);
      const target = s.override ?? split;
      s.current = reduce ? target : s.current + (target - s.current) * 0.16;
      el.style.setProperty("--split", `${s.current.toFixed(3)}%`);
      if (now !== lastActive) {
        lastActive = now;
        setActive(now);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const onNarrow = (e: MediaQueryListEvent) => (s.narrow = e.matches);
    narrowQuery.addEventListener("change", onNarrow);
    return () => {
      cancelAnimationFrame(frame);
      lenis?.destroy();
      narrowQuery.removeEventListener("change", onNarrow);
    };
  }, []);

  const moveLine = (e: ReactPointerEvent) => {
    const s = state.current;
    const value = s.narrow ? (e.clientY / window.innerHeight) * 100 : (e.clientX / window.innerWidth) * 100;
    s.override = Math.min(97, Math.max(3, value));
  };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    state.current.dragging = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    moveLine(e);
  };
  const onMove = (e: ReactPointerEvent) => {
    if (state.current.dragging) moveLine(e);
  };
  const onUp = () => {
    state.current.dragging = false;
  };
  const onKey = (e: ReactKeyboardEvent) => {
    const s = state.current;
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 3 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -3 : 0;
    if (!step) return;
    e.preventDefault();
    s.override = Math.min(97, Math.max(3, (s.override ?? s.current) + step));
  };

  const station = active - 1;
  const chapter = station >= 0 ? CHAPTERS[station] : null;
  const taken = CHAPTERS.filter((c) => c.took);

  return (
    <div ref={root} className={styles.story} style={{ "--split": `${INTRO.split}%` } as CSSProperties}>
      <div ref={track} className={styles.track} style={{ "--stations": STATIONS.length } as CSSProperties}>
        <div className={styles.stage}>
          {/* код лежит снизу и всегда начинается сразу за линией */}
          <div className={styles.codeLayer} aria-hidden>
            <div className={styles.codeBlock} data-on={active === 0 || undefined}>
              <Code source={INTRO.code} />
            </div>
            {CHAPTERS.map((c, i) => (
              <div key={c.id} className={styles.codeBlock} data-on={active === i + 1 || undefined}>
                <Code source={fill(c.code, c)} />
              </div>
            ))}
          </div>

          {/* дизайн лежит сверху и обрезается линией */}
          <div className={styles.designLayer}>
            <section className={styles.intro} data-on={active === 0 || undefined} aria-hidden={active !== 0}>
              <h1 className={styles.name}>{INTRO.name}</h1>
              <div className={styles.introRow}>
                <p className={styles.introRole}>{INTRO.role}</p>
                <p className={styles.introLine}>{INTRO.line}</p>
              </div>
            </section>
            {CHAPTERS.map((c, i) => (
              <ChapterDesign key={c.id} chapter={c} on={active === i + 1} />
            ))}
          </div>

          {/* подписи поверх обеих сторон: инвертируются на линии */}
          <header className={styles.top}>
            <span>Andrey Solin</span>
            <nav className={styles.topLinks}>
              {CONTACTS.map((c) => (
                <a key={c.label} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                  {c.label}
                </a>
              ))}
            </nav>
          </header>
          <ul className={styles.ledger} aria-label="What stayed from each stage">
            {taken.map((c) => (
              <li key={c.id} data-lit={CHAPTERS.indexOf(c) <= station || undefined}>
                {c.took}
              </li>
            ))}
          </ul>
          <p className={styles.hint} data-on={active === 0 || undefined}>
            Scroll, the line moves. Or drag it.
          </p>

          {/* линия */}
          <div
            className={styles.divider}
            role="slider"
            tabIndex={0}
            aria-label="Move the line between design and code"
            aria-orientation="horizontal"
            aria-valuemin={3}
            aria-valuemax={97}
            aria-valuenow={Math.round(chapter?.split ?? INTRO.split)}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onKeyDown={onKey}
          >
            <span className={styles.tag}>
              <span aria-hidden>‹</span>
              {chapter?.years ?? "Today"}
              <span aria-hidden>›</span>
            </span>
          </div>
        </div>
      </div>

      <section className={styles.after}>
        <p className={styles.thesis}>{THESIS}</p>
        <h2 className={styles.afterTitle}>Selected work</h2>
        <ul className={styles.work}>
          {WORK.map((w) => {
            const row = (
              <>
                <span className={styles.workYear}>{w.year}</span>
                <span className={styles.workName}>{w.name}</span>
                <span className={styles.workWhat}>{w.what}</span>
              </>
            );
            return (
              <li key={w.name}>
                {w.href ? (
                  <a className={styles.workRow} href={w.href} target="_blank" rel="noreferrer">
                    {row}
                  </a>
                ) : (
                  <div className={styles.workRow}>{row}</div>
                )}
              </li>
            );
          })}
        </ul>
        <div className={styles.contact}>
          <a className={styles.mail} href="mailto:solinandrey@gmail.com">
            solinandrey@gmail.com
          </a>
          <p className={styles.contactLine}>Remote, usually moving between time zones. Open to product design roles and contracts.</p>
          <div className={styles.contactLinks}>
            {CONTACTS.filter((c) => c.label !== "Email").map((c) => (
              <a key={c.label} href={c.href} target="_blank" rel="noreferrer">
                {c.label}
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
