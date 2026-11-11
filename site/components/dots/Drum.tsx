"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Font, type FontData } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { CHAPTERS, EMAIL, INTRO } from "@/lib/story";
import { track, trackOnce } from "@/lib/analytics";
import { between, boxHit, COMMON, DISC_HEIGHT, DISC_RADIUS, DRUM_FLOOR, DRUM_RADIUS, INK, PAPER, stacked, TILT, type Stage } from "./paper";
import type { Shared } from "./Cloud";

// Барабан — толстый диск, на котором стоит предмет. По краю стоят заголовки из толстых букв, каждая буква —
// отдельная фигура. Скролл крутит барабан: новый заголовок приезжает справа по кругу,
// буквы вырастают из пола по очереди, прошлый уезжает влево и уходит в пол.

/** знак «скопировать» после почты: в шрифте его нет, фигуру строит linkGeometry */
const COPY = "\u29C9";
const COPY_ADVANCE = 1.02;
// на последней остановке заголовок — сама почта и знак копирования после неё: строка длинная,
// кегль подбирается по ширине сам
export const TITLES = [INTRO.name, ...CHAPTERS.map((c) => c.place), `${EMAIL} ${COPY}`].map((t) => t.toUpperCase());

/** Два звена цепи той же толщины, что штрихи букв: стоят на строке, высотой с прописную. */
function linkGeometry(options: THREE.ExtrudeGeometryOptions) {
  const L = 0.64, W = 0.46, T = 0.155;
  const pill = <P extends THREE.Path>(target: P, cx: number, length: number, wide: number) => {
    const r = wide / 2, h = length / 2 - r;
    target.moveTo(cx - h, -r);
    target.lineTo(cx + h, -r);
    target.absarc(cx + h, 0, r, -Math.PI / 2, Math.PI / 2, false);
    target.lineTo(cx - h, r);
    target.absarc(cx - h, 0, r, Math.PI / 2, Math.PI * 1.5, false);
    return target;
  };
  const ring = (cx: number) => {
    const shape = pill(new THREE.Shape(), cx, L, W);
    shape.holes.push(pill(new THREE.Path(), cx, L - 2 * T, W - 2 * T));
    return shape;
  };
  const geometry = new THREE.ExtrudeGeometry([ring(-0.2), ring(0.2)], options);
  geometry.rotateZ(Math.PI / 4);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const k = 0.92 / (box.max.y - box.min.y);
  geometry.scale(k, k, 1);
  // как у букв: левый край на нуле с отступом, низ на строке
  geometry.translate(COPY_ADVANCE / 2 - ((box.min.x + box.max.x) / 2) * k, -box.min.y * k, 0);
  return geometry;
}

/** на сколько поворачивается барабан между остановками */
const STEP = 1.75;
/** толщина буквы в долях кегля: буквы стоят как скульптуры */
const DEPTH = 0.42;
/** насколько дугой может загибаться заголовок по краю барабана */
const ARC = 1.45;
const STAGGER = 0.55;
/** тяготение, в высотах прыжка в секунду за секунду: буквы тяжёлые и падают быстро */
const GRAVITY = 85;
/** скорость, ниже которой буква после удара больше не отскакивает */
const REST = 1.2;
/** буква на опоре: с какой силой вес валит её на грань, вязкость, толчок от курсора
 * и сколько вращения остаётся после удара гранью об опору */
const TIP = 22;
const ROCK_C = 2.6;
const ROCK_PUSH = 1.9;
const THUD = 0.5;
/** буква в руке висит на точке захвата как маятник: жёсткость и вязкость */
const HANG_K = 46;
const HANG_C = 4.2;
const { clamp, damp, smoothstep } = THREE.MathUtils;
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const noHit = () => {};
const corner = new THREE.Vector3();

const VERTEX = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// лицо буквы цвета точек, бока темнее или светлее к фону, чтобы читался объём
const FRAGMENT = /* glsl */ `
  ${COMMON}
  uniform float uSide;
  varying vec3 vNormal;
  void main() {
    float paper = paperAt(gl_FragCoord.xy);
    vec3 bg = mix(${INK}, ${PAPER}, paper);
    vec3 fg = mix(${PAPER}, ${INK}, paper);
    float light = clamp(dot(normalize(vNormal), normalize(vec3(-0.45, 0.7, 0.55))), 0.0, 1.0);
    vec3 side = mix(bg, fg, 0.16 + 0.6 * light);
    gl_FragColor = vec4(mix(fg, side, uSide), 1.0);
  }
`;
const RING_VERTEX = /* glsl */ `
  uniform float uSize, uAlpha;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize / -mv.z;
    vAlpha = aAlpha * uAlpha;
  }
`;
const RING_FRAGMENT = /* glsl */ `
  ${COMMON}
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float paper = paperAt(gl_FragCoord.xy);
    gl_FragColor = vec4(mix(${PAPER}, ${INK}, paper), vAlpha * (1.0 - smoothstep(0.3, 0.5, d)));
  }
`;

type Letter = {
  mesh: THREE.Mesh;
  /** середина буквы вдоль заголовка, в кеглях */
  at: number;
  hop: number;
  hopVel: number;
  /** поворот в своей плоскости: 0 — стоит, четверть оборота — лежит на боку. Буква качается,
   * когда её толкнули, висит на точке, за которую взяли, и ложится, если упала на ребро */
  roll: number;
  rollVel: number;
  /** вокруг какой точки буквы она сейчас поворачивается, в кеглях: нижняя вершина, если стоит
   * на опоре, точка под курсором, если в руке, середина, если летит */
  pivot: THREE.Vector2;
  /** касается опоры: тогда её тянет лечь на ближайшую устойчивую грань */
  grounded: boolean;
  /** как была повёрнута и на какой высоте, когда её взяли: пока не подняли, так и держится */
  poise: number;
  from: number;
  /** куда букву переставили, на полу барабана; пока null — стоит на своём месте в заголовке */
  free: THREE.Vector2 | null;
  /** куда её сейчас тянут (по полу и по высоте), за какую точку взяли и держат ли */
  aim: THREE.Vector2;
  aimHop: number;
  grab: THREE.Vector3;
  held: boolean;
  /** как была повёрнута, когда взяли: в руке и на новом месте так и стоит */
  turn: number;
  /** наклон вперёд-назад в руке, от скорости */
  lean: THREE.Vector2;
  /** буква почты: клик по ней копирует адрес; copy — сам знак копирования */
  mail?: boolean;
  copy?: boolean;
};
type Title = { group: THREE.Group; letters: Letter[]; width: number };

type Foot = { cx: number; cz: number; ax: [number, number]; az: [number, number]; hw: number; hd: number; y0: number; top: number };

const QUARTER = Math.PI / 2;
/** разница углов по кратчайшей дуге */
const wrap = (a: number) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;

type Shape2 = { hull: [number, number][]; com: [number, number] };

/** Выпуклый контур буквы спереди и его центр тяжести, в кеглях: по ним считается, чем буква
 * касается опоры и куда её тянет лечь. Обход против часовой стрелки. */
function shapeOf(geometry: THREE.BufferGeometry): Shape2 {
  const at = geometry.attributes.position;
  const seen = new Map<string, [number, number]>();
  for (let i = 0; i < at.count; i++) {
    const x = Math.round(at.getX(i) * 200) / 200, y = Math.round(at.getY(i) * 200) / 200;
    seen.set(`${x},${y}`, [x, y]);
  }
  const pts = [...seen.values()].sort((u, v) => u[0] - v[0] || u[1] - v[1]);
  const turn = (o: number[], u: number[], v: number[]) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
  const half = (list: [number, number][]) => {
    const out: [number, number][] = [];
    for (const q of list) {
      while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], q) <= 1e-7) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  const hull = [...half(pts), ...half([...pts].reverse())];
  let area = 0, cx = 0, cy = 0;
  hull.forEach((u, i) => {
    const v = hull[(i + 1) % hull.length];
    const w = u[0] * v[1] - v[0] * u[1];
    area += w;
    cx += (u[0] + v[0]) * w;
    cy += (u[1] + v[1]) * w;
  });
  return { hull, com: [cx / (3 * area), cy / (3 * area)] };
}

/** Чем буква считается для физики. В строю заголовка — ровный блок по габаритам: его можно
 * качнуть, но он не падает, заголовок остаётся читаемым. Буква, которую брали в руки, — свой
 * настоящий контур: «A» ложится на наклонный бок, «O» катится. */
function bodyOf(l: Letter): Shape2 {
  const geometry = l.mesh.geometry;
  if (l.free) return geometry.userData.shape as Shape2;
  const bb = geometry.boundingBox!;
  return (geometry.userData.block ??= {
    hull: [[bb.min.x, 0], [bb.max.x, 0], [bb.max.x, bb.max.y], [bb.min.x, bb.max.y]],
    com: [(bb.min.x + bb.max.x) / 2, bb.max.y / 2],
  }) as Shape2;
}

/** Где оказывается точка буквы (x, y в кеглях), когда буква повёрнута на roll вокруг своей опоры.
 * Отсчёт от места, где стояла бы её середина основания, не будь поворота. */
function placed(l: Letter, x: number, y: number): [number, number] {
  const c = Math.cos(l.roll), s = Math.sin(l.roll);
  const dx = x - l.pivot.x, dy = y - l.pivot.y;
  return [l.pivot.x + c * dx - s * dy, l.pivot.y + s * dx + c * dy];
}

/** Габариты повёрнутой буквы и вершина, на которую она опирается. Если внизу сразу несколько
 * вершин (буква лежит на грани), опора — крайняя с той стороны, куда буква поворачивается,
 * а в покое — ближайшая к центру тяжести. */
function span(l: Letter) {
  const { hull, com } = bodyOf(l);
  const c = Math.cos(l.roll), s = Math.sin(l.roll), px = l.pivot.x, py = l.pivot.y;
  const comX = px + c * (com[0] - px) - s * (com[1] - py);
  let s0 = Infinity, s1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of hull) {
    const sx = px + c * (x - px) - s * (y - py), sy = py + s * (x - px) + c * (y - py);
    if (sx < s0) s0 = sx;
    if (sx > s1) s1 = sx;
    if (sy < y0) y0 = sy;
    if (sy > y1) y1 = sy;
  }
  let low = 0, best = Infinity;
  hull.forEach(([x, y], i) => {
    if (py + s * (x - px) + c * (y - py) > y0 + 2e-3) return;
    const sx = px + c * (x - px) - s * (y - py);
    const off = Math.abs(l.rollVel) > 0.05 ? sx * Math.sign(l.rollVel) : Math.abs(sx - comX);
    if (off < best) {
      best = off;
      low = i;
    }
  });
  return { s0, s1, y0, y1, low, comX };
}

/** Опора сменилась, а буква остаётся где была: сдвигается место, от которого она отсчитана. */
function repivot(l: Letter, x: number, y: number, size: number, unit: number, angle: number) {
  const dx = l.pivot.x - x, dy = l.pivot.y - y;
  if (Math.abs(dx) < 1e-5 && Math.abs(dy) < 1e-5) return false;
  const c = Math.cos(l.roll), s = Math.sin(l.roll);
  l.pivot.set(x, y);
  l.hop += ((dy - (s * dx + c * dy)) * size) / unit;
  if (!l.free) return true;
  const along = (dx - (c * dx - s * dy)) * size;
  l.free.x += along * Math.cos(angle);
  l.free.y -= along * Math.sin(angle);
  return true;
}

/** След буквы на полу: повёрнутый прямоугольник по её габаритам, плюс от какой высоты до какой она стоит. */
function footprint(l: Letter, x: number, z: number, angle: number, size: number, unit: number, grown: number): Foot {
  const bb = l.mesh.geometry.boundingBox!;
  const c = Math.cos(angle), s = Math.sin(angle);
  const e = span(l);
  const ox = ((e.s0 + e.s1) / 2) * size;
  const y0 = l.hop * unit + e.y0 * size;
  return {
    cx: x + c * ox,
    cz: z - s * ox,
    ax: [c, -s],
    az: [s, c],
    hw: ((e.s1 - e.s0) / 2) * size * 0.92,
    hd: ((bb.max.z - bb.min.z) / 2) * size * 0.92,
    y0,
    top: y0 + (e.y1 - e.y0) * size * Math.max(grown, 0.002),
  };
}

/** Пересекаются ли следы: разделяющей оси нет ни среди сторон первого, ни среди сторон второго. */
function overlap(a: Foot, b: Foot) {
  const dx = b.cx - a.cx, dz = b.cz - a.cz;
  for (const [ux, uz] of [a.ax, a.az, b.ax, b.az]) {
    const reach = (f: Foot) => f.hw * Math.abs(f.ax[0] * ux + f.ax[1] * uz) + f.hd * Math.abs(f.az[0] * ux + f.az[1] * uz);
    if (reach(a) + reach(b) <= Math.abs(dx * ux + dz * uz)) return false;
  }
  return true;
}

/** Насколько сдвинуть первый след по x, чтобы он разошёлся со вторым: по ближайшей стороне. */
function sideways(a: Foot, b: Foot) {
  const dx = b.cx - a.cx, dz = b.cz - a.cz;
  let best = Infinity, shift = 0;
  for (const [ux, uz] of [a.ax, a.az, b.ax, b.az]) {
    if (Math.abs(ux) < 0.05) continue;
    const reach = (f: Foot) => f.hw * Math.abs(f.ax[0] * ux + f.ax[1] * uz) + f.hd * Math.abs(f.az[0] * ux + f.az[1] * uz);
    const dist = dx * ux + dz * uz;
    const need = (reach(a) + reach(b) - Math.abs(dist)) / Math.abs(ux);
    if (need < best) {
      best = need;
      shift = (dist > 0 ? -1 : 1) * Math.sign(ux) * need;
    }
  }
  return shift;
}

const backOut = (t: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

// Барабан — толстый диск. Верх почти цвета фона, чтобы буквы и предмет на нём не терялись,
// бок освещён, как бока букв, по кромке верха идёт светлая линия: по ней диск и читается
const DISC_VERTEX = /* glsl */ `
  varying vec3 vNormal, vLocal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const DISC_FRAGMENT = /* glsl */ `
  ${COMMON}
  uniform float uAlpha;
  varying vec3 vNormal, vLocal;
  void main() {
    float paper = paperAt(gl_FragCoord.xy);
    vec3 bg = mix(${INK}, ${PAPER}, paper);
    vec3 fg = mix(${PAPER}, ${INK}, paper);
    float r = length(vLocal.xz);
    float top = step(0.499, vLocal.y);
    float light = clamp(dot(normalize(vNormal), normalize(vec3(-0.45, 0.7, 0.55))), 0.0, 1.0);
    // кромка в одну линию, толщиной в пару пикселей на любом расстоянии
    float rim = 1.0 - smoothstep(0.0, fwidth(r) * 2.0, 1.0 - r);
    vec3 face = mix(bg, fg, 0.055 + rim * 0.5);
    vec3 side = mix(bg, fg, 0.08 + 0.24 * light);
    // на входе диск проявляется из цвета фона
    gl_FragColor = vec4(mix(bg, mix(side, face, top), uAlpha), 1.0);
  }
`;

/** Два тонких кольца из точек на верху диска: внутри заголовка и у самого предмета. */
function ringPoints() {
  const pos: number[] = [];
  const alpha: number[] = [];
  const ring = (r: number, n: number, a: number) => {
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      // чуть над верхом диска, иначе точки и диск спорят за глубину и рябят
      pos.push(Math.sin(t) * r, 0.004, Math.cos(t) * r);
      alpha.push(a);
    }
  };
  ring(0.55, 260, 0.3);
  ring(0.78, 380, 0.42);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alpha, 1));
  return geometry;
}

export function Drum({ shared, stage }: { shared: RefObject<Shared>; stage: Stage }) {
  const [titles, setTitles] = useState<Title[] | null>(null);
  const still = useRef(false);
  const sim = useRef({ spin: 0, tilt: TILT, radius: 0 });

  const tilt = useMemo(() => new THREE.Group(), []);
  const spin = useMemo(() => new THREE.Group(), []);
  const materials = useMemo(() => {
    const make = (side: number) =>
      new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms: { ...stage.wipe, uSide: { value: side } } });
    return [make(0), make(1)];
  }, [stage]);
  const ring = useMemo(() => {
    const points = new THREE.Points(
      ringPoints(),
      new THREE.ShaderMaterial({
        vertexShader: RING_VERTEX,
        fragmentShader: RING_FRAGMENT,
        uniforms: { ...stage.wipe, uSize: { value: 4 }, uAlpha: { value: 0 } },
        transparent: true,
        depthWrite: false,
      }),
    );
    points.frustumCulled = false;
    return points;
  }, [stage]);
  const disc = useMemo(() => {
    // единичный цилиндр: радиус 1, верх на y = 0.5; размеры задаёт масштаб
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 128, 1),
      new THREE.ShaderMaterial({ vertexShader: DISC_VERTEX, fragmentShader: DISC_FRAGMENT, uniforms: { ...stage.wipe, uAlpha: { value: 0 } } }),
    );
    mesh.frustumCulled = false;
    // курсор диск не ловит: под ним буквы и чипы
    mesh.raycast = noHit;
    return mesh;
  }, [stage]);

  useEffect(() => {
    still.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    tilt.add(spin);
    spin.add(ring);
    spin.add(disc);
    let cancelled = false;
    const glyphs = new Map<string, THREE.BufferGeometry>();
    fetch("/fonts/archivo-title.json")
      .then((r) => r.json() as Promise<FontData>)
      .then((data) => {
        if (cancelled) return;
        const font = new Font(data);
        const advance = (char: string) => (char === COPY ? COPY_ADVANCE : (data.glyphs[char]?.ha ?? 300) / data.resolution);
        const glyph = (char: string) => {
          let geometry = glyphs.get(char);
          if (!geometry) {
            const extrude = { depth: DEPTH, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.018, bevelSegments: 3 };
            geometry = char === COPY ? linkGeometry(extrude) : new TextGeometry(char, { font, size: 1, ...extrude });
            // буква стоит на полу серединой, чтобы вырастать и подпрыгивать на месте
            geometry.translate(-advance(char) / 2, 0, -DEPTH / 2);
            geometry.computeBoundingBox();
            geometry.userData.shape = shapeOf(geometry);
            glyphs.set(char, geometry);
          }
          return geometry;
        };
        const built = TITLES.map((text, i) => {
          const group = new THREE.Group();
          group.rotation.y = i * STEP;
          const letters: Letter[] = [];
          // буквы чуть разрежены: у толстых фигур бока не должны слипаться
          const gap = 0.05;
          const width = [...text].reduce((sum, ch) => sum + advance(ch), 0) + gap * (text.length - 1);
          let pen = -width / 2;
          for (const char of text) {
            const w = advance(char);
            if (char !== " ") {
              const mesh = new THREE.Mesh(glyph(char), materials);
              mesh.visible = false;
              group.add(mesh);
              const letter: Letter = { mesh, at: pen + w / 2, hop: 0, hopVel: 0, roll: 0, rollVel: 0, pivot: new THREE.Vector2(), grounded: true, poise: 0, from: 0, free: null, aim: new THREE.Vector2(), aimHop: 0, grab: new THREE.Vector3(), held: false, turn: 0, lean: new THREE.Vector2(), mail: i === TITLES.length - 1, copy: char === COPY };
              mesh.userData.letter = letter;
              letters.push(letter);
            }
            pen += w + gap;
          }
          spin.add(group);
          return { group, letters, width };
        });
        setTitles(built);
        stage.parts++;
      });
    return () => {
      cancelled = true;
      glyphs.forEach((g) => g.dispose());
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      disc.geometry.dispose();
      (disc.material as THREE.Material).dispose();
      materials.forEach((m) => m.dispose());
      spin.clear();
      tilt.clear();
    };
  }, [tilt, spin, ring, disc, materials, stage]);

  // буква подпрыгивает, если на неё навести, и её можно взять и переставить, как предмет
  const held = useRef<Letter | null>(null);
  const local = useMemo(() => ({ hit: new THREE.Vector3(), plane: new THREE.Plane() }), []);
  const letterOf = (e: ThreeEvent<PointerEvent>) => e.object.userData.letter as Letter | undefined;
  /** Тянем в плоскости экрана через точку, за которую взяли: курсор вверх — буква вверх, вбок — вбок. */
  const aim = (e: ThreeEvent<PointerEvent>, letter: Letter) => {
    if (!e.ray.intersectPlane(local.plane, local.hit)) return;
    letter.mesh.parent!.worldToLocal(local.hit).sub(letter.grab);
    const unit = letter.mesh.scale.x * 0.35;
    const home = sim.current.radius;
    const r = Math.hypot(local.hit.x, local.hit.z);
    // внутрь предмета не заедет, в остальном куда угодно и на любую высоту
    const k = Math.max(r, home * 0.3) / Math.max(r, 1e-4);
    letter.aim.set(local.hit.x * k, local.hit.z * k);
    letter.aimHop = Math.max(0, local.hit.y / unit);
  };
  const cursor = (value: string) => (document.body.style.cursor = value);
  /** подсказка у почты: над какой буквой, что написано и до какого времени висит после клика */
  const tip = useRef({ over: null as Letter | null, at: null as Letter | null, until: 0, press: null as { letter: Letter; x: number; y: number; t: number } | null });
  const say = (text: string) => {
    const el = shared.current.tip;
    if (el && el.textContent !== text) el.textContent = text;
  };
  const copy = (letter: Letter) => {
    const done = () => {
      tip.current.at = letter;
      tip.current.until = performance.now() + 1800;
      say("Copied");
      track("email_copied", { place: letter.copy ? "icon" : "letters" });
    };
    // буфер обмена есть не везде: в старых браузерах и вне https адрес копируется через скрытое поле
    if (navigator.clipboard?.writeText) return void navigator.clipboard.writeText(EMAIL).then(done, () => {});
    const field = document.createElement("textarea");
    field.value = EMAIL;
    field.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(field);
    field.select();
    if (document.execCommand("copy")) done();
    field.remove();
  };
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    const letter = letterOf(e);
    if (!letter) return;
    e.stopPropagation();
    if (!held.current) cursor(letter.copy ? "pointer" : "grab");
    if (letter.copy && !held.current) {
      tip.current.over = letter;
      if (performance.now() > tip.current.until) say("Copy email");
    }
    if (held.current || letter.held || still.current || !letter.grounded) return;
    // тяжёлый блок не прыгает, а качается в ту сторону, куда его толкнул курсор
    const dir = Math.sign(e.nativeEvent.movementX) || (Math.random() < 0.5 ? -1 : 1);
    letter.rollVel = clamp(letter.rollVel - dir * ROCK_PUSH, -2.6, 2.6);
  };
  const onOut = () => {
    tip.current.over = null;
    if (!held.current) cursor("");
  };
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    const letter = letterOf(e);
    if (!letter) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    held.current = letter;
    tip.current.press = { letter, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, t: performance.now() };
    letter.held = true;
    if (!letter.free) {
      letter.free = new THREE.Vector2(letter.mesh.position.x, letter.mesh.position.z);
      letter.turn = letter.mesh.rotation.y;
    }
    local.plane.setFromNormalAndCoplanarPoint(FORWARD, e.point);
    // точка под курсором становится опорой: вокруг неё буква поворачивается и на ней висит
    const size = letter.mesh.scale.x;
    const at = letter.mesh.worldToLocal(local.hit.copy(e.point));
    repivot(letter, at.x, clamp(at.y, 0, letter.mesh.geometry.boundingBox!.max.y), size, size * 0.35, letter.turn);
    // от места, от которого буква отсчитана, до точки под курсором, как если бы буква стояла прямо
    const cs = Math.cos(letter.turn), sn = Math.sin(letter.turn);
    letter.grab.set((cs * letter.pivot.x + sn * at.z) * size, letter.pivot.y * size, (-sn * letter.pivot.x + cs * at.z) * size);
    letter.aim.copy(letter.free);
    letter.aimHop = letter.hop;
    letter.poise = letter.roll;
    letter.from = letter.hop;
    letter.rollVel = 0;
    letter.hopVel = 0;
    letter.grounded = false;
    shared.current.grabbing = true;
    document.body.style.userSelect = "none";
    cursor("grabbing");
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (held.current) aim(e, held.current);
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    const letter = held.current;
    if (!letter) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    // нажали и сразу отпустили, не сдвинув, — это клик: по почте или по знаку рядом он копирует адрес
    const press = tip.current.press;
    tip.current.press = null;
    const moved = press ? Math.hypot(e.nativeEvent.clientX - press.x, e.nativeEvent.clientY - press.y) : 0;
    if (press && press.letter === letter && letter.mail && performance.now() - press.t < 400 && moved < 6) copy(letter);
    if (moved > 12) trackOnce("letter_dragged", { on_email: !!letter.mail });
    // отпустили — падает как висела; на что приземлится, на то и ляжет
    letter.held = false;
    letter.hopVel = 0;
    held.current = null;
    shared.current.grabbing = false;
    document.body.style.userSelect = "";
    cursor(letter.copy ? "pointer" : "grab");
  };

  useFrame((state, rawDt) => {
    if (!titles) return;
    const dt = Math.min(rawDt, 1 / 20);
    const s = sim.current;
    const share = shared.current;
    const { width, height } = state.size;
    const narrow = stacked(stage.mode);

    // барабан шире предмета, его передний край под предметом
    const radius = stage.scale * (narrow ? 1.0 : DRUM_RADIUS);
    s.radius = radius;
    const floor = stage.y - stage.scale * (narrow ? 0.6 : DRUM_FLOOR);
    tilt.position.set(stage.x, floor, 0);
    // наклон почти постоянный: курсором его можно лишь чуть повести
    s.tilt = damp(s.tilt, TILT - share.pointer.y * 0.015, 3, dt);
    tilt.rotation.x = s.tilt;
    // на остановке заголовок стоит ровно по центру, курсор лишь чуть его поводит
    s.spin = damp(s.spin, -stage.smooth * STEP + share.pointer.x * 0.04, 6, dt);
    spin.rotation.y = s.spin;
    stage.spin = s.spin;
    // при входе пол разбегается кольцами от предмета
    const enter = stage.intro;
    ring.scale.setScalar(radius * (0.25 + 0.75 * (1 - Math.pow(1 - enter, 3))));
    const ringUniforms = (ring.material as THREE.ShaderMaterial).uniforms;
    ringUniforms.uSize.value = height * state.viewport.dpr * 0.0042;
    ringUniforms.uAlpha.value = enter;
    // диск вырастает вместе с кольцами; верх ровно на уровне пола, толщина уходит вниз
    const grown = radius * DISC_RADIUS * (0.25 + 0.75 * (1 - Math.pow(1 - enter, 3)));
    disc.visible = enter > 0.001;
    disc.scale.set(grown, radius * DISC_HEIGHT, grown);
    disc.position.y = -radius * DISC_HEIGHT * 0.5;
    (disc.material as THREE.ShaderMaterial).uniforms.uAlpha.value = enter;

    // сколько мира видно по ширине там, где стоит передний край барабана
    const camera = state.camera as THREE.PerspectiveCamera;
    const depth = camera.position.z - radius * Math.cos(TILT);
    // на узком широком экране (планшет боком) колонки текста подходят к заголовку вплотную:
    // там он встаёт между ними; где колонки далеко, заголовок шире и уходит под них
    const room = narrow ? 0.84 : stage.mode === "wide" && width < 1200 ? between("wide", width) : 0.62;
    const fitWidth = 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * room;
    // тяжёлые буквы падают быстро, как на земле, а не как в космосе
    const gravity = GRAVITY;
    titles.forEach((title, i) => {
      const d = i - stage.smooth;
      const present = (1 - smoothstep(Math.abs(d), 0.18, 0.8)) * enter;
      title.group.visible = present > 0.001;
      if (!title.group.visible) {
        // ушёл с барабана — в следующий раз буквы снова стоят по местам
        title.letters.forEach((l) => {
          l.mesh.raycast = noHit;
          l.free = null;
          l.held = false;
          l.roll = 0;
          l.rollVel = 0;
          l.pivot.set(0, 0);
          l.grounded = true;
        });
        return;
      }
      // кегль: заголовок помещается в дугу и в ширину экрана на глубине букв, и не больше, чем гигантский
      const size = Math.min(radius * (narrow ? 0.24 : 0.21), Math.min(radius * ARC, fitWidth) / title.width);
      const n = title.letters.length;
      const unit = size * 0.35;
      // где стоит каждая буква: на своём месте в заголовке или там, куда её переставили
      const spots = title.letters.map((l, j) => {
        // приезжает справа — первой встаёт левая буква, уезжает влево — левая первой и уходит
        const order = n > 1 ? (d >= 0 ? j / (n - 1) : 1 - j / (n - 1)) : 0;
        const rise = clamp(present * (1 + STAGGER) - STAGGER * order, 0, 1);
        let angle = (l.at * size) / radius;
        let x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
        // знак копирования стоит в конце длинной строки, где буквы уже отвёрнуты вбок: ребром
        // его не разобрать, поэтому он довёрнут к зрителю
        if (l.copy) angle *= 0.25;
        const px = l.free?.x ?? x, pz = l.free?.y ?? z;
        if (l.free) {
          if (l.held) {
            l.free.x = damp(l.free.x, l.aim.x, 14, dt);
            l.free.y = damp(l.free.y, l.aim.y, 14, dt);
          }
          angle = l.turn;
          x = l.free.x;
          z = l.free.y;
        }
        return { l, j, x, z, px, pz, angle, grown: backOut(rise), rise };
      });
      const foot = (spot: (typeof spots)[number]) => footprint(spot.l, spot.x, spot.z, spot.angle, size, unit, spot.grown);

      // взятую букву соседние не пускают: упирается и съезжает вбок. Если её держат выше
      // соседней, она проходит над ней и может на неё встать
      const carried = spots.find((sp) => sp.l.held && sp.l.free);
      if (carried) {
        for (let pass = 0; pass < 3; pass++) {
          for (const other of spots) {
            if (other === carried || other.rise <= 0.002) continue;
            const A = foot(carried), B = foot(other);
            if (A.y0 >= B.top - 0.02 * size || B.y0 >= A.top - 0.02 * size) continue;
            if (!overlap(A, B)) continue;
            // выталкиваем только вбок: по глубине буква тонкая и иначе объезжала бы соседку спереди
            carried.l.free!.x += sideways(A, B);
            carried.x = carried.l.free!.x;
          }
        }
      }

      title.letters.forEach((l, j) => {
        const spot = spots[j];
        // опора: пол или крыша буквы, над которой эта стоит
        const A = foot(spot);
        let ground = 0;
        for (const other of spots) {
          if (other === spot || other.rise <= 0.002) continue;
          const B = foot(other);
          if (B.top <= A.y0 + 0.02 * size && overlap(A, B)) ground = Math.max(ground, B.top);
        }
        const bb = l.mesh.geometry.boundingBox!;
        const cs = Math.cos(spot.angle), sn = Math.sin(spot.angle);
        // буква вышла из строя заголовка: дальше стоит там, куда её привела физика
        const loose = () => {
          if (l.free) return;
          l.free = new THREE.Vector2(spot.x, spot.z);
          l.turn = spot.angle;
        };

        // поворот в своей плоскости
        const body = bodyOf(l);
        if (l.held) {
          // в руке буква висит на точке захвата: центр тяжести уходит под неё. Пока её не подняли,
          // она стоит как стояла; от движения руки отстаёт и раскачивается
          const dx = body.com[0] - l.pivot.x, dy = body.com[1] - l.pivot.y;
          const hang = Math.hypot(dx, dy) > 0.08 ? wrap(-QUARTER - Math.atan2(dy, dx) - l.poise) : 0;
          const lifted = smoothstep(((l.aimHop - l.from) * unit) / (bb.max.y * size), 0.04, 0.5);
          const speed = l.free ? ((spot.x - spot.px) * cs - (spot.z - spot.pz) * sn) / dt : 0;
          const want = l.poise + hang * lifted - clamp(speed * 0.5, -0.6, 0.6);
          l.rollVel += ((want - l.roll) * HANG_K - l.rollVel * HANG_C) * dt;
          l.roll += l.rollVel * dt;
        } else if (l.grounded) {
          // на опоре буква держится на нижней вершине, а вес валит её в ту сторону, где центр
          // тяжести: качнули — возвращается, перевалила за ребро — ложится на следующую грань
          const low = span(l);
          const [vx, vy] = body.hull[low.low];
          repivot(l, vx, vy, size, unit, spot.angle);
          const n = body.hull.length;
          const c = Math.cos(l.roll), sr = Math.sin(l.roll);
          const lever = c * (body.com[0] - vx) - sr * (body.com[1] - vy);
          // соседняя вершина с той стороны, куда валит: когда она коснётся опоры, буква легла на грань
          const [nx, ny] = body.hull[(low.low + (lever > 0 ? 1 : n - 1)) % n];
          const ex = c * (nx - vx) - sr * (ny - vy), ey = sr * (nx - vx) + c * (ny - vy);
          const flat = lever > 0 ? -Math.atan2(ey, ex) : wrap(Math.PI - Math.atan2(ey, ex));
          const over = lever > 0 ? lever <= ex : lever >= ex;
          if (Math.abs(flat) < 0.03 && over && Math.abs(l.rollVel) < 0.5) {
            // лежит на грани, центр тяжести над ней: покой
            l.roll += flat;
            l.rollVel = 0;
          } else {
            const reach = Math.hypot(body.com[0] - vx, body.com[1] - vy);
            l.rollVel += ((-TIP * lever) / (reach * reach + 0.05) - l.rollVel * ROCK_C) * dt;
            const step = l.rollVel * dt;
            // на грань она ложится, а не проходит сквозь опору: удар гасит часть вращения,
            // остаток перекатывает её на другое ребро грани, и так пока не успокоится
            if (Math.abs(flat) > 1e-4 && step * flat > 0 && Math.abs(step) >= Math.abs(flat)) {
              l.roll += flat;
              l.rollVel *= THUD;
            } else l.roll += step;
          }
          // в строю буква только качается: упасть ей не даём
          if (!l.free && Math.abs(l.roll) > 0.26) {
            l.roll = Math.sign(l.roll) * 0.26;
            l.rollVel *= -0.3;
          }
        } else {
          // в полёте крутится вокруг центра тяжести, как крутилась
          if (Math.abs(l.rollVel) > 0.01 || Math.abs(l.roll) > 0.01) loose();
          const air = bodyOf(l);
          repivot(l, air.com[0], air.com[1], size, unit, spot.angle);
          l.rollVel *= Math.exp(-1.2 * dt);
          l.roll += l.rollVel * dt;
        }
        if (l.free) {
          spot.x = l.free.x;
          spot.z = l.free.y;
        }

        // высота: hop, при котором нижняя точка повёрнутой буквы касается опоры
        const rest = (ground - span(l).y0 * size) / unit;
        if (l.held) {
          // идёт за курсором, но не проваливается в то, на чём стоит
          l.hop = Math.max(damp(l.hop, l.aimHop, 16, dt), rest);
          l.hopVel = 0;
        } else {
          // падение с парой затухающих отскоков — на пол или на соседнюю букву
          l.hopVel -= gravity * dt;
          l.hop += l.hopVel * dt;
          if (l.hop <= rest) {
            l.hop = rest;
            const hit = -l.hopVel;
            // удар об опору: короткий отскок и тяжёлое покачивание
            if (hit > REST * 2) l.rollVel += (Math.random() - 0.5) * Math.min(hit * 0.03, 0.6);
            l.hopVel = hit * 0.3 > REST ? hit * 0.3 : 0;
            l.grounded = true;
          } else if (l.hop > rest + 0.08) l.grounded = false;
        }
        if (l.free) {
          // в руке буква ещё и наклоняется вперёд-назад, если её ведут в глубину
          const vx = (spot.x - spot.px) / dt, vz = (spot.z - spot.pz) / dt;
          l.lean.y = damp(l.lean.y, l.held ? clamp((vx * sn + vz * cs) * 0.5, -0.5, 0.5) : 0, 8, dt);
        }
        const m = l.mesh;
        m.visible = spot.rise > 0.002;
        m.raycast = m.visible ? boxHit : noHit;
        // середина основания стоит там, куда её увёл поворот вокруг опоры
        const [ox, oy] = placed(l, 0, 0);
        m.position.set(spot.x + ox * size * cs, l.hop * unit + oy * size, spot.z - ox * size * sn);
        m.rotation.set(l.lean.y, spot.angle, l.roll);
        m.scale.set(size, size * Math.max(spot.grown, 0.002), size);
      });
      if (Math.abs(d) < 0.5) {
        stage.titleWidth = title.width * size;
        stage.slot.set(0, size * 0.4, radius);
        tilt.updateMatrixWorld();
        spin.localToWorld(stage.slot.applyAxisAngle(UP, i * STEP));
        // рамка заголовка на экране: середина и размеры на глубине передней буквы
        const at = corner.copy(stage.slot).project(camera);
        const perUnit = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - stage.slot.z));
        const cx = (at.x * 0.5 + 0.5) * width, cy = (0.5 - at.y * 0.5) * height;
        const halfW = (stage.titleWidth / 2) * perUnit, halfH = size * 0.45 * perUnit;
        share.title.x0 = cx - halfW;
        share.title.x1 = cx + halfW;
        share.title.y0 = cy - halfH;
        share.title.y1 = cy + halfH;
      }
    });

    // подсказка висит над знаком копирования, пока на нём курсор, и над буквой, по которой кликнули
    const el = share.tip;
    if (el) {
      const t = tip.current;
      const copied = performance.now() < t.until;
      const letter = copied ? t.at : t.over;
      if (letter && letter.mesh.visible) {
        const size = letter.mesh.scale.x;
        letter.mesh.getWorldPosition(corner);
        corner.y += size * 0.95;
        corner.project(state.camera);
        el.style.transform = `translate(${((corner.x * 0.5 + 0.5) * width).toFixed(1)}px, ${((0.5 - corner.y * 0.5) * height).toFixed(1)}px) translate(-50%, -100%)`;
      }
      el.style.opacity = letter && letter.mesh.visible ? "1" : "0";
    }
  });

  return <primitive object={tilt} onPointerOver={onOver} onPointerOut={onOut} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />;
}
