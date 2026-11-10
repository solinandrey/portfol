// Предметы этапов из тех же точек, что и портрет. Каждая функция раскладывает count точек
// по поверхности простого предмета. Размеры примерно совпадают с портретом: ±0.5 по высоте.

type Fill = (x: number, y: number, z: number) => void;

function maker(count: number, seed: number) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out = new Float32Array(count * 3);
  let n = 0;
  const put: Fill = (x, y, z) => {
    if (n >= count) return;
    out[n * 3] = x;
    out[n * 3 + 1] = y;
    out[n * 3 + 2] = z;
    n++;
  };
  return { rnd, put, out, left: () => count - n };
}

type V3 = [number, number, number];
const clampUnit = (v: number) => Math.max(0, Math.min(1, v));
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Точки по поверхности трубки от a до b; taper сужает её к b, как кисть. */
function tube(put: Fill, rnd: () => number, a: V3, b: V3, r: number, n: number, taper = 0, each?: () => void) {
  const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const w = unit(d);
  const u = unit(cross(Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], w));
  const v = cross(w, u);
  for (let i = 0; i < n; i++) {
    const t = rnd();
    const ang = rnd() * Math.PI * 2;
    const rr = r * (1 - taper * t);
    const c = Math.cos(ang) * rr, sn = Math.sin(ang) * rr;
    put(a[0] + d[0] * t + u[0] * c + v[0] * sn, a[1] + d[1] * t + u[1] * c + v[1] * sn, a[2] + d[2] * t + u[2] * c + v[2] * sn);
    each?.();
  }
}

/** Движение точек: вид, фаза, скорость, размах; пишется для последней поставленной точки. */
function motionOf(count: number, left: () => number) {
  const motion = new Float32Array(count * 4);
  const mark = (kind: number, phase: number, speed: number, amp: number) => motion.set([kind, phase, speed, amp], (count - left() - 1) * 4);
  return { motion, mark };
}

/** Точки на плоских прямоугольниках, поровну на единицу площади. Прямоугольник: x, y, w, h, z. */
function rects(count: number, seed: number, list: [number, number, number, number, number][], jitter = 0.002) {
  const { rnd, put, out } = maker(count, seed);
  const areas = list.map((r) => r[2] * r[3]);
  const total = areas.reduce((a, b) => a + b, 0);
  for (let i = 0; i < count; i++) {
    let t = rnd() * total;
    let k = 0;
    while (k < list.length - 1 && t > areas[k]) t -= areas[k++];
    const [x, y, w, h, z] = list[k];
    put(x + rnd() * w, y + rnd() * h, z + (rnd() - 0.5) * jitter);
  }
  return out;
}

/** Холст мольберта, клавиатура и как на холсте рисуется картина: эти же числа читает шейдер. */
export const EASEL = {
  CW: 0.3, CY0: -0.06, CY1: 0.34, CZ: 0.03,
  /** картина — круги, как у Кандинского: центр x, y и радиус; рисуются по порядку, кистью по кругу */
  CIRCLES: [
    [-0.09, 0.17, 0.105], [0.12, 0.09, 0.08], [0.03, 0.235, 0.048], [-0.18, 0.03, 0.04],
    [0.195, 0.245, 0.034], [-0.02, 0.055, 0.03], [0.085, 0.27, 0.021], [-0.215, 0.255, 0.024],
  ] as [number, number, number][],
  /** за сколько секунд картина рисуется целиком и гаснет */
  LOOP: 10,
  /** клавиатура: наклон к нам, сколько клавиш и как глубоко нажимаются */
  KEY_TILT: 0.72, KEYS: 49, PRESS: 0.011,
};

/**
 * 2019–2021. Beta: код и арт вместе. Перед мольбертом клавиатура: клавиши нажимаются в ритме
 * набора и на миг вспыхивают (вид 9). На холсте в такт рисуется картина из кругов (вид 5),
 * оранжевая кисть обводит и закрашивает круг за кругом (вид 6). Справа палитра.
 */
export function easel(count: number) {
  const { rnd, put, out, left } = maker(count, 23);
  const { motion, mark } = motionOf(count, left);
  const { CW, CY0, CY1, CZ, CIRCLES, KEY_TILT, KEYS, PRESS } = EASEL;

  // поверхность холста редкая: на ней картина читается
  for (let i = 0; i < count * 0.05; i++) put((rnd() * 2 - 1) * CW, CY0 + rnd() * (CY1 - CY0), CZ);

  // кромка холста и подрамник: лицо, торцы
  const edge = Math.floor(count * 0.04);
  for (let i = 0; i < edge; i++) {
    const side = Math.floor(rnd() * 4);
    const t = rnd();
    const z = CZ - rnd() * 0.03;
    if (side === 0) put(-CW + t * 2 * CW, CY1, z);
    else if (side === 1) put(-CW + t * 2 * CW, CY0, z);
    else put(side === 2 ? -CW : CW, CY0 + t * (CY1 - CY0), z);
  }

  // мольберт: две передние ноги сходятся наверху, задняя опора, полка под холст, зажим сверху
  const wood = Math.floor(count * 0.02);
  tube(put, rnd, [-0.21, -0.52, 0.08], [-0.035, 0.44, 0.0], 0.009, wood);
  tube(put, rnd, [0.21, -0.52, 0.08], [0.035, 0.44, 0.0], 0.009, wood);
  tube(put, rnd, [0, 0.42, -0.01], [0, -0.52, -0.3], 0.008, Math.floor(wood * 0.8));
  tube(put, rnd, [-0.37, CY0 - 0.02, 0.05], [0.37, CY0 - 0.02, 0.05], 0.014, Math.floor(wood * 1.3));
  tube(put, rnd, [-0.06, CY1 + 0.02, 0.035], [0.06, CY1 + 0.02, 0.035], 0.011, Math.floor(wood * 0.4));

  // клавиатура перед мольбертом, приподнята к нам. u — поперёк, v — вглубь, h — вверх от подложки
  const KB: V3 = [-0.06, -0.37, 0.27];
  const ct = Math.cos(KEY_TILT), st = Math.sin(KEY_TILT);
  const onBoard = (u: number, v: number, h: number) => put(KB[0] + u, KB[1] + h * ct + v * st, KB[2] - v * ct + h * st);
  const W = 0.31, D = 0.115;
  for (let i = 0; i < count * 0.005; i++) onBoard((rnd() * 2 - 1) * W, (rnd() * 2 - 1) * D, 0);
  for (let i = 0; i < count * 0.012; i++) {
    const side = Math.floor(rnd() * 4), t = rnd() * 2 - 1, h = -rnd() * 0.018;
    if (side < 2) onBoard(t * W, side ? D : -D, h);
    else onBoard(side === 2 ? -W : W, t * D, h);
  }
  const PITCH = 0.049, CAP = 0.038, TOP = 0.017;
  const keyAt = (row: number, col: number): [number, number] => [-W + 0.014 + col * PITCH + (row % 2) * 0.01 + CAP / 2, D - 0.03 - row * PITCH];
  const keys: [number, number, number][] = [];
  for (let row = 0; row < 4; row++) for (let col = 0; col < 12; col++) keys.push([...keyAt(row, col), CAP]);
  keys.push([-0.14 + 0.13, D - 0.03 - 4 * PITCH, 0.26]);
  const perKey = Math.floor((count * 0.09) / (KEYS + 3));
  keys.forEach(([uc, vc, w], k) => {
    for (let i = 0; i < perKey * (k === KEYS - 1 ? 4 : 1); i++) {
      // крышка клавиши и её передний торец
      const front = rnd() < 0.08;
      const u = uc - w / 2 + rnd() * w, v = front ? vc - CAP / 2 : vc - CAP / 2 + rnd() * CAP;
      onBoard(u, v, front ? rnd() * TOP : TOP);
      mark(9, k, KEYS, PRESS);
    }
  });

  // палитра справа у ноги: лежит наклонно, с дыркой для пальца и мазками; один мазок оранжевый
  const palette = Math.floor(count * 0.04);
  const P: V3 = [0.4, -0.4, 0.14];
  const tilt = 0.9, spin = -0.35;
  const onPalette = (u: number, v: number, lift: number) => {
    const x = u * Math.cos(spin) - v * Math.sin(spin), y = u * Math.sin(spin) + v * Math.cos(spin);
    put(P[0] + x, P[1] + y * Math.cos(tilt) + lift * Math.sin(tilt), P[2] - y * Math.sin(tilt) + lift * Math.cos(tilt));
  };
  for (let i = 0; i < palette; ) {
    const u = (rnd() * 2 - 1) * 0.11, v = (rnd() * 2 - 1) * 0.08;
    if ((u / 0.11) ** 2 + (v / 0.08) ** 2 > 1 || Math.hypot(u + 0.055, v + 0.024) < 0.018 || Math.hypot(u + 0.1, v) < 0.028) continue;
    onPalette(u, v, 0);
    i++;
  }
  const dabs: [number, number, number][] = [[0.065, 0.032, 0.02], [0.018, 0.046, 0.018], [-0.027, 0.042, 0.016], [0.07, -0.032, 0.018], [0.0, -0.042, 0.016]];
  dabs.forEach(([du, dv, r], k) => {
    for (let i = 0; i < count * 0.004; i++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * r;
      onPalette(du + Math.cos(a) * rr, dv + Math.sin(a) * rr, 0.006 * (1 - rr / r));
      if (k === 0) mark(10, 0, 0, 1);
    }
  });

  // кисть строится вокруг кончика: шейдер ставит кончик туда, где сейчас рисуется круг
  const brush = () => mark(6, 0, 0, 1);
  tube(put, rnd, [0.044, 0.044, 0.034], [0.24, 0.25, 0.17], 0.007, Math.floor(count * 0.018), 0, brush);
  tube(put, rnd, [0.022, 0.022, 0.02], [0.044, 0.044, 0.034], 0.0095, Math.floor(count * 0.005), 0, brush);
  tube(put, rnd, [0.022, 0.022, 0.02], [0, 0, 0], 0.011, Math.floor(count * 0.008), 0.85, brush);

  // остальное — картина: у каждого круга обвод и заливка, по точке видно, какой это круг
  // и на каком он угле, чтобы кисть закрашивала их по порядку
  const weights = CIRCLES.map(([, , r]) => r);
  const total = weights.reduce((a, b) => a + b, 0);
  while (left() > 0) {
    let t = rnd() * total;
    let i = 0;
    while (i < CIRCLES.length - 1 && t > weights[i]) t -= weights[i++];
    const [cx, cy, r] = CIRCLES[i];
    const a = rnd() * Math.PI * 2;
    const ring = rnd() < 0.55;
    const rr = ring ? r * (1 + (rnd() - 0.5) * 0.06) : r * Math.sqrt(rnd()) * 0.97;
    put(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, CZ + 0.004);
    mark(5, i, a / (Math.PI * 2), ring ? 1 : 0.5);
  }
  return { positions: out, motion };
}

/** 2022–2023. Сайт и админка: слои одного продукта, разведённые в стороны. */
export function layers(count: number) {
  const list: [number, number, number, number, number][] = [];
  const w = 0.36, h = 0.25;
  for (let i = 0; i < 4; i++) {
    const z = -0.3 + i * 0.2;
    // слои разведены по диагонали: спереди они не сливаются
    const dx = -0.21 + i * 0.14;
    const dy = 0.2 - i * 0.135;
    const add = (x: number, y: number, a: number, b: number) => list.push([x + dx, y + dy, a, b, z]);
    add(-w, h, 2 * w, 0.005);
    add(-w, -h, 2 * w, 0.005);
    add(-w, -h, 0.005, 2 * h);
    add(w, -h, 0.005, 2 * h);
    if (i === 0) {
      add(-w + 0.03, -h + 0.03, 0.16, 2 * h - 0.06);
      add(-w + 0.22, 0.09, 0.44, 0.12);
      add(-w + 0.22, -0.07, 0.44, 0.12);
    }
    if (i === 1) for (let r = 0; r < 7; r++) add(-w + 0.03, -h + 0.04 + r * 0.06, 2 * w - 0.06, 0.018);
    if (i === 2) {
      add(-w + 0.03, -h + 0.03, 0.3, 2 * h - 0.06);
      add(0, 0.03, 0.32, 0.18);
      add(0, -0.22, 0.32, 0.2);
    }
    if (i === 3) {
      add(-w + 0.03, 0, 2 * w - 0.06, 0.22);
      add(-w + 0.03, -0.22, 0.2, 0.18);
      add(-0.1, -0.22, 0.2, 0.18);
      add(0.13, -0.22, 0.2, 0.18);
    }
  }
  return rects(count, 41, list, 0.001);
}

/**
 * 2023–2025. Sumsub: проверка личности. Пропуск висит в воздухе, по нему ходит оранжевая лупа
 * (вид 7) и останавливается на фото, строках, печати и машиночитаемой строке. Точки документа
 * (вид 8) под стеклом увеличиваются, размах — радиус стекла. Путь лупы — в шейдере.
 */
export const LENS = 0.11;
export function inspection(count: number, portrait: Float32Array) {
  const { rnd, put, out, left } = maker(count, 51);
  const { motion, mark } = motionOf(count, left);
  const W = 0.6, H = 0.38, Z = 0.07;
  const lens = () => mark(7, 0, 0, LENS);
  const doc = () => mark(8, 0, 0, LENS * 0.96);

  // лупа: обод, ручка и блик на стекле; строится вокруг нуля, сдвигает её шейдер
  const rim = Math.floor(count * 0.045);
  for (let i = 0; i < rim; i++) {
    const a = rnd() * Math.PI * 2, b = rnd() * Math.PI * 2, r = 0.008;
    put(Math.cos(a) * (LENS + Math.cos(b) * r), Math.sin(a) * (LENS + Math.cos(b) * r), Z + Math.sin(b) * r);
    lens();
  }
  const k = LENS * 0.72;
  tube(put, rnd, [k, -k, Z], [k + 0.13, -k - 0.13, Z], 0.016, Math.floor(count * 0.022), 0, lens);
  for (let i = 0; i < count * 0.004; i++) {
    const a = 1.9 + rnd() * 0.9, r = LENS * (0.7 + rnd() * 0.06);
    put(Math.cos(a) * r, Math.sin(a) * r, Z);
    lens();
  }

  // фото: голова из тех же точек портрета, уменьшенная и сплющенная
  const total = portrait.length / 3;
  const face = Math.floor(count * 0.46);
  for (let i = 0; i < face; ) {
    const j = Math.floor(rnd() * total);
    const y = portrait[j * 3 + 1];
    if (y < -0.24) continue;
    put(-0.3 + portrait[j * 3] * 0.36, -0.03 + (y - 0.165) * 0.36, portrait[j * 3 + 2] * 0.05);
    doc();
    i++;
  }

  // печать у фото: два кольца
  for (let i = 0; i < count * 0.012; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() < 0.6 ? 0.05 : 0.036;
    put(-0.15 + Math.cos(a) * r, -0.13 + Math.sin(a) * r, 0.003);
    doc();
  }


  // рамка, поля и машиночитаемая строка внизу, как в паспорте: знаки ячейками
  const blocks: [number, number, number, number][] = [
    [-W, H, 2 * W, 0.005], [-W, -H, 2 * W, 0.005], [-W, -H, 0.005, 2 * H], [W, -H, 0.005, 2 * H],
    [0.08, 0.2, 0.42, 0.04], [0.08, 0.1, 0.34, 0.025], [0.08, 0.04, 0.42, 0.025], [0.08, -0.02, 0.26, 0.025],
    // прорезь под ленту: пропуск висит, а не телевизор
    [-0.07, H - 0.07, 0.14, 0.004], [-0.07, H - 0.045, 0.14, 0.004], [-0.07, H - 0.07, 0.004, 0.029], [0.066, H - 0.07, 0.004, 0.029],
  ];
  for (let row = 0; row < 2; row++) {
    for (let c = 0; c < 44; c++) {
      if ((c * 7 + row * 3) % 9 < 2) continue;
      blocks.push([-0.55 + c * 0.025, -0.31 + row * 0.05, 0.015, 0.024]);
    }
  }
  const areas = blocks.map((bl) => bl[2] * bl[3]);
  const sum = areas.reduce((x, y) => x + y, 0);
  while (left() > 0) {
    let t = rnd() * sum;
    let q = 0;
    while (q < blocks.length - 1 && t > areas[q]) t -= areas[q++];
    const [x, y, w, h] = blocks[q];
    put(x + rnd() * w, y + rnd() * h, 0);
    doc();
  }
  return { positions: out, motion };
}

/** Письма на последнем экране: длина круга в секундах, какую его долю письмо летит, и точка у лица, куда оно прилетает. Читает и шейдер. */
export const MAIL = { LOOP: 9, FLIGHT: 0.42, AIM: [0, 0.2, 0.34] as V3 };

/**
 * Портрет для последнего экрана: к голове по очереди подлетают письма. Немного точек портрета
 * уходит на четыре конверта, остальные стоят на своих местах, поэтому лицо то же, что на первом
 * экране. Конверт собран вокруг нуля: откуда он летит и когда, записано в движении (вид 14),
 * путь считает шейдер.
 */
export function mail(count: number, portrait: Float32Array) {
  const { rnd, put, out, left } = maker(count, 77);
  const { motion, mark } = motionOf(count, left);
  const W = 0.17, H = 0.115;
  // откуда летят: сверху слева, справа, снизу слева, сверху справа; угол в радианах и расстояние от лица
  const from: [number, number][] = [[2.55, 0.74], [-0.2, 0.78], [3.6, 0.72], [0.75, 0.74]];
  const each = Math.floor(count * 0.013);
  from.forEach(([angle, far], k) => {
    for (let i = 0; i < each; i++) {
      const pick = rnd();
      let x: number, y: number;
      if (pick < 0.45) {
        // рамка конверта
        const t = rnd() * 2 * (W + H);
        if (t < W) [x, y] = [t - W / 2, H / 2];
        else if (t < 2 * W) [x, y] = [t - W - W / 2, -H / 2];
        else if (t < 2 * W + H) [x, y] = [-W / 2, t - 2 * W - H / 2];
        else [x, y] = [W / 2, t - 2 * W - H - H / 2];
      } else if (pick < 0.75) {
        // клапан: от верхних углов к середине
        const t = rnd(), side = rnd() < 0.5 ? -1 : 1;
        [x, y] = [side * (W / 2) * (1 - t), H / 2 - t * (H * 0.58)];
      } else {
        [x, y] = [(rnd() - 0.5) * W, (rnd() - 0.5) * H];
      }
      put(x + (rnd() - 0.5) * 0.003, y + (rnd() - 0.5) * 0.003, (rnd() - 0.5) * 0.003);
      mark(14, k / from.length, angle, far);
    }
  });
  for (let i = count - left(); i < count; i++) put(portrait[i * 3], portrait[i * 3 + 1], portrait[i * 3 + 2]);
  return { positions: out, motion };
}

/** Провода от зданий к дашборду и то, как он заполняется: эти же числа читает шейдер. */
export const PIPE = {
  /** провод — дуга: от крыши, через провисшую середину, к разъёму на краю дашборда */
  WIRES: [
    [[-0.44, 0.2, 0.02], [-0.2, -0.02, 0.1], [0.06, 0.25, 0.03]],
    [[-0.25, 0.02, -0.1], [-0.1, -0.2, 0.02], [0.06, 0.0, 0.03]],
    [[-0.3, -0.12, 0.16], [-0.12, -0.36, 0.14], [0.06, -0.25, 0.03]],
  ] as [number, number, number][][],
  /** сколько оборотов в секунду делает пакет данных по проводу */
  SPEED: 0.2,
  /** за сколько секунд дашборд заполняется целиком и гаснет */
  LOOP: 11,
};

/**
 * 2026. Symmetre: данные о недвижимости фонда приходят в интерфейс. Слева башни с этажами,
 * от крыш тянутся провода, по ним бегут оранжевые пакеты данных (вид 11). Справа дашборд:
 * рамка и сетка виджетов стоят всегда, а содержимое раскладывается по очереди (вид 12) —
 * плитки с числами, столбцы растут, линия графика прочерчивается, строки таблицы заполняются.
 */
export function pipeline(count: number) {
  const { rnd, put, out, left } = maker(count, 61);
  const { motion, mark } = motionOf(count, left);
  const share = (f: number) => Math.floor(count * f);
  const GROUND = -0.42;

  // башни из этажных плит
  const towersList = [
    [-0.44, 0.02, 0.07, 0.62], [-0.25, -0.1, 0.06, 0.44], [-0.3, 0.16, 0.055, 0.3],
  ];
  const weights = towersList.map((t) => t[2] * t[3]);
  const total = weights.reduce((a, b) => a + b, 0);
  for (let i = share(0.3); i > 0; i--) {
    let t = rnd() * total;
    let k = 0;
    while (k < towersList.length - 1 && t > weights[k]) t -= weights[k++];
    const [cx, cz, b, h] = towersList[k];
    const floors = Math.round(h / 0.035);
    const y = GROUND + (Math.floor(rnd() * (floors + 1)) / floors) * h + 0.01 * (rnd() - 0.5);
    const side = Math.floor(rnd() * 4);
    const u = (rnd() - 0.5) * 2 * b;
    if (side === 0) put(cx + b, y, cz + u);
    else if (side === 1) put(cx - b, y, cz + u);
    else if (side === 2) put(cx + u, y, cz + b);
    else put(cx + u, y, cz - b);
  }

  // провода: редкие точки вдоль дуги, чуть гуще у концов
  const along = ([a, c, b]: number[][], t: number): V3 => {
    const s = 1 - t;
    return [a[0] * s * s + c[0] * 2 * s * t + b[0] * t * t, a[1] * s * s + c[1] * 2 * s * t + b[1] * t * t, a[2] * s * s + c[2] * 2 * s * t + b[2] * t * t];
  };
  for (let i = share(0.07); i > 0; i--) {
    const wire = PIPE.WIRES[i % PIPE.WIRES.length];
    const [x, y, z] = along(wire, rnd());
    put(x + (rnd() - 0.5) * 0.004, y + (rnd() - 0.5) * 0.004, z + (rnd() - 0.5) * 0.004);
  }
  // пакеты данных: сгустки, которые шейдер ведёт по проводу. В positions — только разброс внутри сгустка
  const PACKETS = 4;
  for (let i = share(0.035); i > 0; i--) {
    const wire = i % PIPE.WIRES.length;
    const packet = Math.floor(rnd() * PACKETS);
    const r = 0.011 * Math.cbrt(rnd());
    const a = rnd() * Math.PI * 2, c = rnd() * 2 - 1, sn = Math.sqrt(1 - c * c);
    put(r * sn * Math.cos(a), r * c, r * sn * Math.sin(a));
    mark(11, wire, (packet + wire * 0.37) / PACKETS, 1);
  }

  // дашборд: вертикальная панель, содержимое чуть впереди рамки
  const X0 = 0.06, X1 = 0.56, Y0 = -0.38, Y1 = 0.4, Z = 0.03, FRONT = 0.055;
  type Order = (x: number, y: number) => number;
  /** точки по контуру прямоугольника */
  const outline = (n: number, x: number, y: number, w: number, h: number, z: number) => {
    for (let i = n; i > 0; i--) {
      const t = rnd() * (w + h) * 2;
      const j = (rnd() - 0.5) * 0.003;
      if (t < w) put(x + t, y + j, z);
      else if (t < w * 2) put(x + t - w, y + h + j, z);
      else if (t < w * 2 + h) put(x + j, y + t - w * 2, z);
      else put(x + w + j, y + t - w * 2 - h, z);
    }
  };
  /** точки внутри прямоугольника; order — когда точка появляется в круге заполнения, 0–1 */
  const fill = (n: number, x: number, y: number, w: number, h: number, order?: Order) => {
    for (let i = n; i > 0; i--) {
      const px = x + rnd() * w, py = y + rnd() * h;
      put(px, py, FRONT + (rnd() - 0.5) * 0.003);
      if (order) mark(12, order(px, py), 0, 1);
    }
  };
  // рамка, шапка и разъёмы, куда приходят провода
  outline(share(0.06), X0, Y0, X1 - X0, Y1 - Y0, Z);
  outline(share(0.012), X0, Y1 - 0.06, X1 - X0, 0.0001, Z);
  for (const wire of PIPE.WIRES) fill(share(0.006), X0 - 0.012, wire[2][1] - 0.012, 0.024, 0.024);

  // плитки с числами: три в ряд, в каждой подпись и крупное число
  const tileW = 0.135, tileY = 0.2, tileH = 0.11;
  for (let k = 0; k < 3; k++) {
    const x = X0 + 0.03 + k * (tileW + 0.0175);
    const at = 0.05 + k * 0.045;
    outline(share(0.012), x, tileY, tileW, tileH, Z);
    fill(share(0.006), x + 0.014, tileY + tileH - 0.03, 0.05 + 0.02 * k, 0.008, (px) => at + (px - x) * 0.2);
    fill(share(0.022), x + 0.014, tileY + 0.02, 0.06 + 0.018 * ((k * 2) % 3), 0.036, (px) => at + 0.02 + (px - x) * 0.25);
  }

  // столбцы: растут снизу вверх один за другим
  const chartY = -0.13, chartH = 0.27, barsX = X0 + 0.03, barsW = 0.2;
  outline(share(0.014), barsX, chartY, barsW, chartH, Z);
  const bars = [0.42, 0.66, 0.5, 0.86, 0.62, 0.96];
  bars.forEach((v, k) => {
    const w = 0.02, x = barsX + 0.016 + k * 0.0295, y = chartY + 0.018, h = (chartH - 0.04) * v;
    const at = 0.2 + k * 0.035;
    fill(share(0.022 * v), x, y, w, h, (_, py) => at + ((py - y) / h) * 0.05);
  });

  // график: линия прочерчивается слева направо, под ней редкая заливка
  const lineX = X0 + 0.25, lineW = X1 - 0.03 - lineX;
  outline(share(0.014), lineX, chartY, lineW, chartH, Z);
  const knots = [0.3, 0.42, 0.36, 0.58, 0.5, 0.76, 0.7, 0.92];
  const curve = (t: number) => {
    const f = clampUnit(t) * (knots.length - 1);
    const k = Math.min(knots.length - 2, Math.floor(f));
    const u = f - k;
    return knots[k] + (knots[k + 1] - knots[k]) * u * u * (3 - 2 * u);
  };
  const lineY = chartY + 0.018, lineH = chartH - 0.04, lx = lineX + 0.014, lw = lineW - 0.028;
  for (let i = share(0.03); i > 0; i--) {
    const t = rnd();
    put(lx + t * lw, lineY + curve(t) * lineH + (rnd() - 0.5) * 0.006, FRONT);
    mark(12, 0.46 + t * 0.17, 0, 1);
  }
  for (let i = share(0.03); i > 0; i--) {
    const t = rnd();
    put(lx + t * lw, lineY + rnd() * curve(t) * lineH, FRONT - 0.004);
    mark(12, 0.48 + t * 0.17, 0, 1);
  }

  // таблица: строки заполняются сверху вниз, ячейка за ячейкой
  const tableY = Y0 + 0.03, tableH = 0.19, rows = 4, tableX = X0 + 0.03, tableW = X1 - X0 - 0.06;
  outline(share(0.016), tableX, tableY, tableW, tableH, Z);
  const cols = [0, 0.3, 0.52, 0.76];
  const perCell = Math.max(1, Math.floor(left() / (rows * cols.length)));
  for (let r = 0; r < rows; r++) {
    const y = tableY + tableH - (r + 0.72) * (tableH / rows);
    cols.forEach((c, k) => {
      const x = tableX + 0.014 + c * (tableW - 0.028);
      const w = (0.05 + 0.05 * (((r * 3 + k * 5) % 7) / 6)) * (k === 0 ? 1.5 : 1);
      const at = 0.67 + r * 0.045 + k * 0.008;
      // последняя ячейка забирает остаток точек: ни одна не остаётся в начале координат
      const n = r === rows - 1 && k === cols.length - 1 ? left() : perCell;
      fill(n, x, y, w, 0.012, (px) => at + (px - x) * 0.1);
    });
  }
  return { positions: out, motion };
}

/** сколько круга заполнения занимает падение одной монеты */
export const DROP = 0.04;

/**
 * 2026. fatstack: приложение, которое считает, сколько у тебя денег в разных валютах.
 * Слева три стопки — три валюты. Монеты падают сверху по одной, оранжевые в полёте (вид 13),
 * и стопки растут. Справа телефон с приложением: крупное число, график, который растёт вместе
 * со стопками, и строки валют (вид 12). В конце круга всё гаснет и копится заново.
 */
export function stash(count: number) {
  const { rnd, put, out, left } = maker(count, 71);
  const { motion, mark } = motionOf(count, left);
  const share = (f: number) => Math.floor(count * f);
  const GROUND = -0.38;

  // стопки: центр x, z и сколько монет
  const stacks = [
    [-0.43, 0.06, 8], [-0.2, -0.05, 12], [-0.32, 0.25, 5],
  ];
  const R = 0.1, H = 0.036, GAP = 0.005;
  // очередь падения: стопки растут вперемешку, каждая снизу вверх и в своём темпе
  const queue = stacks.flatMap(([, , n], k) => Array.from({ length: n }, (_, c) => ({ k, c, at: (c + 0.5) / n + k * 0.013 })));
  queue.sort((u, v) => u.at - v.at);
  const START = 0.06, SPAN = 0.72;
  const perCoin = Math.floor(share(0.5) / queue.length);
  queue.forEach(({ k, c }, i) => {
    const [cx, cz] = stacks[k];
    const y = GROUND + c * (H + GAP);
    const offset = Math.sin(c * 1.7 + k) * 0.006;
    const order = START + (i / queue.length) * SPAN;
    for (let j = perCoin; j > 0; j--) {
      const a = rnd() * Math.PI * 2;
      if (rnd() < 0.55) put(cx + offset + Math.cos(a) * R, y + rnd() * H, cz + Math.sin(a) * R);
      else {
        const r = R * Math.sqrt(rnd());
        put(cx + offset + Math.cos(a) * r, y + H, cz + Math.sin(a) * r);
      }
      // размах — с какой высоты монета падает
      mark(13, order, 0, 0.42);
    }
  });

  // телефон: стоит справа, чуть повёрнут к стопкам и отклонён назад
  const PW = 0.36, PH = 0.74, CX = 0.3, CZ = 0.02, YAW = 0.3, LEAN = 0.1;
  const cy = Math.cos(YAW), sy = Math.sin(YAW), cl = Math.cos(LEAN), sl = Math.sin(LEAN);
  /** u — поперёк экрана от середины, v — вверх от низа, w — от экрана к зрителю */
  const at = (u: number, v: number, w: number) => {
    const depth = w * cl - v * sl;
    put(CX + u * cy + depth * sy, GROUND + v * cl + w * sl, CZ - u * sy + depth * cy);
  };
  /** контур прямоугольника со скруглёнными углами */
  const body = (n: number, w: number, inset = 0, corner = 0.045) => {
    const hw = PW / 2 - inset, hh = PH / 2 - inset, r = corner;
    const straight = (hw - r) * 4 + (hh - r) * 4, round = Math.PI * 2 * r;
    for (let i = n; i > 0; i--) {
      let t = rnd() * (straight + round);
      let u: number, v: number;
      if (t < straight) {
        const side = Math.floor(rnd() * 4);
        if (side < 2) {
          u = (rnd() * 2 - 1) * (hw - r);
          v = side ? hh : -hh;
        } else {
          u = side === 2 ? hw : -hw;
          v = (rnd() * 2 - 1) * (hh - r);
        }
      } else {
        t = rnd() * Math.PI * 2;
        u = Math.sign(Math.cos(t)) * (hw - r) + Math.cos(t) * r;
        v = Math.sign(Math.sin(t)) * (hh - r) + Math.sin(t) * r;
      }
      at(u + (rnd() - 0.5) * 0.003, v + PH / 2 + (rnd() - 0.5) * 0.003, w);
    }
  };
  /** точки внутри прямоугольника на экране; order — когда появляются, 0–1 */
  const block = (n: number, u: number, v: number, w: number, h: number, order?: (u: number, v: number) => number) => {
    for (let i = n; i > 0; i--) {
      const pu = u + rnd() * w, pv = v + rnd() * h;
      at(pu, pv, 0.012);
      if (order) mark(12, order(pu, pv), 0, 1);
    }
  };
  body(share(0.07), 0);
  body(share(0.05), -0.022);
  body(share(0.03), 0.004, 0.018, 0.032);
  // вырез динамика, подпись над числом, нижняя панель с четырьмя вкладками
  block(share(0.006), -0.04, PH - 0.05, 0.08, 0.008);
  block(share(0.006), -0.145, 0.628, 0.1, 0.008);
  for (let k = 0; k < 4; k++) block(share(0.005), -0.13 + k * 0.08, 0.035, 0.022, 0.022);
  // сколько всего: крупное число
  block(share(0.035), -0.145, 0.555, 0.2, 0.045, (pu) => 0.04 + (pu + 0.145) * 0.15);

  // график растёт вместе со стопками: слева направо за то же время, что падают монеты
  const knots = [0.1, 0.2, 0.16, 0.34, 0.3, 0.5, 0.46, 0.7, 0.64, 0.92];
  const curve = (t: number) => {
    const f = clampUnit(t) * (knots.length - 1);
    const k = Math.min(knots.length - 2, Math.floor(f));
    const u = f - k;
    return knots[k] + (knots[k + 1] - knots[k]) * u * u * (3 - 2 * u);
  };
  const gu = -0.145, gw = 0.29, gv = 0.3, gh = 0.22;
  for (let i = share(0.05); i > 0; i--) {
    const t = rnd();
    at(gu + t * gw, gv + curve(t) * gh + (rnd() - 0.5) * 0.007, 0.012);
    mark(12, START + t * SPAN, 0, 1);
  }
  for (let i = share(0.06); i > 0; i--) {
    const t = rnd();
    at(gu + t * gw, gv + rnd() * curve(t) * gh, 0.01);
    mark(12, START + 0.01 + t * SPAN, 0, 1);
  }

  // три валюты: кружок, название и сумма; сумма появляется, когда её стопка подросла
  const rows = [0.225, 0.165, 0.105];
  const perRow = Math.floor(left() / rows.length);
  rows.forEach((v, k) => {
    const last = k === rows.length - 1;
    const n = last ? left() : perRow;
    for (let i = Math.floor(n * 0.18); i > 0; i--) {
      const a = rnd() * Math.PI * 2, r = 0.013 * Math.sqrt(rnd());
      at(-0.132 + Math.cos(a) * r, v + 0.012 + Math.sin(a) * r, 0.012);
    }
    block(Math.floor(n * 0.3), -0.105, v + 0.006, 0.06 + 0.02 * k, 0.012);
    // остаток точек уходит в сумму последней строки: ни одна не остаётся в начале координат
    const amount = 0.1 - 0.02 * k;
    block(last ? left() : Math.floor(n * 0.5), 0.145 - amount, v + 0.003, amount, 0.018, (pu) => 0.3 + k * 0.22 + (pu - 0.145 + amount) * 0.3);
  });
  return { positions: out, motion };
}

/**
 * Форма с движением. У каждой точки (вид, фаза, скорость, размах), размах 0 — точка стоит.
 * Вид 0 и 1: едет вдоль x или z. Вид 2: качается вокруг шарнира. Вид 3: то же и цветная. Вид 4: подпрыгивает от удара.
 * Виды 5–10 — мольберт и документ под лупой, 11 — пакет данных на проводе, 12 — появляется в свой черёд
 * в круге заполнения (дашборд, экран телефона), 13 — монета падает на стопку.
 */
export type City = {
  positions: Float32Array;
  motion: Float32Array;
  solids: Solids;
};

/** Непрозрачные объёмы, за которыми точки прячутся. Высоты отсчитаны от ground. */
export type Solids = {
  ground: number;
  /** x, y0, y1, z, полуширина, полуглубина */
  boxes: Float32Array;
  /** x, y, z, радиусы по трём осям */
  balls?: Float32Array;
};

/**
 * 2021–2022. Citymobil: мини-город, по улицам которого едут такси.
 * Дома и разметка стоят, машины двигает шейдер. Смотрим сверху со стороны -x +z,
 * поэтому точки кладём только на видимые грани: стены -x и +z и крыши.
 */
export function city(count: number): City {
  const { rnd, put, out, left } = maker(count, 81);
  const motion = new Float32Array(count * 4);
  const S = 0.5;
  const Y0 = -0.17;
  const ROADS = [-0.25, 0, 0.25];
  const HALF = 0.04;
  const onRoad = (v: number) => ROADS.some((r) => Math.abs(v - r) < HALF);
  const BLOCKS = [
    [-S, ROADS[0] - HALF],
    [ROADS[0] + HALF, ROADS[1] - HALF],
    [ROADS[1] + HALF, ROADS[2] - HALF],
    [ROADS[2] + HALF, S],
  ];
  const PARK = [0, 3];

  // машины первыми: по две полосы на улицу, движение правостороннее, на полосе скорость одна
  // и машины идут с равным шагом, чтобы не проезжали друг сквозь друга
  const PER_CAR = 420;
  let index = 0;
  for (let axis = 0; axis < 2; axis++) {
    for (const road of ROADS) {
      for (const dir of [1, -1]) {
        const right = axis === 0 ? dir : -dir;
        const lane = road + right * 0.019;
        const speed = dir * (0.05 + rnd() * 0.035);
        const cars = 2 + Math.floor(rnd() * 2);
        const start = rnd() * 2 * S;
        for (let c = 0; c < cars; c++) {
          const phase = start + (c / cars) * 2 * S + rnd() * 0.05;
          for (let i = 0; i < PER_CAR; i++) {
            // кузов и кабина поменьше сверху
            const cabin = rnd() < 0.35;
            const along = (rnd() - 0.5) * (cabin ? 0.026 : 0.052);
            const across = (rnd() - 0.5) * (cabin ? 0.019 : 0.024);
            const up = cabin ? 0.013 + rnd() * 0.009 : rnd() * 0.013;
            put(axis === 0 ? along : lane + across, Y0 + 0.002 + up, axis === 0 ? lane + across : along);
            motion.set([axis, phase, speed, 2 * S], index * 4);
            index++;
          }
        }
      }
    }
  }

  // дорожная разметка и бордюры: улицы читаются как пустые полосы между кварталами
  const marks = Math.floor(count * 0.08);
  for (let i = 0; i < marks; i++) {
    const road = ROADS[Math.floor(rnd() * ROADS.length)];
    const along = (rnd() - 0.5) * 2 * S;
    if (onRoad(along)) continue;
    let off = (rnd() < 0.5 ? -1 : 1) * HALF;
    if (rnd() < 0.25) {
      if (Math.abs(along * 16) % 1 > 0.45) continue;
      off = 0;
    }
    if (rnd() < 0.5) put(along, Y0, road + off);
    else put(road + off, Y0, along);
  }

  // тротуары: редкая заливка кварталов
  const yards = Math.floor(count * 0.06);
  for (let i = 0; i < yards; i++) {
    const x = (rnd() - 0.5) * 2 * S;
    const z = (rnd() - 0.5) * 2 * S;
    if (!onRoad(x) && !onRoad(z)) put(x, Y0, z);
  }

  // парк: деревья рядами, чуть вразнобой
  const [px0, px1] = BLOCKS[PARK[0]];
  const [pz0, pz1] = BLOCKS[PARK[1]];
  const TREES = 5;
  for (let a = 0; a < TREES; a++) {
    for (let b = 0; b < TREES; b++) {
      const x = px0 + ((a + 0.5) / TREES) * (px1 - px0) + (rnd() - 0.5) * 0.012;
      const z = pz0 + ((b + 0.5) / TREES) * (pz1 - pz0) + (rnd() - 0.5) * 0.012;
      const r = 0.009 + rnd() * 0.006;
      for (let i = 0; i < 70; i++) {
        const u = rnd() * Math.PI * 2;
        const v = Math.acos(2 * rnd() - 1);
        put(x + r * Math.sin(v) * Math.cos(u), Y0 + r * 1.6 + r * 1.3 * Math.cos(v), z + r * Math.sin(v) * Math.sin(u));
      }
    }
  }

  // дома: в центре небоскрёбы, к краям низкая застройка, высокие с уступом
  type Box = { x: number; z: number; w: number; d: number; y0: number; y1: number };
  const boxes: Box[] = [];
  BLOCKS.forEach(([x0, x1], bx) => {
    BLOCKS.forEach(([z0, z1], bz) => {
      if (bx === PARK[0] && bz === PARK[1]) return;
      const cols = rnd() < 0.42 ? 2 : 1;
      const rows = rnd() < 0.42 ? 2 : 1;
      for (let a = 0; a < cols; a++) {
        for (let b = 0; b < rows; b++) {
          const lotW = (x1 - x0) / cols;
          const lotD = (z1 - z0) / rows;
          const x = x0 + (a + 0.5) * lotW;
          const z = z0 + (b + 0.5) * lotD;
          const w = lotW * (0.32 + rnd() * 0.1);
          const d = lotD * (0.32 + rnd() * 0.1);
          const downtown = Math.exp(-((x - 0.1) ** 2 + (z + 0.1) ** 2) / 0.09);
          const near = Math.max(0, Math.min(1, (z - x) / 0.6));
          const h = (0.05 + rnd() * 0.05 + downtown * (0.18 + rnd() * 0.3)) * (1 - near * 0.55);
          if (h > 0.24) {
            boxes.push({ x, z, w, d, y0: 0, y1: h * 0.66 });
            boxes.push({ x, z, w: w * 0.66, d: d * 0.66, y0: h * 0.66, y1: h });
          } else boxes.push({ x, z, w, d, y0: 0, y1: h });
        }
      }
    });
  });

  // рёбра держат форму, стены дают объём: -x в тени и с окнами, +z светлее с этажами
  const FLOOR = 0.024;
  const BAY = 0.022;
  const inWindow = (u: number, v: number) => {
    const fu = Math.abs(u / BAY) % 1;
    const fv = Math.abs(v / FLOOR) % 1;
    return fu > 0.22 && fu < 0.78 && fv > 0.28 && fv < 0.8;
  };
  const faces = boxes.flatMap((b) => {
    const h = b.y1 - b.y0;
    return [
      { b, kind: 0, weight: 2 * b.d * h * 1.25 },
      { b, kind: 1, weight: 2 * b.w * h * 0.42 },
      { b, kind: 2, weight: 4 * b.w * b.d * 0.05 },
      // контур крыши и три видимых вертикальных ребра
      { b, kind: 3, weight: (2 * b.w + 2 * b.d) * 0.024 },
      { b, kind: 4, weight: 3 * h * 0.024 },
    ];
  });
  const total = faces.reduce((a, f) => a + f.weight, 0);
  while (left() > 0) {
    let t = rnd() * total;
    let k = 0;
    while (k < faces.length - 1 && t > faces[k].weight) t -= faces[k++].weight;
    const { b, kind } = faces[k];
    const u = (rnd() - 0.5) * 2;
    const v = (rnd() - 0.5) * 2;
    const y = b.y0 + rnd() * (b.y1 - b.y0);
    if (kind === 2) put(b.x + u * b.w, Y0 + b.y1, b.z + v * b.d);
    else if (kind === 3) {
      if (rnd() < b.w / (b.w + b.d)) put(b.x + u * b.w, Y0 + b.y1, b.z + (rnd() < 0.5 ? -b.d : b.d));
      else put(b.x + (rnd() < 0.5 ? -b.w : b.w), Y0 + b.y1, b.z + v * b.d);
    } else if (kind === 4) {
      const edge = rnd();
      if (edge < 0.34) put(b.x - b.w, Y0 + y, b.z + b.d);
      else if (edge < 0.67) put(b.x - b.w, Y0 + y, b.z - b.d);
      else put(b.x + b.w, Y0 + y, b.z + b.d);
    } else {
      const along = (kind === 0 ? b.d : b.w) * u;
      if (kind === 0 ? inWindow(along + 10, y) && rnd() > 0.06 : Math.abs(y / FLOOR) % 1 > 0.5 && rnd() > 0.1) continue;
      if (kind === 0) put(b.x - b.w, Y0 + y, b.z + along);
      else put(b.x + along, Y0 + y, b.z + b.d);
    }
  }

  const solids = new Float32Array(boxes.length * 6);
  boxes.forEach((b, i) => solids.set([b.x, b.y0, b.y1, b.z, b.w, b.d], i * 6));
  return { positions: out, motion, solids: { boxes: solids, ground: Y0 } };
}

const LETTERS: Record<string, string[]> = {
  H: ["10001", "10001", "11111", "10001", "10001"],
  T: ["11111", "00100", "00100", "00100", "00100"],
  M: ["10001", "11011", "10101", "10001", "10001"],
  L: ["10000", "10000", "10000", "10000", "11111"],
};

/**
 * 2018. 12 Digital: джуниор. Малыш в полосатой кофте, как на портрете, сидит на полу с игрушечными
 * инструментами и колотит молотком по кубикам HTML. Рука с молотком качается вокруг плеча,
 * кубик подпрыгивает от удара. Тон задаёт плотность точек: как гравюра.
 */
export function toddler(count: number): { positions: Float32Array; motion: Float32Array; solids: Solids; pivot: [number, number] } {
  const { rnd, put, out, left } = maker(count, 12);
  const motion = new Float32Array(count * 4);
  const FLOOR = -0.43;
  const CX = -0.15;
  const BEAT = 4.2;
  const SWING = 0.82;
  // откуда смотрим: совпадает с наклоном и поворотом в Cloud
  const VIEW = [0.157, 0.139, 0.978];
  const LIGHT = [-0.5, 0.6, 0.62];
  const move = (m: [number, number, number, number]) => motion.set(m, (count - left() - 1) * 4);

  type Tone = (x: number, y: number, z: number, n: number[]) => number;
  type Ball = { x: number; y: number; z: number; rx: number; ry: number; rz: number; tone: Tone; solid: boolean };
  type Limb = { a: number[]; b: number[]; r1: number; r2: number; tone: Tone; solid: boolean };
  type Part = Ball | Limb;

  const shade = (n: number[]) => {
    const facing = Math.max(0, n[0] * VIEW[0] + n[1] * VIEW[1] + n[2] * VIEW[2]);
    const lit = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    return { rim: Math.pow(1 - facing, 2.6), lit };
  };
  const skin: Tone = (_x, _y, _z, n) => {
    const { rim, lit } = shade(n);
    return 0.035 + 0.13 * (1 - lit) ** 2 + 0.6 * rim;
  };
  const stripes = (along: (x: number, y: number, z: number) => number): Tone => (x, y, z, n) => {
    const { rim, lit } = shade(n);
    const dark = Math.abs(along(x, y, z) / 0.052) % 1 < 0.5;
    return (dark ? 0.72 + 0.2 * (1 - lit) : 0.05 + 0.1 * (1 - lit)) + 0.5 * rim;
  };

  // голова: лицо нарисовано тоном прямо на поверхности
  const HEAD = { x: CX, y: 0.135, z: 0.03, rx: 0.225, ry: 0.215, rz: 0.205 };
  const face: Tone = (x, y, z, n) => {
    const base = skin(x, y, z, n);
    if (z < HEAD.z) return base;
    const hx = (x - HEAD.x) / HEAD.rx - 0.08;
    const hy = (y - HEAD.y) / HEAD.ry;
    const side = Math.abs(hx);
    const eye = ((side - 0.36) / 0.115) ** 2 + ((hy + 0.03) / 0.145) ** 2;
    if (eye < 1) {
      const shine = ((side - 0.36 + (hx > 0 ? 0.035 : -0.035)) / 0.045) ** 2 + ((hy - 0.03) / 0.05) ** 2;
      return shine < 1 ? 0 : 1;
    }
    if (Math.abs(side - 0.36) < 0.15 && Math.abs(hy - (0.27 - 1.1 * (side - 0.36) ** 2)) < 0.024) return 0.95;
    if ((hx / 0.075) ** 2 + ((hy + 0.2) / 0.05) ** 2 < 1) return 0.5;
    const top = -0.33 + 0.55 * hx * hx;
    const bottom = -0.56 + 1.5 * hx * hx;
    if (side < 0.36 && hy < top && hy > bottom) {
      // единственный зуб
      if (Math.abs(hx - 0.06) < 0.05 && hy > top - 0.075) return 0.02;
      return 1;
    }
    const cheek = Math.exp(-(((side - 0.58) / 0.13) ** 2) - ((hy + 0.2) / 0.1) ** 2);
    return base + cheek * 0.16;
  };
  const shirt = stripes((_x, y) => y);
  const diaper: Tone = (_x, y, _z, n) => {
    const { rim, lit } = shade(n);
    if (Math.abs(y + 0.272) < 0.006) return 0.9;
    return 0.03 + 0.14 * (1 - lit) ** 2 + 0.7 * rim;
  };

  const parts: Part[] = [
    { ...HEAD, tone: face, solid: true },
    { x: CX - 0.222, y: 0.125, z: 0.015, rx: 0.033, ry: 0.05, rz: 0.028, tone: skin, solid: true },
    { x: CX + 0.222, y: 0.125, z: 0.015, rx: 0.033, ry: 0.05, rz: 0.028, tone: skin, solid: true },
    { x: CX, y: -0.19, z: 0, rx: 0.165, ry: 0.2, rz: 0.135, tone: shirt, solid: true },
    { x: CX, y: -0.335, z: 0.02, rx: 0.182, ry: 0.095, rz: 0.158, tone: diaper, solid: true },
  ];
  // ноги врозь, стопы торчат вверх
  const FOOT_L = [CX - 0.285, FLOOR + 0.05, 0.29];
  const FOOT_R = [CX + 0.19, FLOOR + 0.05, 0.3];
  parts.push(
    { a: [CX - 0.09, -0.365, 0.07], b: FOOT_L, r1: 0.065, r2: 0.048, tone: skin, solid: true },
    { a: [CX + 0.09, -0.365, 0.07], b: FOOT_R, r1: 0.065, r2: 0.048, tone: skin, solid: true },
    { x: FOOT_L[0] - 0.006, y: FOOT_L[1] + 0.03, z: FOOT_L[2] + 0.018, rx: 0.046, ry: 0.066, rz: 0.036, tone: skin, solid: true },
    { x: FOOT_R[0] + 0.006, y: FOOT_R[1] + 0.03, z: FOOT_R[2] + 0.018, rx: 0.046, ry: 0.066, rz: 0.036, tone: skin, solid: true },
  );

  // левая рука держит гаечный ключ
  const shoulderL = [CX - 0.15, -0.09, 0.04];
  const handL = [CX - 0.305, 0.005, 0.115];
  const sleeve = (from: number[], to: number[]) => {
    const span = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    return stripes((x, y, z) => ((x - from[0]) * (to[0] - from[0]) + (y - from[1]) * (to[1] - from[1]) + (z - from[2]) * (to[2] - from[2])) / span);
  };
  parts.push(
    { a: shoulderL, b: handL, r1: 0.052, r2: 0.044, tone: sleeve(shoulderL, handL), solid: true },
    { x: shoulderL[0], y: shoulderL[1], z: shoulderL[2], rx: 0.052, ry: 0.052, rz: 0.052, tone: sleeve(shoulderL, handL), solid: true },
    { x: handL[0], y: handL[1], z: handL[2], rx: 0.05, ry: 0.05, rz: 0.048, tone: skin, solid: true },
  );

  const isLimb = (part: Part): part is Limb => "a" in part;
  const surface = (part: Part) => {
    const angle = rnd() * Math.PI * 2;
    if (isLimb(part)) {
      // точка на боковой поверхности конуса, нормаль поперёк оси
      const axis = [part.b[0] - part.a[0], part.b[1] - part.a[1], part.b[2] - part.a[2]];
      const span = Math.hypot(axis[0], axis[1], axis[2]);
      axis[0] /= span;
      axis[1] /= span;
      axis[2] /= span;
      const up = Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const e1 = [axis[1] * up[2] - axis[2] * up[1], axis[2] * up[0] - axis[0] * up[2], axis[0] * up[1] - axis[1] * up[0]];
      const e1l = Math.hypot(e1[0], e1[1], e1[2]);
      const e2 = [axis[1] * e1[2] - axis[2] * e1[1], axis[2] * e1[0] - axis[0] * e1[2], axis[0] * e1[1] - axis[1] * e1[0]];
      const n = [0, 1, 2].map((i) => (Math.cos(angle) * e1[i] + Math.sin(angle) * e2[i]) / e1l);
      const t = rnd();
      const r = part.r1 + (part.r2 - part.r1) * t;
      const at = (i: number) => part.a[i] + axis[i] * span * t + n[i] * r;
      return { x: at(0), y: at(1), z: at(2), n };
    }
    const u = 2 * rnd() - 1;
    const r = Math.sqrt(1 - u * u);
    const ux = r * Math.cos(angle);
    const uz = r * Math.sin(angle);
    const nx = ux / part.rx;
    const ny = u / part.ry;
    const nz = uz / part.rz;
    const len = Math.hypot(nx, ny, nz);
    return { x: part.x + ux * part.rx, y: part.y + u * part.ry, z: part.z + uz * part.rz, n: [nx / len, ny / len, nz / len] };
  };
  const inside = (part: Part, p: { x: number; y: number; z: number }) => {
    if (isLimb(part)) {
      const d = [part.b[0] - part.a[0], part.b[1] - part.a[1], part.b[2] - part.a[2]];
      const t = Math.max(0, Math.min(1, ((p.x - part.a[0]) * d[0] + (p.y - part.a[1]) * d[1] + (p.z - part.a[2]) * d[2]) / (d[0] * d[0] + d[1] * d[1] + d[2] * d[2])));
      const r = part.r1 + (part.r2 - part.r1) * t;
      return Math.hypot(p.x - part.a[0] - d[0] * t, p.y - part.a[1] - d[1] * t, p.z - part.a[2] - d[2] * t) < r * 0.985;
    }
    return ((p.x - part.x) / part.rx) ** 2 + ((p.y - part.y) / part.ry) ** 2 + ((p.z - part.z) / part.rz) ** 2 < 0.985;
  };
  const area = (part: Part) => {
    if (isLimb(part)) return 2 * Math.PI * ((part.r1 + part.r2) / 2) * Math.hypot(part.b[0] - part.a[0], part.b[1] - part.a[1], part.b[2] - part.a[2]);
    return ((4 * Math.PI) / 3) * (part.rx * part.ry + part.ry * part.rz + part.rx * part.rz);
  };
  const pick = (list: Part[], total: number) => {
    let t = rnd() * total;
    let k = 0;
    while (k < list.length - 1 && t > area(list[k])) t -= area(list[k++]);
    return list[k];
  };
  const faces = (p: { n: number[] }) => p.n[0] * VIEW[0] + p.n[1] * VIEW[1] + p.n[2] * VIEW[2] > -0.08;

  // рука с молотком в момент удара; дальше её поднимает шейдер
  const PIVOT: [number, number] = [CX + 0.15, -0.09];
  const ANGLE = -0.33;
  const DIR = [Math.cos(ANGLE), Math.sin(ANGLE)];
  const PERP = [-DIR[1], DIR[0]];
  const Z = 0.045;
  const REACH = 0.47;
  const along = (d: number, side = 0) => [PIVOT[0] + DIR[0] * d + PERP[0] * side, PIVOT[1] + DIR[1] * d + PERP[1] * side];
  const swingArm: [number, number, number, number] = [2, 0, BEAT, SWING];
  const swingTool: [number, number, number, number] = [3, 0, BEAT, SWING];

  const hand = along(0.215);
  const shoulderR = [PIVOT[0], PIVOT[1], Z];
  const wrist = [hand[0], hand[1], Z];
  const arm: Part[] = [
    { a: shoulderR, b: wrist, r1: 0.052, r2: 0.044, tone: sleeve(shoulderR, wrist), solid: false },
    { x: PIVOT[0], y: PIVOT[1], z: Z, rx: 0.052, ry: 0.052, rz: 0.052, tone: sleeve(shoulderR, wrist), solid: false },
    { x: hand[0], y: hand[1], z: Z + 0.004, rx: 0.052, ry: 0.052, rz: 0.05, tone: skin, solid: false },
  ];
  const armArea = arm.reduce((a, b) => a + area(b), 0);
  let armPoints = 0;
  for (let tries = 0; armPoints < 8000 && tries < 300000; tries++) {
    const part = pick(arm, armArea);
    const p = surface(part);
    if (!faces(p) || arm.some((o) => o !== part && inside(o, p)) || rnd() > part.tone(p.x, p.y, p.z, p.n)) continue;
    put(p.x, p.y, p.z);
    move(swingArm);
    armPoints++;
  }

  // молоток: ручка и боёк поперёк неё
  for (let i = 0; i < 1500; i++) {
    const d = 0.17 + rnd() * (REACH - 0.17);
    const a = rnd() * Math.PI * 2;
    const [x, y] = along(d, Math.cos(a) * 0.012);
    put(x, y, Z + Math.sin(a) * 0.012);
    move(swingTool);
  }
  const A = 0.042;
  const B = 0.078;
  const C = 0.042;
  for (let i = 0; i < 5200; i++) {
    let a = (rnd() * 2 - 1) * A;
    let b = (rnd() * 2 - 1) * B;
    let c = (rnd() * 2 - 1) * C;
    const f = rnd();
    if (f < 0.42) c = C;
    else if (f < 0.72) a = a > 0 ? A : -A;
    else if (f < 0.9) b = b > 0 ? B : -B;
    else c = -C;
    const [x, y] = along(REACH + a, b);
    put(x, y, Z + c);
    move(swingTool);
  }

  // кубики HTML: боёк в момент удара опускается на верх M
  const SIZE = 0.058;
  const strike = along(REACH, -B);
  const boxes: number[][] = [];
  ["H", "T", "M", "L"].forEach((letter, i) => {
    const x = strike[0] + (i - 2) * (SIZE * 2 + 0.008);
    const y0 = strike[1] - SIZE * 2;
    const hit = letter === "M";
    boxes.push([x, y0 - FLOOR, y0 - FLOOR + SIZE * 2, Z, SIZE, SIZE]);
    const put2 = (px: number, py: number, pz: number) => {
      put(px, py, pz);
      if (hit) move([4, 0, BEAT, 0.02]);
    };
    const ink = (u: number, v: number) => {
      const col = Math.floor(((u + 0.66) / 1.32) * 5);
      const row = Math.floor(((0.66 - v) / 1.32) * 5);
      return col >= 0 && col < 5 && row >= 0 && row < 5 && LETTERS[letter][row][col] === "1";
    };
    const edge = (u: number, v: number) => Math.abs(u) > 0.95 || Math.abs(v) > 0.95;
    for (let n = 0; n < 3600; n++) {
      const u = rnd() * 2 - 1;
      const v = rnd() * 2 - 1;
      if (rnd() < (ink(u, v) ? 1 : edge(u, v) ? 0.9 : 0.05)) put2(x + u * SIZE, y0 + SIZE + v * SIZE, Z + SIZE);
    }
    for (let n = 0; n < 1100; n++) {
      const u = rnd() * 2 - 1;
      const v = rnd() * 2 - 1;
      if (rnd() < (edge(u, v) ? 1 : 0.12)) put2(x + u * SIZE, y0 + SIZE * 2, Z + v * SIZE);
    }
    for (let n = 0; n < 1100; n++) {
      const u = rnd() * 2 - 1;
      const v = rnd() * 2 - 1;
      if (rnd() < (edge(u, v) ? 0.9 : 0.42)) put2(x + SIZE, y0 + SIZE + v * SIZE, Z + u * SIZE);
    }
  });

  // гаечный ключ в левой руке: плоская ручка и зев с прорезью
  const KEY = [handL[0] - 0.012, handL[1] - 0.06];
  const KEY_DIR = [0.13, 0.99];
  const KEY_SIDE = [KEY_DIR[1], -KEY_DIR[0]];
  const KEY_Z = handL[2] + 0.01;
  const KEY_LEN = 0.3;
  for (let i = 0; i < 3200; i++) {
    const d = rnd() * KEY_LEN;
    const w = (rnd() * 2 - 1) * 0.019;
    put(KEY[0] + KEY_DIR[0] * d + KEY_SIDE[0] * w, KEY[1] + KEY_DIR[1] * d + KEY_SIDE[1] * w, KEY_Z);
  }
  const JAW = [KEY[0] + KEY_DIR[0] * (KEY_LEN + 0.03), KEY[1] + KEY_DIR[1] * (KEY_LEN + 0.03)];
  for (let i = 0; i < 3400; i++) {
    const a = rnd() * Math.PI * 2;
    if (Math.abs(a - Math.PI * 0.42) < 0.55) continue;
    const r = 0.03 + rnd() * 0.03;
    put(JAW[0] + Math.cos(a) * r, JAW[1] + Math.sin(a) * r, KEY_Z);
  }

  // отвёртка на полу перед кубиками
  const TOOL = [strike[0] - 0.2, FLOOR + 0.018, 0.27];
  const TOOL_DIR = [0.96, 0.28];
  for (let i = 0; i < 3000; i++) {
    const a = rnd() * Math.PI * 2;
    const handle = rnd() < 0.72;
    const d = handle ? rnd() * 0.085 : 0.085 + rnd() * 0.15;
    const r = handle ? 0.018 : 0.0045;
    const off = Math.cos(a) * r;
    put(TOOL[0] + TOOL_DIR[0] * d - TOOL_DIR[1] * off, TOOL[1] + Math.sin(a) * r, TOOL[2] + TOOL_DIR[1] * d + TOOL_DIR[0] * off);
  }

  // хохолок на макушке
  for (let strand = 0; strand < 7; strand++) {
    const lean = (strand - 3) / 3;
    const rootX = HEAD.x + lean * 0.05;
    const rootY = HEAD.y + HEAD.ry - 0.004;
    const tipX = rootX + lean * 0.075 + 0.015;
    const tipY = rootY + 0.07 - Math.abs(lean) * 0.022;
    const bend = lean * 0.035 - 0.012;
    for (let i = 0; i < 260; i++) {
      const t = rnd();
      const x = (1 - t) ** 2 * rootX + 2 * t * (1 - t) * (rootX + bend) + t * t * tipX;
      const y = (1 - t) ** 2 * rootY + 2 * t * (1 - t) * (tipY + 0.012) + t * t * tipY;
      put(x + (rnd() - 0.5) * 0.004, y + (rnd() - 0.5) * 0.004, HEAD.z + (rnd() - 0.5) * 0.01);
    }
  }

  // тело забирает всё, кроме запаса на пол: плотность выходит сама
  const shadow = 5000;
  const total = parts.reduce((a, b) => a + area(b), 0);
  while (left() > shadow) {
    const part = pick(parts, total);
    const p = surface(part);
    if (!faces(p) || parts.some((o) => o !== part && inside(o, p)) || rnd() > part.tone(p.x, p.y, p.z, p.n)) continue;
    put(p.x, p.y, p.z);
  }

  // пол: тень под малышом, плотнее к центру
  while (left() > 0) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(-2 * Math.log(1 - rnd() * 0.98));
    put(CX + 0.03 + Math.cos(a) * r * 0.2, FLOOR, 0.12 + Math.sin(a) * r * 0.13);
  }

  // объём конечности — цепочка шаров
  const occluders = parts.flatMap((part) => {
    if (!isLimb(part)) return [[part.x, part.y - FLOOR, part.z, part.rx, part.ry, part.rz]];
    return Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      const r = part.r1 + (part.r2 - part.r1) * t;
      return [part.a[0] + (part.b[0] - part.a[0]) * t, part.a[1] + (part.b[1] - part.a[1]) * t - FLOOR, part.a[2] + (part.b[2] - part.a[2]) * t, r, r, r];
    });
  });
  const ballData = new Float32Array(occluders.flat());
  return { positions: out, motion, pivot: PIVOT, solids: { ground: FLOOR, boxes: new Float32Array(boxes.flat()), balls: ballData } };
}
