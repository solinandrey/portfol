"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { CHAPTERS, CONTACTS, EMAIL, THESIS, type Project } from "@/lib/story";
import { CaseSheet } from "./CaseSheet";
import type { Shared } from "./Cloud";
import { Scene } from "./Scene";
import { Rise, Scramble } from "./Effects";
import styles from "./dots.module.css";

// Сайт — путь из остановок. Скролл листает по одной: пока порог не пройден, остановка лишь
// подаётся за скроллом и возвращается на место, а после перехода инерция трекпада не уводит дальше.
// Стрелки, кнопка «дальше», подписи и бегунок внизу ведут туда же.

const STOPS = CHAPTERS.length + 2;
const LAST = STOPS - 1;
const VH_PER_STOP = 120;
/** сколько прокрутить колёсиком или трекпадом, чтобы уйти с остановки; пальцем — меньше */
const PULL_PX = 120;
const PULL_TOUCH_PX = 60;
/** насколько остановка подаётся вслед за скроллом, пока порог не пройден, в долях остановки */
const PULL_MAX = 0.12;

const short = (years: string) => years.replace(" — ", "–").replace(/(\d{4})–(\d{2})(\d{2})/, "$1–$3").replace(" —", "");
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const limit = () => document.documentElement.scrollHeight - window.innerHeight;
const yOf = (station: number) => (station / LAST) * limit();
const stationNow = () => (limit() > 0 ? (window.scrollY / limit()) * LAST : 0);

export function DotsStory() {
  const shared = useRef<Shared>({
    station: 0,
    pointer: new THREE.Vector2(),
    inside: false,
    grabbing: false,
    twist: 0,
    twistVel: 0,
    turning: false,
    model: { x: 0, y: 0, rx: 0, ry: 0 },
    pulse: { x: 0, y: 0, n: 0 },
    title: { x0: 0, y0: 0, x1: 0, y1: 0 },
    tip: null,
  });
  const lenisRef = useRef<Lenis | null>(null);
  const readyRef = useRef(false);
  const bar = useRef<HTMLDivElement>(null);
  /** moving — едем к остановке; held — переход уже был в этом жесте; pull — накопленный скролл */
  const nav = useRef({ moving: false, held: false, pull: 0, from: 0, quiet: 0, guard: 0, scrub: false, touchY: null as number | null });
  const [stop, setStop] = useState(0);
  const [ready, setReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  /** открытый разбор проекта: пока он открыт, сцена не листается */
  const [opened, setOpened] = useState<Project | null>(null);
  const caseOpen = useRef(false);
  const closeCase = useCallback(() => setOpened(null), []);
  const onReady = useCallback(() => setReady(true), []);

  /** середины подписей остановок от левого края линии, в пикселях: бегунок встаёт ровно над серединой текста */
  const marks = useRef<number[]>([]);
  const place = useCallback((station: number) => {
    const m = marks.current;
    if (m.length < 2) return;
    const i = clamp(Math.floor(station), 0, m.length - 2);
    bar.current?.style.setProperty("--x", `${(m[i] + (m[i + 1] - m[i]) * (station - i)).toFixed(2)}px`);
  }, []);

  const goTo = useCallback((target: number, duration = 1.5) => {
    const y = yOf(clamp(target, 0, LAST));
    const n = nav.current;
    if (!lenisRef.current) return window.scrollTo(0, y);
    n.moving = true;
    // страховка: если анимацию что-то оборвёт, листание не должно застрять навсегда
    window.clearTimeout(n.guard);
    n.guard = window.setTimeout(() => (n.moving = false), duration * 1000 + 300);
    lenisRef.current.scrollTo(y, { duration, force: true, onComplete: () => (n.moving = false) });
  }, []);
  /** сразу, без анимации: подача за скроллом и бегунок */
  const jump = useCallback((station: number) => {
    const y = yOf(clamp(station, 0, LAST));
    if (lenisRef.current) lenisRef.current.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }, []);

  useEffect(() => {
    // в разработке сцена видна снаружи: по ней проверяется раскладка на разных экранах
    if (process.env.NODE_ENV !== "production") (window as unknown as { __dots: Shared }).__dots = shared.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // колесо и палец листаем сами, Lenis только плавно доводит до остановки. Иначе каждое
    // событие инерции трекпада останавливает его анимацию и страница застревает между главами
    const lenis = reduce ? null : new Lenis({ autoRaf: true, smoothWheel: false, virtualScroll: () => false });
    lenisRef.current = lenis;
    // пока идёт вход, страница не крутится
    if (!readyRef.current) lenis?.stop();
    const n = nav.current;

    // остановились между остановками (например, тащили полосу прокрутки) — доезжаем до ближайшей
    let snap = 0;
    const settle = () => {
      if (n.moving || n.scrub || n.pull !== 0) return;
      const now = stationNow();
      if (Math.abs(now - Math.round(now)) > 0.004) goTo(Math.round(now), 0.9);
    };
    const onScroll = () => {
      const now = stationNow();
      shared.current.station = now;
      place(now);
      if (now > 0.02) setScrolled(true);
      window.clearTimeout(snap);
      snap = window.setTimeout(settle, 200);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // подписи разной ширины и на каждом экране свои: середины меряем заново при любой смене раскладки
    const rail = bar.current?.parentElement;
    const measure = () => {
      if (!bar.current || !rail) return;
      const left = bar.current.getBoundingClientRect().left;
      marks.current = [...rail.querySelectorAll("[data-mark]")].map((el) => {
        const r = el.getBoundingClientRect();
        return r.left + r.width / 2 - left;
      });
      place(stationNow());
    };
    const watch = new ResizeObserver(measure);
    if (rail) watch.observe(rail);
    measure();
    document.fonts?.ready.then(measure);

    const step = (dir: number) => {
      const next = n.from + dir;
      n.pull = 0;
      n.held = true;
      goTo(next < 0 || next > LAST ? n.from : next, next < 0 || next > LAST ? 0.5 : 1.2);
    };
    // жест кончился, порог не пройден — остановка возвращается на место
    const release = () => {
      n.held = false;
      if (n.pull !== 0 && !n.moving) goTo(n.from, 0.5);
      n.pull = 0;
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      // разбор открыт: внутри листа скролл обычный, мимо листа ничего не происходит
      if (caseOpen.current) {
        if (!(e.target as HTMLElement).closest?.("[data-case-scroll]")) e.preventDefault();
        return;
      }
      e.preventDefault();
      if (!readyRef.current || n.scrub || shared.current.grabbing) return;
      window.clearTimeout(n.quiet);
      n.quiet = window.setTimeout(release, 220);
      if (n.moving || n.held) return;
      if (n.pull === 0) n.from = Math.round(stationNow());
      n.pull += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      if (Math.abs(n.pull) >= PULL_PX) step(Math.sign(n.pull));
      else jump(n.from + (n.pull / PULL_PX) * PULL_MAX);
    };
    window.addEventListener("wheel", onWheel, { passive: false });

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || n.moving || caseOpen.current) return;
      n.touchY = e.touches[0].clientY;
      n.from = Math.round(stationNow());
      n.held = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (caseOpen.current) {
        if (!(e.target as HTMLElement).closest?.("[data-case-scroll]")) e.preventDefault();
        return;
      }
      e.preventDefault();
      if (!readyRef.current || n.touchY === null || n.held || n.moving || shared.current.grabbing) return;
      const pull = n.touchY - e.touches[0].clientY;
      n.pull = pull;
      if (Math.abs(pull) >= PULL_TOUCH_PX) step(Math.sign(pull));
      else jump(n.from + (pull / PULL_TOUCH_PX) * PULL_MAX);
    };
    const onTouchEnd = () => {
      n.touchY = null;
      release();
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);

    // предмет можно взять мышкой и покрутить; над ним курсор — рука
    const sh = shared.current;
    const overModel = (e: PointerEvent) => ((e.clientX - sh.model.x) / sh.model.rx) ** 2 + ((e.clientY - sh.model.y) / sh.model.ry) ** 2 < 1;
    let turn: { x: number; t: number } | null = null;
    let press: { x: number; y: number; t: number } | null = null;
    let handCursor = false;
    const onMove = (e: PointerEvent) => {
      sh.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      sh.inside = e.pointerType === "mouse";
      if (turn) {
        const now = performance.now();
        const dx = (e.clientX - turn.x) * 0.009;
        sh.twist += dx;
        sh.twistVel = dx / Math.max(0.008, (now - turn.t) / 1000);
        turn = { x: e.clientX, t: now };
        return;
      }
      // рука над предметом, если курсором не занят чип или буква
      const want = readyRef.current && e.pointerType === "mouse" && !sh.grabbing && overModel(e) && (e.target as HTMLElement).tagName === "CANVAS";
      if (want && document.body.style.cursor === "") {
        document.body.style.cursor = "grab";
        handCursor = true;
      } else if (!want && handCursor && document.body.style.cursor === "grab") {
        document.body.style.cursor = "";
        handCursor = false;
      }
    };
    const onTurnStart = (e: PointerEvent) => {
      // чипы и буквы ловят нажатие раньше: если взяли их, предмет не крутим
      if (!readyRef.current || e.button !== 0 || sh.grabbing || !overModel(e) || (e.target as HTMLElement).tagName !== "CANVAS") return;
      turn = { x: e.clientX, t: performance.now() };
      press = { x: e.clientX, y: e.clientY, t: turn.t };
      sh.turning = true;
      sh.twistVel = 0;
      document.body.style.cursor = "grabbing";
      handCursor = true;
    };
    const onTurnEnd = (e: PointerEvent) => {
      if (!turn) return;
      // нажали и отпустили на месте — это клик: от него по точкам расходится волна
      if (press && e.type === "pointerup" && performance.now() - press.t < 350 && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6) {
        sh.pulse.x = (e.clientX / window.innerWidth) * 2 - 1;
        sh.pulse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        sh.pulse.n++;
      }
      press = null;
      // давно не двигали — отпускаем без броска
      if (performance.now() - turn.t > 80) sh.twistVel = 0;
      turn = null;
      sh.turning = false;
      document.body.style.cursor = "grab";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onTurnStart);
    window.addEventListener("pointerup", onTurnEnd);
    window.addEventListener("pointercancel", onTurnEnd);
    // курсор ушёл с окна — голова снова смотрит прямо
    const onLeave = () => (shared.current.inside = false);
    document.documentElement.addEventListener("mouseleave", onLeave);

    const onKey = (e: KeyboardEvent) => {
      const next = ["ArrowDown", "ArrowRight", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey);
      const prev = ["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey);
      if (!next && !prev) return;
      if (caseOpen.current) return;
      if (!readyRef.current) return e.preventDefault();
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (e.key === " " && (tag === "BUTTON" || tag === "A")) return;
      e.preventDefault();
      if (!n.moving) goTo(Math.round(stationNow()) + (next ? 1 : -1));
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(snap);
      window.clearTimeout(n.quiet);
      window.clearTimeout(n.guard);
      window.removeEventListener("scroll", onScroll);
      watch.disconnect();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onTurnStart);
      window.removeEventListener("pointerup", onTurnEnd);
      window.removeEventListener("pointercancel", onTurnEnd);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("keydown", onKey);
      lenis?.destroy();
      lenisRef.current = null;
    };
  }, [goTo, jump]);

  useEffect(() => {
    readyRef.current = ready;
    if (ready) lenisRef.current?.start();
  }, [ready]);

  // бегунок: тянешь — предметы перетекают вслед, отпустил — доезжает до ближайшей остановки
  const scrubTo = (clientX: number) => {
    const x = clientX - bar.current!.getBoundingClientRect().left;
    // обратный счёт к бегунку: между какими серединами подписей оказался палец
    const m = marks.current;
    let i = 0;
    while (i < m.length - 2 && x > m[i + 1]) i++;
    jump(m.length < 2 ? 0 : clamp(i + (x - m[i]) / (m[i + 1] - m[i]), 0, LAST));
  };
  const scrub = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!ready) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      nav.current.scrub = true;
      setScrubbing(true);
      scrubTo(e.clientX);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (nav.current.scrub) scrubTo(e.clientX);
    },
    onPointerUp: () => {
      if (!nav.current.scrub) return;
      nav.current.scrub = false;
      setScrubbing(false);
      goTo(Math.round(stationNow()), 0.6);
    },
  };

  // превью проекта у курсора: картинка вне слоя с инверсией, едет за курсором с запаздыванием
  const previewRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const target = { x: 0, y: 0 }, at = { x: 0, y: 0, placed: false };
    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!at.placed) {
        at.x = target.x;
        at.y = target.y;
        at.placed = true;
      }
    };
    let frame = 0;
    const tick = () => {
      at.x += (target.x - at.x) * 0.16;
      at.y += (target.y - at.y) * 0.16;
      el.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`;
      frame = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove);
    frame = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
  const peek = (image?: string) =>
    image
      ? {
          onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && setPreview(image),
          onPointerLeave: () => setPreview(null),
        }
      : {};
  useEffect(() => {
    setPreview(null);
    setOpened(null);
  }, [stop]);
  // разбор открыт — страница стоит: Lenis на паузе, превью у курсора убрано
  useEffect(() => {
    caseOpen.current = opened !== null;
    if (opened) setPreview(null);
    if (!readyRef.current) return;
    if (opened) lenisRef.current?.stop();
    else lenisRef.current?.start();
  }, [opened]);

  const chapter = stop >= 1 && stop <= CHAPTERS.length ? CHAPTERS[stop - 1] : null;
  const upcoming = stop < CHAPTERS.length ? CHAPTERS[stop] : null;

  return (
    <div className={styles.dots} style={{ height: `calc(100svh + ${LAST * VH_PER_STOP}vh)` }}>
      <div className={styles.canvas}>
        <Canvas dpr={[1, 2]} camera={{ fov: 30, near: 0.1, far: 20, position: [0, 0, 2.5] }} gl={{ antialias: false, powerPreference: "high-performance" }}>
          <Scene shared={shared} onStation={setStop} onReady={onReady} />
        </Canvas>
      </div>

      {/* всё поверх холста инвертируется само: белое с difference */}
      <div className={styles.preview} ref={previewRef} aria-hidden>
        <div className={styles.previewCard} data-on={preview ? true : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview && <img src={preview} alt="" />}
        </div>
      </div>

      <CaseSheet
        project={opened}
        list={chapter?.links?.filter((l) => l.more) ?? []}
        tone={stop % 2 === 0 ? "paper" : "ink"}
        onPick={setOpened}
        onClose={closeCase}
      />

      <div className={styles.hud} data-ready={ready || undefined}>
        <header className={styles.top}>
          <button type="button" className={styles.home} onClick={() => goTo(0)}>
            Andrey Solin
          </button>
          <nav className={styles.contacts}>
            {CONTACTS.map((c) => (
              <a key={c.label} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                {c.label}
              </a>
            ))}
          </nav>
        </header>

        {/* название этапа стоит на барабане объёмными буквами, здесь оно только для чтения вслух */}
        <section className={styles.panel} key={stop} aria-live="polite">
          {stop === 0 && (
            <div className={styles.left} data-clear>
              <h1 className={styles.sr}>Andrey Solin</h1>
              <p className={styles.lead}>Product designer, <span className={styles.keep}>ex-frontend developer.</span></p>
              <p className={styles.note}>
                I wrote frontend for about eight years before moving to design. Below are the places I worked, in order, from 2017 to now.
              </p>
              {/* что делать дальше — там же, где читают: кнопка и подсказка про скролл */}
              <div className={styles.begin}>
                <button type="button" className={styles.start} onClick={() => goTo(1)} disabled={!ready}>
                  Start at 2017 <span aria-hidden>↓</span>
                </button>
                <span className={styles.beginHint} aria-hidden>
                  <span className={styles.cueMouse}>or scroll down</span>
                  <span className={styles.cueTouch}>or swipe up</span>
                </span>
              </div>
            </div>
          )}
          {chapter && (
            <>
              <div className={styles.left} data-clear>
                <h2 className={styles.sr}>{chapter.place}</h2>
                {/* годы крупно, тем же шрифтом, что название на барабане; открытый конец — «по сей день» */}
                <p className={styles.years}>
                  <Rise text={chapter.years.replace(/ —$/, " — now")} delay={0.3} />
                </p>
                <p className={styles.role}>
                  <Scramble text={chapter.role} delay={0.38} />
                </p>
                <p className={styles.about}>{chapter.about}</p>
                {/* слева — контекст: что за компания и что там было моим; справа — факты */}
                <p className={styles.work}>{chapter.line}</p>
                {chapter.team && (
                  <p className={styles.team}>
                    <Scramble text={chapter.team} delay={0.5} />
                  </p>
                )}
              </div>
              <div className={styles.right} data-clear>
                {chapter.did && (
                  <>
                    <p className={styles.label}>
                      <Scramble text="What I did" delay={0.42} />
                    </p>
                    <ul className={styles.did}>
                      {chapter.did.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className={styles.sr}>Stack: {chapter.stack.join(", ")}</p>
                {chapter.links && (
                  <>
                    <p className={styles.label}>
                      <Scramble text={chapter.links.length > 1 ? "Projects" : "Project"} delay={0.5} />
                    </p>
                    <ul className={styles.projects}>
                      {chapter.links.map((l) => (
                        <li key={l.label}>
                          {l.more ? (
                            <button type="button" className={styles.projectOpen} onClick={() => setOpened(l)} aria-haspopup="dialog" {...peek(l.image)}>
                              {l.label}
                              <span className={styles.projectTag}>case</span>
                            </button>
                          ) : l.href ? (
                            <a href={l.href} target="_blank" rel="noreferrer" {...peek(l.image)}>
                              {l.label}
                              <span className={styles.projectTag} aria-hidden>
                                ↗
                              </span>
                            </a>
                          ) : (
                            l.label
                          )}
                          {l.note && <span className={styles.projectNote}> — {l.note}</span>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </>
          )}
          {/* на последней остановке текста нет: почта стоит на барабане объёмными буквами, вокруг летают контакты.
              Для чтения вслух и для поиска она остаётся здесь обычной ссылкой */}
          {stop === LAST && (
            <p className={styles.sr}>
              {THESIS} <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            </p>
          )}
        </section>

        {/* куда идти дальше сказано словами, а не только стрелкой */}
        <div className={styles.next}>
          {stop === 0 ? null : upcoming ? (
            <button type="button" className={styles.nextButton} onClick={() => goTo(stop + 1)}>
              Next: {upcoming.place} <span aria-hidden>↓</span>
            </button>
          ) : stop < LAST ? (
            <button type="button" className={styles.nextButton} onClick={() => goTo(LAST)}>
              Next: get in touch <span aria-hidden>↓</span>
            </button>
          ) : (
            <button type="button" className={styles.nextButton} onClick={() => goTo(0)}>
              Back to start <span aria-hidden>↑</span>
            </button>
          )}

        </div>

        {/* на первом экране явно: листается скроллом */}
        {ready && stop === 0 && !scrolled && (
          <div className={styles.cue} aria-hidden>
            <span className={styles.mouse} />
            <span className={styles.cueMouse}>Scroll down</span>
            <span className={styles.cueTouch}>Swipe up</span>
          </div>
        )}

        {/* подсказка у почты на барабане: «скопировано». Где ей стоять, решает сцена */}
        <div className={styles.tip} style={{ opacity: 0 }} role="status" aria-live="polite" ref={(el) => void (shared.current.tip = el)} />

        {/* все остановки видны сразу: понятно, сколько их и где я сейчас. Бегунок можно тащить */}
        <nav className={styles.rail} aria-label="Career stops">
          <div
            className={styles.track}
            ref={bar}
            data-drag={scrubbing || undefined}
            role="slider"
            aria-label="Timeline"
            aria-valuemin={0}
            aria-valuemax={LAST}
            aria-valuenow={stop}
            {...scrub}
            onPointerCancel={scrub.onPointerUp}
          >
            <span className={styles.knob} />
          </div>
          <ol>
            <li>
              <button type="button" className={styles.stop} data-on={stop === 0 || undefined} onClick={() => goTo(0)}>
                <span className={styles.stopLabel} data-mark>
                  <span className={styles.stopYear}>Hi</span>
                  <span className={styles.stopName}>Intro</span>
                </span>
              </button>
            </li>
            {CHAPTERS.map((c, i) => (
              <li key={c.id}>
                <button type="button" className={styles.stop} data-on={stop === i + 1 || undefined} aria-current={stop === i + 1 ? "step" : undefined} onClick={() => goTo(i + 1)}>
                  <span className={styles.stopLabel} data-mark>
                    <span className={styles.stopYear}>{short(c.years)}</span>
                    <span className={styles.stopName}>{c.place}</span>
                  </span>
                </button>
              </li>
            ))}
            <li>
              <button type="button" className={styles.stop} data-on={stop === LAST || undefined} onClick={() => goTo(LAST)}>
                <span className={styles.stopLabel} data-mark>
                  <span className={styles.stopYear}>Now</span>
                  <span className={styles.stopName}>Contact</span>
                </span>
              </button>
            </li>
          </ol>
        </nav>
      </div>
    </div>
  );
}
