import * as THREE from "three";

// Общее для всей сцены: цвет бумаги в точке экрана (шторка между остановками) и то,
// где сейчас стоит предмет. Точки, барабан и чипы смотрят в одни и те же значения.

// Переход между остановками — полутон: новый цвет приходит справа, оттуда же, откуда
// приезжает заголовок. Экран поделён на ячейки, в каждой растёт точка, пока они не сольются.
export const COMMON = /* glsl */ `
  uniform vec2 uCenter, uScreen;
  uniform float uProgress, uCell, uPolA, uPolB;
  /** 0 — тёмный фон в этой точке экрана, 1 — светлый */
  float paperAt(vec2 frag) {
    vec2 cell = (floor(frag / uCell) + 0.5) * uCell;
    float sweep = 0.82 * (1.0 - cell.x / uScreen.x) + 0.18 * (cell.y / uScreen.y);
    float grow = clamp((uProgress - sweep * 0.62) / 0.38, 0.0, 1.0);
    float r = grow * grow * (3.0 - 2.0 * grow) * uCell * 0.74;
    float inside = 1.0 - smoothstep(r - 1.0, r + 1.0, distance(frag, cell));
    return mix(uPolA, uPolB, inside);
  }
`;
export const INK = "vec3(0.047, 0.047, 0.051)";
export const PAPER = "vec3(0.953, 0.953, 0.941)";
export const ORANGE = "vec3(1.0, 0.45, 0.06)";

export type Wipe = {
  /** центр предмета на экране: оттуда вспышка при входе */
  uCenter: { value: THREE.Vector2 };
  uScreen: { value: THREE.Vector2 };
  /** 0 — старый цвет, 1 — новый залил весь экран */
  uProgress: { value: number };
  uCell: { value: number };
  uPolA: { value: number };
  uPolB: { value: number };
};

/** Раскладка экрана. wide — текст колонками по бокам от сцены; low — то же на низком экране
 * (телефон боком); tall и phone — сцена сверху, текст под ней: на планшете в две колонки,
 * на телефоне в одну. Те же границы стоят в медиа-запросах dots.module.css. */
export type Mode = "wide" | "low" | "tall" | "phone";
export const modeOf = (width: number, height: number): Mode =>
  width * 5 <= height * 6 ? (width < 600 ? "phone" : "tall") : height <= 520 ? "low" : "wide";
export const stacked = (mode: Mode) => mode === "phone" || mode === "tall";

/** сцена от макушки предмета до низа заголовка, в масштабах предмета; центр предмета в 0.6 от верха */
const SCENE_HEIGHT = 1.4;

/** Сцена сверху: от какой доли высоты экрана до какой она стоит, остальное — тексту.
 * На невысоких экранах тексту нужна большая доля, и сцена ужимается. */
function sceneZone(mode: "phone" | "tall", height: number): [number, number] {
  if (mode === "phone") return height < 620 ? [0.08, 0.5] : [0.07, 0.55];
  return height < 900 ? [0.07, 0.53] : [0.065, 0.555];
}

/** Какую долю ширины экрана оставляют сцене колонки текста по бокам. */
export function between(mode: Mode, width: number) {
  const gutter = Math.min(28, Math.max(16, width * 0.02));
  const column = mode === "low" ? Math.min(width * 0.26, 240) : Math.min(width * 0.25, 360);
  return 1 - (2 * (gutter + column)) / width;
}

/** камера стоит на этом расстоянии от сцены (Canvas в DotsStory) */
const EYE = 2.5;
/** барабан на широком экране: наклон, радиус и высота пола в масштабах предмета; диск шире барабана и имеет толщину */
export const TILT = 0.11;
export const DRUM_RADIUS = 1.15;
export const DRUM_FLOOR = 0.49;
export const DISC_RADIUS = 1.16;
export const DISC_HEIGHT = 0.07;
/** линия хронологии от низа экрана и зазор над ней, в пикселях */
const RAIL_LINE = 72;
const RAIL_GAP = 26;

/** Где стоит сцена: высота центра предмета и его наибольший масштаб, в единицах мира. */
export function frameOf(mode: Mode, width: number, height: number, halfWidth: number, halfHeight: number) {
  if (mode === "phone" || mode === "tall") {
    const [top, bottom] = sceneZone(mode, height);
    const zone = (bottom - top) * 2 * halfHeight;
    const scale = Math.min(1, zone / SCENE_HEIGHT, (halfWidth * 0.96) / 0.62);
    // если по ширине предмет меньше, чем позволяет высота, сцена стоит посередине своей зоны
    const head = halfHeight * (1 - 2 * top) - (zone - scale * SCENE_HEIGHT) / 2;
    return { y: head - 0.6 * scale, scale };
  }
  // текст по бокам: предмет вместе с чипами помещается между колонками
  const free = halfWidth * (between(mode, width) - 24 / width);
  const y = halfHeight * (mode === "low" ? 0.2 : 0.15);
  let scale = Math.min(1, (halfHeight * 0.6) / 0.62, free / 0.72);
  if (mode === "wide") {
    // Диск не касается линии хронологии: между его нижним краем и линией остаётся зазор.
    // На невысоком экране сцена для этого чуть уменьшается, а не поднимается: поднятый диск
    // заезжал под правую колонку текста. Нижняя точка диска — его передний край: он ближе
    // к камере и потому ниже всего на экране
    const tan = halfHeight / EYE;
    const floorNdc = -(1 - (2 * (RAIL_LINE + RAIL_GAP)) / height);
    const edge = DRUM_RADIUS * DISC_RADIUS;
    const drop = DRUM_FLOOR + edge * Math.sin(TILT) + DRUM_RADIUS * DISC_HEIGHT * Math.cos(TILT);
    scale = Math.min(scale, (y - floorNdc * EYE * tan) / (drop - floorNdc * edge * Math.cos(TILT) * tan));
  }
  return { y, scale };
}

export type Stage = {
  wipe: Wipe;
  /** центр предмета и его масштаб: барабан и чипы держатся за него */
  x: number;
  y: number;
  scale: number;
  /** плавная остановка, целое число — предмет собран */
  smooth: number;
  mode: Mode;
  /** где на барабане стоит заголовок текущей остановки: отсюда вылетают чипы */
  slot: THREE.Vector3;
  titleWidth: number;
  /** 0 — сайт ещё входит, 1 — вошёл: буквы и пол появляются после взрыва */
  intro: number;
  /** сколько частей сцены собрано: точки, барабан, чипы. Когда все три — шейдеры греются заранее */
  parts: number;
  /** поворот барабана: за ним медленнее поворачивается фон */
  spin: number;
  /** какая доля точек рисуется: меньше единицы, если устройство не успевает за кадрами (Scene.tsx) */
  keep: number;
};

export const createStage = (): Stage => ({
  wipe: { uCenter: { value: new THREE.Vector2() }, uScreen: { value: new THREE.Vector2(1, 1) }, uProgress: { value: 0 }, uCell: { value: 24 }, uPolA: { value: 0 }, uPolB: { value: 0 } },
  x: 0,
  y: 0,
  scale: 1,
  smooth: 0,
  mode: "wide",
  slot: new THREE.Vector3(),
  titleWidth: 0.5,
  intro: 0,
  parts: 0,
  spin: 0,
  keep: 1,
});

/** Курсор ловится коробкой вокруг геометрии, а не тысячами треугольников; запас делает мелкое легче схватить. */
const inverse = new THREE.Matrix4();
const local = new THREE.Ray();
const point = new THREE.Vector3();
export function boxHit(this: THREE.Mesh, raycaster: THREE.Raycaster, hits: THREE.Intersection[]) {
  const box = this.userData.hitBox ?? this.geometry.boundingBox;
  if (!box) return;
  inverse.copy(this.matrixWorld).invert();
  local.copy(raycaster.ray).applyMatrix4(inverse);
  if (!local.intersectBox(box, point)) return;
  point.applyMatrix4(this.matrixWorld);
  hits.push({ distance: raycaster.ray.origin.distanceTo(point), point: point.clone(), object: this });
}
