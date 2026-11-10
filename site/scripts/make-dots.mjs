// Портрет из точек: берём скан, разбрасываем точки по частицам. Чем светлее и крупнее частица,
// тем больше на неё точек, поэтому брови, глаза и полоски футболки читаются как плотность.
// Файлов три, по силам устройства (lib/portrait.ts): 200 тысяч точек для компьютера,
// 140 тысяч для планшета, 100 тысяч для телефона. Запуск:
//   node scripts/make-dots.mjs public/models/scan-clean.ply public/models/portrait-dots.bin
//   node scripts/make-dots.mjs public/models/scan-clean.ply public/models/portrait-dots-140k.bin 140000
//   node scripts/make-dots.mjs public/models/scan-clean.ply public/models/portrait-dots-100k.bin 100000
import fs from "node:fs";

const [src, dst, countArg] = process.argv.slice(2);
const COUNT = Number(countArg ?? 200000);
const RANGE = 1.2;
/** мерки лица (складки, глаза, уши) сняты в рамке с этим масштабом и сдвигом */
const MEASURE = 2.05;
const MEASURE_Y = 0.14;
/** кадр: крупная голова и только верх плеч */
const SCALE = 2.7;
const LIFT = 0.062;
const CHIN = -0.17;
const CUT = -0.24;
/** доля точек на голову: подобрана так, чтобы плотность у лица и у плеч была одна */
const HEAD_SHARE = Number(process.env.HEAD_SHARE ?? 0.6);
const YAW = Math.PI / 6; // в скане лицо смотрит левее оси z
/** после всех мерок лицо всё ещё смотрело градусов на шесть правее зрителя: доворачиваем готовые точки
 * и возвращаем голову на ось, чтобы при курсоре в центре портрет смотрел прямо */
const TURN = (-6 * Math.PI) / 180;
const TURN_SHIFT = 0.025;
const C0 = 0.28209479;

const buf = fs.readFileSync(src);
const he = buf.indexOf("end_header\n") + 11;
const header = buf.subarray(0, he).toString();
const props = [...header.matchAll(/property float (\S+)/g)].map((m) => m[1]);
const n = Number(header.match(/element vertex (\d+)/)[1]);
const S = props.length;
const P = Object.fromEntries(props.map((p, i) => [p, i]));
const d = new Float32Array(buf.buffer.slice(buf.byteOffset + he, buf.byteOffset + he + n * S * 4));

let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
const sig = (x) => 1 / (1 + Math.exp(-x));

/** точка скана в координатах сайта, до масштаба предмета: там проще мерить лицо */
const site = (o) => {
  const lx = d[o], lz = d[o + 2];
  return [(lx * Math.cos(YAW) + lz * Math.sin(YAW) - 0.009) * MEASURE, (d[o + 1] + MEASURE_Y) * MEASURE, (-lx * Math.sin(YAW) + lz * Math.cos(YAW)) * MEASURE];
};
const segment = (px, py, ax, ay, bx, by) => {
  const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return Math.hypot(px - ax - t * (bx - ax), py - ay - t * (by - ay));
};
// носогубные складки: от крыльев носа к уголкам рта, в скане они глубже, чем в жизни
const FOLDS = [[-0.03, 0.245, -0.045, 0.155], [0.044, 0.245, 0.059, 0.155]];
// глазницы в скане почти пустые: добавляем точек, но оставляем их темнее кожи
const EYES = [[-0.058, 0.303], [0.064, 0.303]];
const eyes = ([x, y, z]) => (z < 0.12 ? 0 : Math.max(...EYES.map(([ex, ey]) => Math.exp(-(((x - ex) / 0.04) ** 2 + ((y - ey) / 0.022) ** 2)))));
const folds = ([x, y, z]) => (z < 0.12 ? 0 : Math.max(...FOLDS.map((f) => Math.exp(-((segment(x, y, ...f) / 0.024) ** 2)))));

// яркость с поправкой: лицо темнее футболки, поэтому у каждой части своя растяжка контраста
const tone = (lum, y, at) => {
  // плечи растягиваем почти как лицо, иначе низ выходит темнее и прозрачнее
  let t = y > CHIN ? (lum - 0.12) / 0.5 : (lum - 0.1) / 0.62;
  if (at) {
    const lift = folds(at);
    // поднимаем к тону щеки: и точки светлее, и их больше, тень остаётся, но мягче
    if (t < 0.8) t += (0.8 - t) * 0.7 * lift;
    const eye = eyes(at);
    if (t < 0.6) t += (0.6 - t) * 0.85 * eye;
  }
  return Math.max(0, Math.min(1, t));
};
// волосы за ушами: только то, что торчит шире головы у ушей и шире шеи под ними. Сзади не режем:
// голова поворачивается, и на месте волос за ухом была бы дыра. К верху уха и к краю срез плавный
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const behindEar = ([x, y]) => {
  if (y < -0.02 || y > 0.34) return 0;
  const top = 1 - clamp01((y - 0.29) / 0.05);
  const half = 0.13 + 0.06 * clamp01((y - 0.1) / 0.1);
  return (y > 0.1 ? clamp01((Math.abs(x + 0.015) - half) / 0.02) : 0) * top;
};
const lumOf = (o) => Math.max(0, Math.min(1, 0.5 + C0 * (d[o + P.f_dc_0] + d[o + P.f_dc_1] + d[o + P.f_dc_2]) / 3));
const sizeOf = (o) => Math.cbrt(Math.exp(d[o + P.scale_0]) * Math.exp(d[o + P.scale_1]) * Math.exp(d[o + P.scale_2]));

const pools = [{ idx: [], cdf: [], total: 0 }, { idx: [], cdf: [], total: 0 }];
for (let i = 0; i < n; i++) {
  const o = i * S;
  const y = d[o + 1];
  if (y < CUT || sig(d[o + P.opacity]) < 0.3) continue;
  const at = site(o);
  const t = tone(lumOf(o), y, at);
  if (rnd() < behindEar(at)) continue;
  const head = y > CHIN;
  const pool = pools[head ? 0 : 1];
  // на голове у тёмного свой минимум точек: волосы и глазницы тусклые, но не дырявые.
  // На футболке минимум низкий, иначе пропадут полоски
  pool.total += Math.pow(Math.min(sizeOf(o), 0.006), 1.2) * ((head ? 0.1 : 0.015) + Math.pow(t, 2.2));
  pool.idx.push(i);
  pool.cdf.push(pool.total);
}

// щёки не такие круглые: низ щёк к челюсти чуть к середине, ширина на скулах и выше как была
const FACE_X = 0.007;
const jaw = (x, y) => {
  const band = Math.max(0, Math.min(1, (y - 0.1) / 0.06)) * (1 - Math.max(0, Math.min(1, (y - 0.19) / 0.06)));
  return FACE_X + (x - FACE_X) * (1 - 0.04 * band * band * (3 - 2 * band));
};

const pos = new Int16Array(COUNT * 3);
const lumOut = new Uint8Array(COUNT);
for (let k = 0; k < COUNT; k++) {
  const pool = pools[rnd() < HEAD_SHARE ? 0 : 1];
  const r = rnd() * pool.total;
  let lo = 0, hi = pool.cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pool.cdf[mid] < r) lo = mid + 1;
    else hi = mid;
  }
  const o = pool.idx[lo] * S;
  const s = Math.min(0.0028, sizeOf(o));
  const lx = d[o] + gauss() * s, y = d[o + 1] + gauss() * s, lz = d[o + 2] + gauss() * s;
  const x = lx * Math.cos(YAW) + lz * Math.sin(YAW);
  const z = -lx * Math.sin(YAW) + lz * Math.cos(YAW);
  const k2 = SCALE / MEASURE;
  const fx = jaw((x - 0.009) * MEASURE, (y + MEASURE_Y) * MEASURE) * k2;
  const fz = z * SCALE;
  pos[k * 3] = Math.round(((fx * Math.cos(TURN) + fz * Math.sin(TURN) + TURN_SHIFT) / RANGE) * 32767);
  pos[k * 3 + 1] = Math.round((((y + LIFT) * SCALE) / RANGE) * 32767);
  pos[k * 3 + 2] = Math.round(((-fx * Math.sin(TURN) + fz * Math.cos(TURN)) / RANGE) * 32767);
  lumOut[k] = Math.round(tone(lumOf(o), d[o + 1], site(o)) * 255);
}
fs.writeFileSync(dst, Buffer.concat([Buffer.from(pos.buffer), Buffer.from(lumOut.buffer)]));
console.log(`${COUNT} точек → ${(fs.statSync(dst).size / 1e6).toFixed(2)} МБ`);
