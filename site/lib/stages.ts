// Этапы карьеры. Фигура идёт через них, и в каждом частицы собираются по-своему:
// внешне Андрей почти не менялся, поэтому эволюцию рисуем абстрактно.

export type Look = {
  /** шаг вокселной сетки, 0 — без сетки (пиксели вёрстки) */
  grid: number;
  /** шаг горизонтальных строк, 0 — без строк (таблицы, дашборды) */
  rows: number;
  /** 1 — квадратные точки, 0 — круглые */
  square: number;
  /** сила плавающего движения (анимация) */
  swirl: number;
  /** множитель размера точки */
  size: number;
  /** 1 — по фигуре бежит полоса сканера (верификация личности) */
  scan: number;
  /** основной цвет и акцент */
  colors: [string, string];
  /** доля точек акцентного цвета */
  accent: number;
  /** сколько от настоящего цвета модели: 0 — только палитра этапа, 1 — как на текстуре */
  photo: number;
};

export type Stage = {
  id: string;
  years: string;
  place: string;
  role: string;
  stack: string;
  line: string;
  look: Look;
};

export const STAGES: Stage[] = [
  {
    id: "12digital",
    years: "2018",
    place: "12 Digital",
    role: "Junior frontend developer",
    stack: "HTML · CSS · jQuery · Vue",
    line: "Sites for whoever walked in. Learned layout the hard way.",
    look: { grid: 0.045, rows: 0, square: 1, swirl: 0, size: 1.7, scan: 0, colors: ["#e9e6df", "#8f8b84"], accent: 0.3, photo: 0.85 },
  },
  {
    id: "beta",
    years: "2019 — 2021",
    place: "Beta Digital",
    role: "Frontend developer → team lead",
    stack: "Vue · Nuxt · GSAP · Lottie · p5",
    line: "Animation-heavy sites for big brands. Ended up leading five devs.",
    look: { grid: 0, rows: 0, square: 0, swirl: 1, size: 1.15, scan: 0, colors: ["#ff4b2b", "#4c6bff"], accent: 0.45, photo: 0.2 },
  },
  {
    id: "citymobil",
    years: "2021 — 2022",
    place: "Citymobil",
    role: "Frontend developer",
    stack: "React · MobX · TypeScript · Storybook",
    line: "Fleet: dashboards, reports and forms for taxi companies.",
    look: { grid: 0, rows: 0.03, square: 1, swirl: 0, size: 0.95, scan: 0, colors: ["#e9e6df", "#ffd23f"], accent: 0.12, photo: 0.5 },
  },
  {
    id: "freelance",
    years: "2022 — 2023",
    place: "Freelance",
    role: "Frontend developer",
    stack: "Next.js · Strapi · AWS",
    line: "Ruvento Ventures: the website and the admin panel behind it.",
    look: { grid: 0.022, rows: 0, square: 0, swirl: 0.25, size: 1, scan: 0, colors: ["#7fd6ff", "#e9e6df"], accent: 0.25, photo: 0.15 },
  },
  {
    id: "sumsub",
    years: "2023 — 2025",
    place: "Sumsub",
    role: "Senior frontend developer",
    stack: "React · Next.js · TypeScript · Figma",
    line: "Identity verification. Landing pages, the UI kit, a sub-team of two.",
    look: { grid: 0, rows: 0, square: 0, swirl: 0, size: 1, scan: 1, colors: ["#e9e6df", "#b6ff3b"], accent: 0.08, photo: 0.35 },
  },
  {
    id: "now",
    years: "2026 —",
    place: "Symmetre · fatstack",
    role: "Product / UI designer",
    stack: "Figma · and still code",
    line: "Data-heavy B2B product by day, our own portfolio tracker by night.",
    look: { grid: 0, rows: 0, square: 0, swirl: 0, size: 0.85, scan: 0, colors: ["#ffffff", "#ffffff"], accent: 0, photo: 1 },
  },
];
