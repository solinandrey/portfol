import { city, easel, inspection, layers, mail, pipeline, stash, toddler, type Solids } from "./dots-shapes";

// Все предметы сайта разом: из файла портрета и из генераторов — в два массива, которые
// целиком уходят в видеопамять. Считается в фоновом потоке (components/dots/shapes.worker.ts):
// на телефоне это секунда-две работы процессора, и на главном потоке она замораживала вход.

const RANGE = 1.2;

/** как повернуть и поставить предмет, чтобы он читался */
export type ShapeMeta = {
  pitch?: number;
  yaw?: number;
  scale?: number;
  portrait?: boolean;
  /** предмет слегка покачивается сам */
  sway?: number;
  /** объёмы, которые заслоняют точки за собой: стены не просвечивают, такси уезжают за дома */
  solids?: Solids;
  /** вокруг чего качаются точки вида 2 и 3 */
  pivot?: [number, number];
  /** насколько можно повернуть мышкой: у города и малыша точки только на видимых сторонах */
  twist?: number;
};

export type Built = {
  /** координаты точек всех предметов: строки по cols точек, у каждого предмета rows строк, по 4 числа на точку */
  pos: Float32Array;
  /** как точка движется сама, в той же раскладке */
  motion: Float32Array;
  /** яркость точек портрета, 0–1 */
  lum: Float32Array;
  rows: number;
  shapes: ShapeMeta[];
};

export function build(buffer: ArrayBuffer, count: number, cols: number): Built {
  const raw = new Int16Array(buffer, 0, count * 3);
  const bytes = new Uint8Array(buffer, count * 6, count);
  const portrait = new Float32Array(count * 3);
  for (let i = 0; i < raw.length; i++) portrait[i] = (raw[i] / 32767) * RANGE;
  const lum = new Float32Array(count);
  for (let i = 0; i < count; i++) lum[i] = bytes[i] / 255;

  const taxi = city(count);
  const kid = toddler(count);
  const art = easel(count);
  const check = inspection(count, portrait);
  const pipe = pipeline(count);
  const money = stash(count);
  const letters = mail(count, portrait);
  const list: (ShapeMeta & { positions: Float32Array; motion?: Float32Array })[] = [
    { positions: portrait, portrait: true },
    { positions: kid.positions, motion: kid.motion, solids: kid.solids, pivot: kid.pivot, pitch: 0.14, scale: 0.88, sway: 0.07, twist: 0.6 },
    { positions: art.positions, motion: art.motion, sway: 0.16, pitch: 0.06 },
    { positions: taxi.positions, motion: taxi.motion, solids: taxi.solids, pitch: 0.6, yaw: 0.72, scale: 0.86, sway: 0.08, twist: 0.45 },
    { positions: layers(count), sway: 0.35 },
    { positions: check.positions, motion: check.motion, sway: 0.2, scale: 0.92 },
    { positions: pipe.positions, motion: pipe.motion, sway: 0.2, pitch: 0.1 },
    { positions: money.positions, motion: money.motion, sway: 0.2, pitch: 0.16 },
    { positions: letters.positions, motion: letters.motion, portrait: true },
  ];

  const rows = Math.ceil(count / cols);
  const pos = new Float32Array(cols * rows * list.length * 4);
  const motion = new Float32Array(cols * rows * list.length * 4);
  list.forEach((shape, k) => {
    const base = k * cols * rows * 4;
    for (let i = 0; i < count; i++) {
      pos[base + i * 4] = shape.positions[i * 3];
      pos[base + i * 4 + 1] = shape.positions[i * 3 + 1];
      pos[base + i * 4 + 2] = shape.positions[i * 3 + 2];
    }
    if (shape.motion) motion.set(shape.motion, base);
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const shapes = list.map(({ positions, motion: _, ...meta }) => meta);
  return { pos, motion, lum, rows, shapes };
}
