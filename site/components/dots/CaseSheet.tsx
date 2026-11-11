"use client";

import { track } from "@/lib/analytics";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/story";
import { Rise } from "./Effects";
import styles from "./dots.module.css";

// Разбор проекта: лист выезжает справа поверх сцены. Сверху запись экрана или скриншот,
// ниже история в несколько абзацев и стек. Закрывается крестиком, Esc и кликом мимо листа.

type Props = {
  /** открытый проект или null */
  project: Project | null;
  /** проекты той же главы с разбором: по ним можно листать, не закрывая лист */
  list: Project[];
  /** цвет листа противоположен фону сцены */
  tone: "paper" | "ink";
  onPick: (project: Project) => void;
  onClose: () => void;
};

export function CaseSheet({ project, list, tone, onPick, onClose }: Props) {
  // последний открытый проект остаётся в листе, пока тот уезжает
  const [shown, setShown] = useState<Project | null>(project);
  if (project && project !== shown) setShown(project);
  const [playing, setPlaying] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const open = project !== null;

  // видео грузится только по кнопке и выгружается, когда лист закрыт или открыт другой проект
  useEffect(() => {
    setPlaying(false);
    scroller.current?.scrollTo(0, 0);
  }, [project]);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    close.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener.current?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  const more = shown?.more;
  const at = shown ? list.indexOf(shown) : -1;
  const next = list.length > 1 && at >= 0 ? list[(at + 1) % list.length] : null;
  const onVimeo = shown?.href?.includes("vimeo.com");

  return (
    <div className={styles.case} data-open={open || undefined} data-tone={tone} inert={!open}>
      <button type="button" className={styles.caseShade} onClick={onClose} aria-label="Close the case" tabIndex={-1} />
      <div className={styles.caseSheet} role="dialog" aria-modal="true" aria-label={shown ? `${shown.label}: case` : undefined}>
        <div className={styles.caseBar}>
          <span>
            Case{at >= 0 && list.length > 1 ? ` ${at + 1} / ${list.length}` : ""}
            {more ? ` · ${more.year}` : ""}
          </span>
          <button type="button" ref={close} onClick={onClose}>
            Close <span aria-hidden>✕</span>
          </button>
        </div>
        {/* key: при смене проекта содержимое появляется заново, со своей анимацией */}
        <div className={styles.caseScroll} ref={scroller} data-case-scroll key={shown?.label}>
          {shown && more && (
            <>
              <h2 className={styles.caseTitle}>
                <Rise text={shown.label} delay={open ? 0.22 : 0} step={0.025} />
              </h2>
              <div className={styles.caseMedia}>
                {playing && more.video ? (
                  <iframe
                    src={`https://player.vimeo.com/video/${more.video.id}?h=${more.video.hash}&autoplay=1&muted=1&loop=1&dnt=1&title=0&byline=0&portrait=0`}
                    title={`${shown.label}: screen recording`}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {shown.image && <img src={shown.image} alt={`${shown.label}: screenshot`} />}
                    {more.video && (
                      <button type="button" className={styles.casePlay} onClick={() => setPlaying(true)}>
                        <span aria-hidden>▶</span> Play the recording
                      </button>
                    )}
                  </>
                )}
              </div>
              <dl className={styles.caseFacts}>
                <div>
                  <dt>Role</dt>
                  <dd>{more.role}</dd>
                </div>
                <div>
                  <dt>Year</dt>
                  <dd>{more.year}</dd>
                </div>
                <div>
                  <dt>Stack</dt>
                  <dd>{more.stack.join(" · ")}</dd>
                </div>
              </dl>
              <div className={styles.caseStory}>
                {more.story.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
              <div className={styles.caseFoot}>
                {shown.href && (
                  <a href={shown.href} target="_blank" rel="noreferrer" onClick={() => track("project_link_clicked", { project: shown.label, place: "case" })}>
                    {onVimeo ? "Watch on Vimeo" : "Open the site"} <span aria-hidden>↗</span>
                  </a>
                )}
                {next && (
                  <button type="button" onClick={() => onPick(next)}>
                    Next case: {next.label} <span aria-hidden>→</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
