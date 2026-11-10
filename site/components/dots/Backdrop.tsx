"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { COMMON, INK, PAPER, type Stage } from "./paper";
import type { Shared } from "./Cloud";

// Фон: комната. Экран — открытая грань коробки, мы смотрим внутрь: пол, потолок и стены
// сходятся к задней стене, сцена стоит внутри. Стены расчерчены тонкой сеткой: лучи уходят
// в точку схода, поперёк них рёбра через равный шаг, и глубина читается сразу.
// Курсор сдвигает точку схода, как если бы зритель заглянул в коробку сбоку. Сетка на задней
// стене, полу и потолке едет вбок вслед за барабаном. На входе задняя стена стоит вплотную
// к экрану плоской сеткой, а после взрыва её отбрасывает вглубь — и появляется объём.
// Стены именно сеткой, а не точками: точки рядом с рёбрами коробки читались как мешанина.
// Под текстом сетки нет: блоки с пометкой data-clear вырезают в ней окно с мягким краем,
// иначе линии проходят сквозь строки и читаются как лежащие поверх текста.

/** передняя грань комнаты стоит на этом z: всё, что на барабане, остаётся внутри */
const FRONT = 0.8;
/** глубина комнаты: задняя стена на экране выходит чуть меньше половины его размера */
const DEPTH = 2.1;
/** шаг сетки, в единицах мира: в глубину комнаты укладывается ровно семь шагов */
const CELL = 0.3;
/** на сколько единиц узор уезжает вбок за один радиан поворота барабана */
const DRIFT = 0.32;
const { clamp, damp, smoothstep } = THREE.MathUtils;

const VERTEX = /* glsl */ `
  uniform vec3 uRoom;
  uniform vec2 uLean;
  uniform float uPush;
  attribute float aFace;
  varying vec3 vAt;
  varying float vFace;
  void main() {
    // position: x и y от -1 до 1 по проёму, z — доля глубины. Пока стену не оттолкнуло, глубины нет
    float deep = position.z * uRoom.z * uPush;
    vAt = vec3(position.xy * uRoom.xy * 0.5, deep);
    vFace = aFace;
    // чем глубже, тем сильнее сдвиг: проём стоит на месте, задняя стена уезжает за точкой схода
    vec3 p = vec3(vAt.xy + uLean * deep, ${FRONT.toFixed(2)} - deep);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const FRAGMENT = /* glsl */ `
  ${COMMON}
  uniform vec3 uRoom;
  uniform float uPush, uDrift, uAlpha, uPixel;
  uniform vec4 uClear[2];
  varying vec3 vAt;
  varying float vFace;

  // окно под текстом: прямоугольник в пикселях экрана, внутри сетки нет, наружу она возвращается плавно
  float outside(vec4 r) {
    if (r.z <= r.x) return 1.0;
    vec2 d = abs(gl_FragCoord.xy - (r.xy + r.zw) * 0.5) - (r.zw - r.xy) * 0.5;
    float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    return smoothstep(10.0 * uPixel, 64.0 * uPixel, dist);
  }

  // линия сетки толщиной в один пиксель экрана на любой глубине; v — координата в шагах сетки.
  // Там, где линии в перспективе сливаются, они гаснут, а не рябят
  float rule(float v) {
    float w = max(fwidth(v), 1e-5);
    float d = abs(fract(v - 0.5) - 0.5) / w;
    return (1.0 - smoothstep(0.5 * uPixel, 0.5 * uPixel + 1.0, d)) * (1.0 - smoothstep(0.2, 0.45, w));
  }

  void main() {
    vec2 half_ = uRoom.xy * 0.5;
    float deep = uRoom.z * uPush;
    // across — координата вдоль стены поперёк взгляда, along — вторая: высота или глубина
    float across, along, edge, shade;
    if (vFace < 0.5) {
      across = vAt.x - uDrift;
      along = vAt.y;
      edge = min(half_.x - abs(vAt.x), half_.y - abs(vAt.y));
      shade = 0.6;
    } else if (vFace < 1.5) {
      across = vAt.y;
      along = vAt.z;
      edge = min(deep - vAt.z, half_.y - abs(vAt.y));
      shade = 0.62;
    } else {
      across = vAt.x - uDrift;
      along = vAt.z;
      edge = min(deep - vAt.z, half_.x - abs(vAt.x));
      // пол светлее потолка: на нём стоит сцена
      shade = vAt.y < 0.0 ? 0.9 : 0.5;
    }
    // у самого проёма стены тают: там сетка крупная и лезла бы под текст
    if (vFace > 0.5) shade *= smoothstep(0.0, 0.8, vAt.z);
    // ребро, где стены сходятся
    float seam = (1.0 - smoothstep(0.5 * uPixel, 0.5 * uPixel + 1.0, edge / max(fwidth(edge), 1e-5))) * step(0.02, uPush);
    float lines = max(rule(across / ${CELL.toFixed(2)}), rule(along / ${CELL.toFixed(2)}));
    float paper = paperAt(gl_FragCoord.xy);
    // на светлой стороне тёмная сетка заметнее, чем светлая на тёмной: там она бледнее
    float alpha = max(lines * 0.17, seam * 0.3) * shade * mix(1.0, 0.7, paper);
    alpha *= uAlpha * outside(uClear[0]) * outside(uClear[1]);
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(mix(${PAPER}, ${INK}, paper), alpha);
  }
`;

/** Пять граней коробки изнутри: задняя стена, две боковые, пол и потолок. */
function roomGeometry() {
  const position: number[] = [];
  const face: number[] = [];
  const quad = (kind: number, a: number[], b: number[], c: number[], d: number[]) => {
    for (const v of [a, b, c, a, c, d]) {
      position.push(...v);
      face.push(kind);
    }
  };
  quad(0, [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]);
  quad(1, [-1, -1, 0], [-1, -1, 1], [-1, 1, 1], [-1, 1, 0]);
  quad(1, [1, -1, 1], [1, -1, 0], [1, 1, 0], [1, 1, 1]);
  quad(2, [-1, -1, 0], [1, -1, 0], [1, -1, 1], [-1, -1, 1]);
  quad(2, [-1, 1, 1], [1, 1, 1], [1, 1, 0], [-1, 1, 0]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute("aFace", new THREE.Float32BufferAttribute(face, 1));
  return geometry;
}

export function Backdrop({ shared, stage }: { shared: RefObject<Shared>; stage: Stage }) {
  const room = useMemo(() => {
    const mesh = new THREE.Mesh(
      roomGeometry(),
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          ...stage.wipe,
          uRoom: { value: new THREE.Vector3(1, 1, DEPTH) },
          uLean: { value: new THREE.Vector2() },
          uPush: { value: 0 },
          uDrift: { value: 0 },
          uAlpha: { value: 0 },
          uPixel: { value: 1 },
          uClear: { value: [new THREE.Vector4(), new THREE.Vector4()] },
        },
        transparent: true,
        // сверяется с глубиной: прозрачное рисуется после букв и чипов, и без проверки сетка
        // ложилась бы поверх них. Сама в глубину не пишет
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = -0.9;
    return mesh;
  }, [stage]);
  const sim = useRef({ x: 0, y: 0, age: 0, frame: 0, nodes: [] as Element[] });

  useEffect(
    () => () => {
      room.geometry.dispose();
      (room.material as THREE.Material).dispose();
    },
    [room],
  );

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const u = (room.material as THREE.ShaderMaterial).uniforms;
    const camera = state.camera as THREE.PerspectiveCamera;
    const s = sim.current;
    // проём ровно по краям экрана: сколько мира видно на глубине передней грани
    const near = camera.position.z - FRONT;
    const height = 2 * near * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    (u.uRoom.value as THREE.Vector3).set(height * camera.aspect * 1.01, height * 1.01, DEPTH);

    // задняя стена стоит за предметом, а не за серединой экрана: на телефоне предмет вверху,
    // и точка схода уходит туда же. Курсор отводит её в противоположную сторону
    const far = (near + DEPTH) / camera.position.z;
    const p = shared.current.pointer;
    s.x = damp(s.x, stage.x * far - p.x * 0.11, 4, dt);
    s.y = damp(s.y, stage.y * far - p.y * 0.07, 4, dt);
    (u.uLean.value as THREE.Vector2).set(s.x / DEPTH, s.y / DEPTH);

    // вход: стену отбрасывает от зрителя с небольшим перелётом, и она встаёт на место
    const t = clamp(stage.intro, 0, 1) - 1;
    u.uPush.value = 1 + 2.4 * t * t * t + 1.4 * t * t;
    u.uDrift.value = -stage.spin * DRIFT;
    u.uPixel.value = state.viewport.dpr;
    s.age += dt;
    u.uAlpha.value = smoothstep(s.age, 0.3, 1.6);

    // где сейчас текст: блоки меняются с остановкой, поэтому список обновляется несколько раз в секунду.
    // Окно доезжает до нового места плавно, а новое появляется сразу по размеру блока
    if (s.frame++ % 8 === 0) s.nodes = [...document.querySelectorAll("[data-clear]")].slice(0, 2);
    const canvas = state.gl.domElement.getBoundingClientRect();
    const dpr = state.viewport.dpr;
    const windows = u.uClear.value as THREE.Vector4[];
    windows.forEach((w, i) => {
      const node = s.nodes[i];
      const r = node?.isConnected ? node.getBoundingClientRect() : null;
      if (!r || r.width < 2 || r.height < 2) return void w.set(0, 0, 0, 0);
      const x0 = (r.left - canvas.left) * dpr, x1 = (r.right - canvas.left) * dpr;
      const y0 = (canvas.bottom - r.bottom) * dpr, y1 = (canvas.bottom - r.top) * dpr;
      if (w.z <= w.x) return void w.set(x0, y0, x1, y1);
      w.set(damp(w.x, x0, 10, dt), damp(w.y, y0, 10, dt), damp(w.z, x1, 10, dt), damp(w.w, y1, 10, dt));
    });
  });

  return <primitive object={room} />;
}
