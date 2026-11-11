// Аналитика: PostHog в облаке ЕС. Без cookie и без хранилища браузера, поэтому баннер согласия
// не нужен: посетителя различает сервер PostHog по обезличенному хэшу (в проекте должен быть
// включён Cookieless server hash mode). Запросы идут через наш же домен (/ingest, next.config.ts),
// иначе их режут блокировщики рекламы. Библиотека грузится после того, как сцена собралась:
// на скорость входа она не влияет, события до её загрузки ждут в очереди.
// Ключ проекта не секрет: он в любом случае виден в коде страницы.
const KEY = "phc_u3j5i5tQ96QJ77qdjJVgN7zRq3SAY64trqMupLccPpyD";
/** свои устройства не считаем: /?analytics=off выключает учёт на этом устройстве, /?analytics=on возвращает */
const OFF = "analytics-off";

type Props = Record<string, string | number | boolean | null | undefined>;
type Client = { capture: (name: string, props?: Props) => void; register: (props: Props) => void };

let client: Client | null = null;
let started = false;
const queue: (["capture", string, Props | undefined] | ["register", Props])[] = [];
const seen = new Set<string>();

function enabled() {
  // считаем только настоящий сайт: ни локальная разработка, ни пробные адреса Vercel в отчёты не попадают
  if (!/(^|\.)andreysol\.in$/.test(window.location.hostname)) return false;
  try {
    const flag = new URLSearchParams(window.location.search).get("analytics");
    if (flag === "off") window.localStorage.setItem(OFF, "1");
    if (flag === "on") window.localStorage.removeItem(OFF);
    return window.localStorage.getItem(OFF) !== "1";
  } catch {
    return true;
  }
}

/** Подключить аналитику. Вызывается, когда сцена собралась, или по таймеру, если она не собралась. */
export function startAnalytics() {
  if (started) return;
  started = true;
  if (!enabled()) return;
  import("posthog-js").then(({ default: posthog }) => {
    posthog.init(KEY, {
      api_host: "/ingest",
      ui_host: "https://eu.posthog.com",
      defaults: "2026-08-30",
      cookieless_mode: "always",
      // клики по сцене обычный автосбор не видит, поэтому все события отправляются явно
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: true,
      disable_surveys: true,
      capture_heatmaps: false,
      capture_dead_clicks: false,
      capture_exceptions: false,
      advanced_disable_flags: true,
    });
    // ссылка с меткой (?from=…) помечает все события визита: видно, кому она была отправлена
    const from = new URLSearchParams(window.location.search).get("from");
    if (from) posthog.register({ from: from.slice(0, 60) });
    client = posthog;
    for (const item of queue.splice(0)) item[0] === "register" ? posthog.register(item[1]) : posthog.capture(item[1], item[2]);
  });
}

/** Событие. До загрузки библиотеки копится в очереди; если учёт выключен, очередь просто не отправляется. */
export function track(name: string, props?: Props) {
  if (client) client.capture(name, props);
  else if (queue.length < 200) queue.push(["capture", name, props]);
}

/** То же, но один раз за визит: «первый раз покрутил модель», «первый раз взял букву». */
export function trackOnce(name: string, props?: Props) {
  if (seen.has(name)) return;
  seen.add(name);
  track(name, props);
}

/** Свойства, которые прикладываются ко всем следующим событиям, в том числе к уходу со страницы. */
export function remember(props: Props) {
  if (client) client.register(props);
  else if (queue.length < 200) queue.push(["register", props]);
}
