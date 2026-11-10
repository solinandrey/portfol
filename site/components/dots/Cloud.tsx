"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Built, ShapeMeta } from "@/lib/dots-build";
import { DROP, EASEL, MAIL, PIPE, type Solids } from "@/lib/dots-shapes";
import { startPortrait } from "@/lib/portrait";
import { COMMON, frameOf, INK, modeOf, ORANGE, PAPER, type Stage } from "./paper";

// Одно облако точек на весь сайт. На каждой остановке точки собираются в свой предмет,
// между остановками цвет меняется на противоположный круговой шторкой: фон и точки считают
// её прямо в шейдере, а подписи инвертируются сами через mix-blend-mode.

/** все предметы лежат в видеопамяти одной текстурой: строки по COLS точек, у каждого предмета rows строк.
 * Сколько точек всего, решает устройство (lib/portrait.ts), поэтому число строк приходит в шейдер снаружи */
const COLS = 1024;
/** сколько галактика крутится до взрыва, если портрет уже загрузился */
const HOLD = 2.2;
const { clamp, damp, smoothstep } = THREE.MathUtils;

const vertex = (rows: number) => /* glsl */ `
  attribute vec4 aRand;
  // предметы целиком в текстурах: переход не гоняет мегабайты в видеокарту, а только меняет номера
  uniform sampler2D uPos, uMotion;
  uniform float uShapeA, uShapeB, uLoaded, uKeep;
  attribute float aLum;
  uniform float uMix, uTime, uScale, uPortraitA, uPortraitB, uMouseOn;
  // вход: галактика из темноты (uFade), сжимается (uGather), крутится (uSpin), взрывается в предмет (uBurst)
  uniform float uFade, uGather, uSpin, uBurst;
  uniform vec3 uMouse, uPulse;
  uniform float uPulseAge;
  uniform vec2 uPivot;
  varying float vAlpha, vTaxi;

  vec3 flow(vec3 p, float t) {
    return vec3(
      sin(p.y * 3.1 + t * 0.9) + sin(p.z * 2.3 - t * 0.7),
      sin(p.z * 2.7 + t * 0.8) + sin(p.x * 3.3 + t * 0.6),
      sin(p.x * 2.9 - t * 1.1) + sin(p.y * 2.1 + t * 0.5)
    ) * 0.5;
  }

  // набор: в каждый такт жмётся случайная клавиша, иногда сразу две, пробел чаще остальных
  float keyPress(vec4 m) {
    float beat = uTime * 7.0;
    float slot = floor(beat);
    float k = floor(fract(sin(slot * 12.9898) * 43758.5453) * (m.z + 6.0));
    float k2 = floor(fract(sin(slot * 78.233 + 1.3) * 12543.11) * m.z);
    k = min(k, m.z - 1.0);
    float hit = abs(k - m.y) < 0.5 || (abs(k2 - m.y) < 0.5 && fract(slot * 0.37) > 0.6) ? 1.0 : 0.0;
    return hit * sin(3.14159265 * clamp(fract(beat) * 1.6, 0.0, 1.0));
  }

  // цветное только то, что катится, бьёт или работает: такси, молоток, кисть, лупа, мазок;
  // клавиша — пока нажата
  // круг заполнения: дашборд Symmetre и приложение fatstack собираются по очереди и гаснут.
  // Без движения стоят собранными
  float built() { return uTime > 0.0 ? fract(uTime / ${PIPE.LOOP.toFixed(1)}) : 0.9; }

  float accent(vec4 m) {
    if (m.w <= 0.0) return 0.0;
    if (m.x > 8.5 && m.x < 9.5) return keyPress(m);
    // письмо оранжевое всю дорогу
    if (m.x > 13.5) return 1.0;
    // монета оранжевая, пока летит, и гаснет, когда легла; до своей очереди её нет вовсе
    if (m.x > 12.5) {
      float t = (built() - m.y) / ${DROP.toFixed(3)};
      return smoothstep(0.0, 0.2, t) * (1.0 - smoothstep(1.0, 2.2, t)) * (1.0 - smoothstep(0.95, 1.0, built()));
    }
    return m.x < 1.5 || (m.x > 2.5 && m.x < 3.5) || (m.x > 5.5 && m.x < 7.5) || (m.x > 9.5 && m.x < 11.5) ? 1.0 : 0.0;
  }

  // картина на холсте Beta: круги рисуются по очереди, кисть обводит и закрашивает каждый,
  // нарисованные дышат и чуть плывут; в конце круга всё гаснет и начинается сначала
  const vec3 CIRCLES[${EASEL.CIRCLES.length}] = vec3[](${EASEL.CIRCLES.map(([x, y, r]) => `vec3(${x.toFixed(4)}, ${y.toFixed(4)}, ${r.toFixed(4)})`).join(", ")});
  float drawn() { return fract(uTime / ${EASEL.LOOP.toFixed(1)}); }
  vec3 circleNow(float i) {
    vec3 c = CIRCLES[int(i)];
    vec2 drift = vec2(sin(uTime * 0.5 + i * 2.1), cos(uTime * 0.6 + i * 1.3)) * 0.006;
    return vec3(c.xy + drift, c.z * (1.0 + 0.04 * sin(uTime * 0.8 + i * 1.7)));
  }

  // где лупа: переезжает от места к месту и задерживается на каждом, будто вчитывается
  vec2 lensStop(float k) {
    k = mod(k, 7.0);
    if (k < 0.5) return vec2(-0.3, 0.0);
    if (k < 1.5) return vec2(0.29, 0.22);
    if (k < 2.5) return vec2(0.2, 0.1);
    if (k < 3.5) return vec2(0.32, 0.03);
    if (k < 4.5) return vec2(-0.15, -0.13);
    if (k < 5.5) return vec2(-0.32, -0.27);
    return vec2(0.34, -0.27);
  }
  vec2 lensAt(float t) {
    float k = floor(t / 2.4);
    vec2 c = mix(lensStop(k), lensStop(k + 1.0), smoothstep(0.0, 0.55, fract(t / 2.4)));
    return c + vec2(sin(t * 3.1), cos(t * 2.3)) * 0.005;
  }

  /** Виды 5–10: картина, кисть, лупа, документ под ней, клавиши, оранжевый мазок. */
  vec3 art(vec3 p, vec4 m, inout float fade) {
    if (m.x < 5.5) {
      // точка круга проявляется, когда до её угла дошла кисть; круг дышит вокруг своего центра
      float order = (m.y + m.z) / ${EASEL.CIRCLES.length.toFixed(1)};
      fade *= smoothstep(order - 0.003, order, drawn() * 1.18) * (1.0 - smoothstep(0.9, 1.0, drawn()));
      vec3 c = circleNow(m.y);
      vec3 home = CIRCLES[int(m.y)];
      return vec3(c.xy + (p.xy - home.xy) * (c.z / home.z), p.z);
    }
    if (m.x < 6.5) {
      // кончик кисти идёт по кругу, который сейчас рисуется
      float r = min(drawn() * 1.18, 0.999) * ${EASEL.CIRCLES.length.toFixed(1)};
      vec3 c = circleNow(floor(r));
      float a = fract(r) * 6.2831853;
      return p + vec3(c.xy + vec2(cos(a), sin(a)) * c.z, ${(EASEL.CZ + 0.012).toFixed(4)});
    }
    if (m.x > 9.5 && m.x < 10.5) return p;
    if (m.x > 8.5) {
      // клавиша уходит вниз поперёк наклонённой клавиатуры
      return p - vec3(0.0, ${Math.cos(EASEL.KEY_TILT).toFixed(4)}, ${Math.sin(EASEL.KEY_TILT).toFixed(4)}) * keyPress(m) * m.w;
    }
    vec2 c = lensAt(uTime);
    if (m.x < 7.5) return p + vec3(c, 0.0);
    // под стеклом: середина вдвое крупнее, к ободу сжимается, за ободом как есть
    vec2 d = p.xy - c;
    float x = length(d) / m.w;
    if (x >= 1.0) return p;
    return vec3(c + d * 2.0 / (1.0 + x), p.z + 0.03 * (1.0 - x));
  }

  // Symmetre: пакет данных бежит по проводу от крыши к дашборду (вид 11), содержимое дашборда
  // появляется по очереди и в конце круга гаснет (вид 12). fatstack: то же на экране телефона
  const vec3 WIRES[${PIPE.WIRES.length * 3}] = vec3[](${PIPE.WIRES.flat().map(([x, y, z]) => `vec3(${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)})`).join(", ")});
  vec3 feed(vec3 p, vec4 m, inout float fade) {
    if (m.x < 11.5) {
      float t = fract(m.z + uTime * ${PIPE.SPEED.toFixed(2)});
      int i = int(m.y) * 3;
      float s = 1.0 - t;
      fade *= smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.93, 1.0, t));
      return WIRES[i] * s * s + WIRES[i + 1] * 2.0 * s * t + WIRES[i + 2] * t * t + p;
    }
    // последний экран: письмо появляется в стороне, по дуге подлетает к лицу, уменьшается и гаснет
    // (вид 14). m.y — очередь письма, m.z — с какой стороны летит, m.w — издалека ли. Без движения висит на полпути
    if (m.x > 13.5) {
      // полёт занимает меньше половины круга, остальное время письма нет: в кадре их одно-два, а не все сразу
      float t = uTime > 0.0 ? min(fract(uTime / ${MAIL.LOOP.toFixed(1)} + m.y) / ${MAIL.FLIGHT.toFixed(2)}, 1.0) : 0.3 + m.y * 0.3;
      float go = t * t * (3.0 - 2.0 * t);
      vec3 aim = vec3(${MAIL.AIM.map((v) => v.toFixed(3)).join(", ")});
      vec3 at = aim + vec3(cos(m.z) * m.w, sin(m.z) * m.w * 0.75, 0.0) * (1.0 - go);
      float arc = sin(3.14159265 * go);
      at += vec3(0.0, 0.1, 0.16) * arc;
      float size = smoothstep(0.0, 0.14, t) * (1.0 - smoothstep(0.52, 0.93, t));
      fade *= smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.8, 0.95, t));
      // в полёте конверт наклонён и выравнивается к прилёту
      float lean = (1.0 - go) * 0.6 * sin(m.z * 3.0 + 1.0);
      float c = cos(lean), s = sin(lean);
      return at + vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z) * size;
    }
    float now = built();
    float gone = 1.0 - smoothstep(0.95, 1.0, now);
    if (m.x < 12.5) {
      fade *= smoothstep(m.y - 0.012, m.y, now) * gone;
      return p;
    }
    // fatstack: монета появляется над стопкой и падает на неё, разгоняясь (вид 13)
    float t = clamp((now - m.y) / ${DROP.toFixed(3)}, 0.0, 1.0);
    fade *= smoothstep(0.0, 0.2, t) * gone;
    return p + vec3(0.0, (1.0 - t * t) * m.w, 0.0);
  }

  vec3 drive(vec3 p, vec4 m, inout float fade) {
    if (m.w <= 0.0) return p;
    if (m.x > 10.5) return feed(p, m, fade);
    if (m.x > 4.5) return art(p, m, fade);
    if (m.x > 1.5) {
      // рывок с отскоком: в момент удара beat = 0
      float beat = abs(sin(uTime * m.z + m.y));
      if (m.x > 3.5) return p + vec3(0.0, pow(1.0 - beat, 10.0) * m.w, 0.0);
      float c = cos(beat * m.w), s = sin(beat * m.w);
      vec2 d = p.xy - uPivot;
      return vec3(uPivot + vec2(d.x * c - d.y * s, d.x * s + d.y * c), p.z);
    }
    // вдоль улицы: у всех точек одной машины сдвиг общий, на краю города машина гаснет
    float d = mod(m.y + uTime * m.z, m.w) - m.w * 0.5;
    fade *= 1.0 - smoothstep(m.w * 0.5 - 0.07, m.w * 0.5 - 0.01, abs(d));
    return p + mix(vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), m.x) * d;
  }

  /** Узел (2, 5) из точек, которые текут вдоль нити, и редкая оболочка вокруг. Всё сжимается к центру. */
  vec3 swirl(vec4 r) {
    float squeeze = 1.0 - uGather * 0.95;
    vec3 q;
    if (r.w > 0.86) {
      float theta = r.y * 6.2831853 + uSpin * 0.12;
      float z = r.z * 2.0 - 1.0;
      q = vec3(sqrt(1.0 - z * z) * vec2(cos(theta), sin(theta)), z) * (0.7 + r.x * 0.12) * squeeze;
    } else {
      float phi = r.x * 6.2831853 + uSpin * 0.3;
      float tube = 0.17 * squeeze;
      float ring = 0.4 * squeeze + tube * cos(5.0 * phi);
      vec3 jitter = (vec3(r.y, r.z, fract(r.w * 7.13)) - 0.5) * (0.02 + 0.07 * r.y * r.y) * squeeze;
      q = vec3(ring * cos(2.0 * phi), ring * sin(2.0 * phi), tube * sin(5.0 * phi)) + jitter;
    }
    // медленно кувыркается, чтобы читался объём
    float a = uSpin * 0.22, b = 0.45 + sin(uSpin * 0.15) * 0.3;
    q = vec3(q.x * cos(a) + q.z * sin(a), q.y, -q.x * sin(a) + q.z * cos(a));
    return vec3(q.x, q.y * cos(b) - q.z * sin(b), q.y * sin(b) + q.z * cos(b));
  }

  vec4 fetchAt(sampler2D tex, float shape) {
    int id = gl_VertexID;
    return texelFetch(tex, ivec2(id % ${COLS}, int(shape) * ${rows} + id / ${COLS}), 0);
  }

  void main() {
    // страховка по скорости: когда кадры не успевают, часть точек не рисуется вовсе
    if (fract(aRand.x * 7.31 + aRand.y * 3.17) > uKeep) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      vTaxi = 0.0;
      return;
    }
    vec3 posA = vec3(0.0), posB = vec3(0.0);
    vec4 aMotionA = vec4(0.0), aMotionB = vec4(0.0);
    if (uLoaded > 0.5) {
      posA = fetchAt(uPos, uShapeA).xyz;
      posB = fetchAt(uPos, uShapeB).xyz;
      aMotionA = fetchAt(uMotion, uShapeA);
      aMotionB = fetchAt(uMotion, uShapeB);
    }
    // точки стартуют не разом, а лавиной
    float t = clamp((uMix - aRand.x * 0.45) / 0.55, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    float fadeA = 1.0, fadeB = 1.0;
    vec3 a = drive(posA, aMotionA, fadeA);
    vec3 b = drive(posB, aMotionB, fadeB);
    vec3 p = mix(a, b, t);
    float burst = sin(3.14159265 * t);
    p += flow(p * 1.6 + aRand.w * 5.0, uTime * 0.5 + aRand.y * 6.28) * burst * (0.1 + aRand.z * 0.22);
    p += flow(p * 5.0 + aRand.xyz, uTime * 0.6) * 0.0012;

    // вход: из галактики в предмет рывком, с разлётом наружу
    float shaped = 1.0;
    if (uBurst < 1.0) {
      vec3 s = swirl(aRand);
      float tb = clamp((uBurst - aRand.x * 0.35) / 0.65, 0.0, 1.0);
      shaped = 1.0 - pow(1.0 - tb, 4.0);
      p = mix(s, p, shaped) + normalize(p - s + 1e-4) * sin(3.14159265 * tb) * (0.06 + aRand.z * 0.16);
    }

    // клик по предмету: от места клика по точкам расходится волна и гаснет
    float wave = 0.0;
    if (uPulseAge < 2.4) {
      vec3 away = p - uPulse;
      float front = uPulseAge * 1.15;
      wave = exp(-pow((length(away) - front) / 0.07, 2.0)) * exp(-uPulseAge * 1.3);
      p += normalize(away + 1e-4) * wave * 0.075;
    }

    // курсор как фонарик: точки рядом ярче и чуть крупнее, но остаются на месте
    float vLight = (1.0 - smoothstep(0.0, 0.26, length(p.xy - uMouse.xy))) * uMouseOn;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (0.9 + aRand.y * 0.9) * (1.0 + vLight * 0.55 + wave * 0.9) * uScale / -mv.z;

    float alphaA = mix(0.5, 0.16 + aLum * 0.95, uPortraitA) * fadeA;
    float alphaB = mix(0.5, 0.16 + aLum * 0.95, uPortraitB) * fadeB;
    vTaxi = mix(accent(aMotionA), accent(aMotionB), t);
    // по портрету снизу вверх проходит полоса света: он не стоит мёртвым
    float scanY = mod(uTime * 0.2, 2.2) - 1.0;
    float scan = exp(-pow((p.y - scanY) / 0.035, 2.0)) * mix(uPortraitA, uPortraitB, t);
    vAlpha = (mix(mix(alphaA, alphaB, t), 0.42, 1.0 - shaped) + scan * 0.45 + vLight * 0.5 + wave * 0.7) * uFade;
  }
`;

const FRAGMENT = /* glsl */ `
  ${COMMON}
  varying float vAlpha, vTaxi;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float paper = paperAt(gl_FragCoord.xy);
    vec3 dot = mix(${PAPER}, ${INK}, paper);
    // оранжевый один на обеих сторонах
    vec3 color = mix(dot, ${ORANGE}, vTaxi);
    float alpha = vAlpha * mix(1.0, 1.55, paper) + vTaxi * 0.5;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0) * (1.0 - smoothstep(0.25, 0.5, d)));
  }
`;

const BACK_VERTEX = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.999, 1.0);
  }
`;
const BACK_FRAGMENT = /* glsl */ `
  ${COMMON}
  uniform float uFlash;
  void main() {
    vec3 color = mix(${INK}, ${PAPER}, paperAt(gl_FragCoord.xy));
    // вспышка из центра в момент взрыва
    float glow = 1.0 - smoothstep(0.0, 900.0, distance(gl_FragCoord.xy, uCenter));
    gl_FragColor = vec4(color + uFlash * glow * 0.28, 1.0);
  }
`;

type Shape = ShapeMeta;

/** grabbing — держат чип: тогда скролл не листает */
export type Shared = {
  station: number;
  pointer: THREE.Vector2;
  inside: boolean;
  grabbing: boolean;
  /** предмет крутят мышкой: на сколько повернули, с какой скоростью и держат ли сейчас */
  twist: number;
  twistVel: number;
  turning: boolean;
  /** где предмет на экране, в пикселях: за него можно взяться */
  model: { x: number; y: number; rx: number; ry: number };
  /** клик по предмету: где на экране и который по счёту */
  pulse: { x: number; y: number; n: number };
  /** где на экране стоит заголовок, в пикселях: по нему проверяется, что текст на него не наезжает */
  title: { x0: number; y0: number; x1: number; y1: number };  /** подсказка у почты на последнем экране: сам элемент, сцена двигает его за буквой */
  tip: HTMLElement | null;
};

/** Светлая остановка или тёмная: цвет меняется на каждой. */
const polarity = (station: number) => station % 2;

/** Только глубина, без цвета. Точки дрожат на ±0.0012, поэтому объём чуть меньше граней: те, что на гранях, остаются впереди. */
function solidMesh({ boxes, balls, ground }: Solids) {
  const group = new THREE.Group();
  group.position.y = ground;
  group.visible = false;
  const material = new THREE.MeshBasicMaterial({ colorWrite: false });
  const m = new THREE.Matrix4();
  const add = (geometry: THREE.BufferGeometry, total: number, set: (i: number) => void) => {
    const mesh = new THREE.InstancedMesh(geometry, material, total);
    for (let i = 0; i < total; i++) {
      set(i);
      mesh.setMatrixAt(i, m);
    }
    mesh.frustumCulled = false;
    mesh.renderOrder = -0.5;
    group.add(mesh);
  };
  add(new THREE.BoxGeometry(1, 1, 1), boxes.length / 6, (i) => {
    const [x, y0, y1, z, w, d] = boxes.subarray(i * 6, i * 6 + 6);
    m.makeScale(w * 2 - 0.006, y1 - y0 - 0.003, d * 2 - 0.006);
    m.setPosition(x, (y0 + y1) / 2 - 0.0015, z);
  });
  if (balls) {
    add(new THREE.SphereGeometry(1, 20, 14), balls.length / 6, (i) => {
      const [x, y, z, rx, ry, rz] = balls.subarray(i * 6, i * 6 + 6);
      m.makeScale(rx - 0.004, ry - 0.004, rz - 0.004);
      m.setPosition(x, y, z);
    });
  }
  return group;
}

/** где стоит галактика, пока портрета ещё нет: там же, где встанет портрет */
const WAITING: Shape = { portrait: true };

type CloudProps = { shared: RefObject<Shared>; stage: Stage; onStation: (i: number) => void; onReady: () => void };

export function Cloud({ shared, stage, onStation, onReady }: CloudProps) {
  const [points, setPoints] = useState<THREE.Points | null>(null);
  const shapes = useRef<Shape[]>([]);
  const solids = useRef<(THREE.Group | null)[]>([]);
  const still = useRef(false);
  /** что осталось сделать с готовыми предметами: по одному делу на кадр */
  const queue = useRef<(() => void)[]>([]);
  const sim = useRef({ segment: -1, active: -1, smooth: 0, pitch: 0, yaw: 0, scale: 1, x: 0, y: 0, mouseOn: 0, placed: false, warm: 0, pulse: 0 });
  /** вход на сайт: секунды с начала, схлопывание, взрыв в предмет и сколько прошло после него */
  const intro = useRef({ t: 0, collapse: 0, burst: 0, after: 0, spin: 0, loaded: false, told: false });
  const hit = useRef({ ray: new THREE.Raycaster(), plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), v: new THREE.Vector3(), ndc: new THREE.Vector3() });

  // фон, точки, барабан и чипы смотрят на одни и те же значения шторки
  const { wipe } = stage;
  const back = useMemo(() => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: BACK_VERTEX, fragmentShader: BACK_FRAGMENT, uniforms: { ...wipe, uFlash: { value: 0 } }, depthTest: false, depthWrite: false }),
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    return mesh;
  }, [wipe, stage]);

  // облако создаётся сразу: пока грузится портрет, точки крутятся галактикой
  useEffect(() => {
    still.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    // сколько точек у облака, решает устройство; портрет к этому моменту уже качается
    const portrait = startPortrait();
    const count = portrait.count;
    const geometry = new THREE.BufferGeometry();
    // position нужен только для числа точек: сами координаты берутся из текстуры
    for (const [name, size] of [["position", 3], ["aLum", 1]] as const) {
      geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(count * size), size));
    }
    const empty = new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat, THREE.FloatType);
    const rand = new Float32Array(count * 4);
    for (let i = 0; i < rand.length; i++) rand[i] = Math.random();
    geometry.setAttribute("aRand", new THREE.BufferAttribute(rand, 4));
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex(Math.ceil(count / COLS)),
      fragmentShader: FRAGMENT,
      uniforms: {
        ...wipe,
        uMix: { value: 0 },
        uTime: { value: 0 },
        uScale: { value: 1 },
        uPortraitA: { value: 1 },
        uPortraitB: { value: 1 },
        uMouse: { value: new THREE.Vector3(9, 9, 9) },
        uMouseOn: { value: 0 },
        uPulse: { value: new THREE.Vector3() },
        uPulseAge: { value: 9 },
        uPivot: { value: new THREE.Vector2() },
        uPos: { value: empty },
        uMotion: { value: empty },
        uShapeA: { value: 0 },
        uShapeB: { value: 1 },
        uLoaded: { value: 0 },
        uKeep: { value: 1 },
        uFade: { value: 0 },
        uGather: { value: 0 },
        uSpin: { value: 0 },
        uBurst: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });
    const cloud = new THREE.Points(geometry, material);
    cloud.frustumCulled = false;
    setPoints(cloud);

    // Готовые предметы уходят в видеопамять по частям, по кадру на текстуру: разом это десятки
    // мегабайт и заметный рывок посреди входа
    const show = (built: Built) => {
      if (cancelled) return;
      const texture = (data: Float32Array) => {
        const t = new THREE.DataTexture(data, COLS, built.rows * built.shapes.length, THREE.RGBAFormat, THREE.FloatType);
        t.needsUpdate = true;
        return t;
      };
      queue.current.push(
        () => (material.uniforms.uPos.value = texture(built.pos)),
        () => (material.uniforms.uMotion.value = texture(built.motion)),
        () => {
          (geometry.attributes.aLum.array as Float32Array).set(built.lum);
          geometry.attributes.aLum.needsUpdate = true;
          material.uniforms.uLoaded.value = 1;
          material.uniforms.uPivot.value.set(...(built.shapes.find((shape) => shape.pivot)?.pivot ?? [0, 0]));
          shapes.current = built.shapes;
          solids.current = built.shapes.map((shape) => {
            if (!shape.solids) return null;
            const mesh = solidMesh(shape.solids);
            cloud.add(mesh);
            return mesh;
          });
          intro.current.loaded = true;
          stage.parts++;
        },
      );
    };
    // Предметы собирает фоновый поток: на телефоне это секунда-две работы процессора, и на главном
    // потоке вход на это время замирал. Не завёлся поток — считаем здесь, как раньше
    let worker: Worker | null = null;
    const here = (buffer: ArrayBuffer) => import("@/lib/dots-build").then((m) => show(m.build(buffer, count, COLS)));
    const make = (buffer: ArrayBuffer) => {
      if (cancelled) return;
      try {
        worker = new Worker(new URL("./shapes.worker.ts", import.meta.url), { type: "module" });
      } catch {
        return void here(buffer);
      }
      worker.onmessage = (e: MessageEvent<Built>) => {
        worker?.terminate();
        show(e.data);
      };
      worker.onerror = () => {
        worker?.terminate();
        here(buffer);
      };
      // без передачи владения: тот же буфер понадобится, если сцену соберут заново
      worker.postMessage({ buffer, count, cols: COLS });
    };
    // сеть моргнула — пробуем ещё раз, иначе галактика входа крутилась бы вечно
    portrait.data.then(make, () => {
      window.setTimeout(() => {
        if (!cancelled) fetch(portrait.file).then((r) => r.arrayBuffer()).then(make);
      }, 1500);
    });
    return () => {
      cancelled = true;
      worker?.terminate();
      queue.current.length = 0;
      geometry.dispose();
      material.dispose();
    };
  }, [wipe]);

  useFrame((state, rawDt) => {
    if (!points) return;
    queue.current.shift()?.();
    const dt = Math.min(rawDt, 1 / 20);
    const s = sim.current;
    const u = (points.material as THREE.ShaderMaterial).uniforms;
    const list = shapes.current;
    const last = list.length - 1;
    const share = shared.current;
    const { width, height } = state.size;
    const dpr = state.viewport.dpr;
    const mode = modeOf(width, height);
    const halfWidth = state.viewport.width / 2;
    const halfHeight = state.viewport.height / 2;

    s.smooth = damp(s.smooth, share.station, 7, dt);
    stage.smooth = s.smooth;
    stage.mode = mode;
    // пока портрет не загрузился, предметов нет: крутится только галактика входа
    const loaded = list.length > 0;
    const seg = loaded ? Math.min(Math.floor(s.smooth), last - 1) : 0;
    const frac = loaded ? s.smooth - seg : 0;
    // на остановке предмет держится, между остановками перетекает
    const mix = smoothstep(frac, 0.08, 0.92);
    if (loaded && seg !== s.segment) {
      s.segment = seg;
      u.uShapeA.value = seg;
      u.uShapeB.value = seg + 1;
      u.uPortraitA.value = list[seg].portrait ? 1 : 0;
      u.uPortraitB.value = list[seg + 1].portrait ? 1 : 0;
      wipe.uPolA.value = polarity(seg);
      wipe.uPolB.value = polarity(seg + 1);
    }
    // объёмы вырастают к концу сборки, пока точки в полёте, они им не мешают. Первые кадры
    // после загрузки рисуются все, сплющенными: видеодрайвер готовит такую отрисовку заранее,
    // а не посреди первого перехода
    const warm = loaded && s.warm < 3;
    if (warm) s.warm++;
    solids.current.forEach((mesh, i) => {
      if (!mesh) return;
      const amount = i === seg ? 1 - mix : i === seg + 1 ? mix : 0;
      const rise = smoothstep(amount, 0.75, 1);
      mesh.visible = rise > 0.001 || warm;
      mesh.scale.y = Math.max(rise, 0.001);
    });
    const station = mix > 0.5 ? seg + 1 : seg;
    if (loaded && station !== s.active) {
      s.active = station;
      onStation(station);
    }

    // без лишнего движения: такси и молоток стоят, предмет не качается
    const time = still.current ? 0 : state.clock.elapsedTime;
    u.uMix.value = mix;
    u.uTime.value = time;
    // если часть точек снята ради скорости, остальные чуть крупнее: предмет не редеет на глаз
    u.uKeep.value = stage.keep;
    u.uScale.value = height * dpr * 0.0026 * Math.pow(stage.keep, -0.3);

    // вход: из темноты проявляется галактика, разгоняется и сжимается, пока грузится портрет,
    // потом схлопывается в точку и рывком разлетается в предмет. Сначала плавно, потом резко
    const it = intro.current;
    if (still.current && it.loaded) {
      it.collapse = 1;
      it.burst = 1;
      it.after = 9;
    }
    it.t += dt;
    const hold = smoothstep(it.t, 0.2, HOLD);
    if (it.loaded && it.t > HOLD) it.collapse = Math.min(1, it.collapse + dt / 0.5);
    if (it.collapse >= 1) {
      it.burst = Math.min(1, it.burst + dt / 1.2);
      it.after += dt;
    }
    if (!still.current) it.spin += (0.5 + 2 * hold + 14 * it.collapse ** 2) * dt;
    u.uFade.value = still.current ? 1 : smoothstep(it.t, 0.3, 1.8);
    u.uGather.value = 0.45 * hold + 0.55 * it.collapse ** 3;
    u.uSpin.value = it.spin;
    u.uBurst.value = it.burst;
    (back.material as THREE.ShaderMaterial).uniforms.uFlash.value = it.after > 0 && !still.current ? Math.exp(-it.after * 5) : 0;
    stage.intro = clamp((it.after - 0.3) / 1.4, 0, 1);
    if (!it.told && it.after > 0.8) {
      it.told = true;
      onReady();
    }

    // предмет стоит посередине, в центре барабана: под ним остаётся место для заголовка,
    // по бокам для текста. На телефоне и планшете в портрете текст снизу, предмет сверху
    const shape = list[station] ?? WAITING;
    const k = 3.5;
    const targetX = 0;
    const frame = frameOf(mode, width, height, halfWidth, halfHeight);
    const targetY = frame.y;
    const targetScale = (shape.scale ?? 1) * frame.scale;
    if (!s.placed) {
      s.x = targetX;
      s.y = targetY;
      s.scale = targetScale;
      s.placed = true;
    }
    s.x = damp(s.x, targetX, k, dt);
    s.y = damp(s.y, targetY, k, dt);
    s.scale = damp(s.scale, targetScale, k, dt);
    // голова одна логика: смотрит на курсор, курсор в центре или его нет — прямо на нас.
    // Предметы сами чуть покачиваются и лишь немного поворачиваются за курсором
    const awake = still.current ? 1 : smoothstep(it.after, 0.4, 1.4);
    const look = share.inside ? 1 : 0;
    const turn = shape.portrait ? 0.45 * look : 0.25;
    const nod = shape.portrait ? 0.2 * look : 0.14;
    const sway = shape.sway ? Math.sin(time * 0.3) * shape.sway : 0;
    s.yaw = damp(s.yaw, (shape.yaw ?? 0) + (sway + share.pointer.x * turn) * awake, k, dt);
    s.pitch = damp(s.pitch, (shape.pitch ?? 0) - share.pointer.y * nod * awake, k, dt);
    // отпустили после вращения — крутится по инерции и на пружине возвращается на место
    if (!share.turning) {
      share.twistVel *= Math.exp(-2.4 * dt);
      share.twistVel -= share.twist * 7 * dt;
      share.twist += share.twistVel * dt;
    }
    // дальше упора не повернуть: там у предмета нет точек
    const limit = shape.twist ?? 1.3;
    if (Math.abs(share.twist) > limit) {
      share.twist = Math.sign(share.twist) * limit;
      share.twistVel *= -0.25;
    }
    points.position.set(s.x, s.y, 0);
    points.rotation.set(s.pitch, s.yaw + share.twist, 0);
    points.scale.setScalar(s.scale);
    points.updateMatrixWorld();
    // барабан держится за предмет без поправки на предмет: у города и малыша свой масштаб
    stage.x = s.x;
    stage.y = s.y;
    stage.scale = s.scale / (shape.scale ?? 1);

    // полутон приходит справа и заливает экран к концу перехода; центр предмета — для вспышки на входе
    const h = hit.current;
    h.ndc.set(s.x, s.y, 0).project(state.camera);
    wipe.uCenter.value.set((h.ndc.x * 0.5 + 0.5) * width * dpr, (h.ndc.y * 0.5 + 0.5) * height * dpr);
    wipe.uScreen.value.set(width * dpr, height * dpr);
    wipe.uCell.value = (mode === "phone" || mode === "low" ? 18 : 24) * dpr;
    wipe.uProgress.value = smoothstep(frac, 0.06, 0.94);
    // где предмет на экране: за эту область его можно взять и покрутить
    share.model.x = (h.ndc.x * 0.5 + 0.5) * width;
    share.model.y = (0.5 - h.ndc.y * 0.5) * height;
    share.model.rx = ((s.scale * 0.5) / halfWidth) * 0.5 * width;
    share.model.ry = ((s.scale * 0.6) / halfHeight) * 0.5 * height;

    h.ray.setFromCamera(state.pointer, state.camera);
    if (h.ray.ray.intersectPlane(h.plane, h.v)) (u.uMouse.value as THREE.Vector3).copy(points.worldToLocal(h.v.clone()));
    // новый клик: волна стартует из точки под курсором
    if (share.pulse.n !== s.pulse) {
      s.pulse = share.pulse.n;
      h.ray.setFromCamera(new THREE.Vector2(share.pulse.x, share.pulse.y), state.camera);
      if (h.ray.ray.intersectPlane(h.plane, h.v)) {
        (u.uPulse.value as THREE.Vector3).copy(points.worldToLocal(h.v.clone()));
        u.uPulseAge.value = 0;
      }
    }
    u.uPulseAge.value += dt;
    s.mouseOn = damp(s.mouseOn, share.inside ? 1 : 0, 6, dt);
    u.uMouseOn.value = s.mouseOn;
  });

  return (
    <>
      <primitive object={back} />
      {points && <primitive object={points} />}
    </>
  );
}
