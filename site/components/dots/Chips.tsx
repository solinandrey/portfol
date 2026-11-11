"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CHAPTERS, CONTACTS } from "@/lib/story";
import { CONTACT_ICONS } from "@/lib/contact-icons";
import { track, trackOnce } from "@/lib/analytics";
import { boxHit, COMMON, INK, ORANGE, PAPER, stacked, type Stage } from "./paper";
import type { Shared } from "./Cloud";

// Стек этапа — микросхемы, которые летают вокруг предмета. Вылетают из заголовка, когда он
// встал. Чип можно схватить и бросить, он вернётся на орбиту на пружине; по клику переворачивается.
// На последнем экране вместо стека летают контакты: квадратные чипы со знаком сервиса, клик открывает ссылку.

/** высота и толщина корпуса, в масштабе предмета */
const H = 0.07;
const T = 0.022;
const LABEL_PX = 96;
/** сторона квадратного чипа со знаком сервиса */
const ICON = 0.125;
const ICON_PX = 192;
const { damp, clamp } = THREE.MathUtils;
const noHit = () => {};
const FORWARD = new THREE.Vector3(0, 0, 1);

const BODY_VERTEX = /* glsl */ `
  attribute float aTone;
  varying vec3 vNormal;
  varying float vTone;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vTone = aTone;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const BODY_FRAGMENT = /* glsl */ `
  ${COMMON}
  uniform float uHot;
  varying vec3 vNormal;
  varying float vTone;
  void main() {
    float paper = paperAt(gl_FragCoord.xy);
    vec3 bg = mix(${INK}, ${PAPER}, paper);
    vec3 body = mix(mix(${PAPER}, ${INK}, paper), ${ORANGE}, uHot);
    vec3 n = normalize(vNormal);
    float light = clamp(dot(n, normalize(vec3(-0.4, 0.7, 0.6))), 0.0, 1.0);
    // ножки наполовину к фону, скруглённые бока чуть темнее лица
    vec3 color = mix(bg, body, mix(0.5, 1.0, vTone));
    color = mix(color, bg, (1.0 - light) * 0.3 * (1.0 - abs(n.z)));
    gl_FragColor = vec4(color, 1.0);
  }
`;
const LABEL_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const LABEL_FRAGMENT = /* glsl */ `
  ${COMMON}
  uniform sampler2D uMap;
  uniform float uHot;
  varying vec2 vUv;
  void main() {
    float a = texture2D(uMap, vUv).a;
    if (a < 0.02) discard;
    vec3 bg = mix(${INK}, ${PAPER}, paperAt(gl_FragCoord.xy));
    gl_FragColor = vec4(mix(bg, ${INK}, uHot), a);
  }
`;

type Chip = {
  key: string;
  /** чип-контакт: клик открывает ссылку */
  href?: string;
  stop: number;
  index: number;
  count: number;
  phase: number;
  group: THREE.Group;
  body: THREE.Mesh;
  hot: { value: number };
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  flip: number;
  flipVel: number;
  present: number;
  wait: number;
  on: boolean;
  hover: boolean;
  drag: boolean;
  moved: number;
  dragTo: THREE.Vector3;
  dispose: () => void;
};

/** Надпись на крышке: белое на прозрачном, цвет даёт шейдер. Слева метка первой ножки. */
function labelTexture(text: string, family: string) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = `600 44px ${family}`;
  ctx.font = font;
  canvas.width = Math.ceil(ctx.measureText(text).width + 118);
  canvas.height = LABEL_PX;
  ctx.font = font;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 72, LABEL_PX / 2 + 2);
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(38, LABEL_PX / 2, 9, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return { texture, length: (H * canvas.width) / LABEL_PX };
}

/** Знак сервиса на крышке: тот же белый по прозрачному, контур из поля 24×24 занимает 58% стороны. */
function iconTexture(path: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = ICON_PX;
  const ctx = canvas.getContext("2d")!;
  const size = ICON_PX * 0.58;
  ctx.translate((ICON_PX - size) / 2, (ICON_PX - size) / 2);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = "#fff";
  ctx.fill(new Path2D(path));
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

/** Корпус и ножки одной геометрией: тон 1 у корпуса, 0 у ножек. */
function chipGeometry(length: number, height = H) {
  const tone = (g: THREE.BufferGeometry, value: number) => {
    const flat = g.toNonIndexed();
    flat.setAttribute("aTone", new THREE.Float32BufferAttribute(new Float32Array(flat.attributes.position.count).fill(value), 1));
    g.dispose();
    return flat;
  };
  const parts = [tone(new RoundedBoxGeometry(length, height, T, 3, 0.01), 1)];
  const pins = Math.max(2, Math.floor((length - 0.04) / 0.026));
  for (let k = 0; k < pins; k++) {
    const x = (k / (pins - 1) - 0.5) * (length - 0.05);
    for (const side of [-1, 1]) {
      const pin = new THREE.BoxGeometry(0.011, 0.024, 0.005);
      pin.translate(x, side * (height / 2 + 0.008), -T * 0.2);
      parts.push(tone(pin, 0));
    }
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

export function Chips({ shared, stage }: { shared: RefObject<Shared>; stage: Stage }) {
  const [chips, setChips] = useState<Chip[] | null>(null);
  const gl = useThree((state) => state.gl);
  const tools = useMemo(() => ({ plane: new THREE.Plane(), hit: new THREE.Vector3(), target: new THREE.Vector3(), prev: new THREE.Vector3(), still: false, clocks: [] as number[], held: [] as boolean[] }), []);

  useEffect(() => {
    tools.still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    let built: Chip[] = [];
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "monospace";
    document.fonts.load(`600 44px ${family}`).then(() => {
      if (cancelled) return;
      const make = (key: string, stop: number, index: number, count: number, texture: THREE.Texture, length: number, height: number, href?: string): Chip => {
        // подпись сразу в видеопамять, а не в момент, когда чип впервые вылетит
        gl.initTexture(texture);
        const hot = { value: 0 };
        const body = new THREE.Mesh(
          chipGeometry(length, height),
          new THREE.ShaderMaterial({ vertexShader: BODY_VERTEX, fragmentShader: BODY_FRAGMENT, uniforms: { ...stage.wipe, uHot: hot } }),
        );
        const face = new THREE.Mesh(
          new THREE.PlaneGeometry(length, height),
          new THREE.ShaderMaterial({
            vertexShader: LABEL_VERTEX,
            fragmentShader: LABEL_FRAGMENT,
            uniforms: { ...stage.wipe, uHot: hot, uMap: { value: texture } },
            transparent: true,
            depthWrite: false,
          }),
        );
        body.geometry.computeBoundingBox();
        body.userData.hitBox = body.geometry.boundingBox!.clone().expandByVector(new THREE.Vector3(0.02, 0.03, 0.03));
        face.position.z = T / 2 + 0.0008;
        face.raycast = noHit;
        const group = new THREE.Group();
        group.add(body, face);
        group.visible = false;
        return {
          key,
          href,
          stop,
          index,
          count,
          phase: Math.random() * Math.PI * 2,
          group,
          body,
          hot,
          pos: new THREE.Vector3(),
          vel: new THREE.Vector3(),
          flip: 0,
          flipVel: 0,
          present: 0,
          wait: 0,
          on: false,
          hover: false,
          drag: false,
          moved: 0,
          dragTo: new THREE.Vector3(),
          dispose: () => {
            body.geometry.dispose();
            (body.material as THREE.Material).dispose();
            face.geometry.dispose();
            (face.material as THREE.Material).dispose();
            texture.dispose();
          },
        };
      };
      const links = CONTACTS.filter((c) => CONTACT_ICONS[c.label]);
      built = [
        ...CHAPTERS.flatMap((chapter, c) =>
          chapter.stack.map((label, index) => {
            const { texture, length } = labelTexture(label, family);
            return make(`${chapter.id}-${label}`, c + 1, index, chapter.stack.length, texture, length, H);
          }),
        ),
        ...links.map((c, index) => make(`contact-${c.label}`, CHAPTERS.length + 1, index, links.length, iconTexture(CONTACT_ICONS[c.label]), ICON, ICON, c.href)),
      ];
      setChips(built);
      stage.parts++;
    });
    return () => {
      cancelled = true;
      built.forEach((c) => c.dispose());
    };
  }, [stage, tools, gl]);

  const cursor = (value: string) => (document.body.style.cursor = value);
  const handlers = (c: Chip) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      c.hover = true;
      if (!c.drag) cursor(c.href ? "pointer" : "grab");
    },
    onPointerOut: () => {
      c.hover = false;
      if (!c.drag) cursor("");
    },
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      c.drag = true;
      c.moved = 0;
      // взятый чип выезжает к нам и тащится в плоскости экрана перед предметом
      tools.plane.set(FORWARD, -Math.max(c.pos.z, stage.scale * 0.9));
      shared.current.grabbing = true;
      c.dragTo.copy(c.pos);
      if (e.ray.intersectPlane(tools.plane, tools.hit)) c.dragTo.copy(tools.hit);
      document.body.style.userSelect = "none";
      cursor("grabbing");
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      if (!c.drag) return;
      c.moved += Math.abs(e.nativeEvent.movementX) + Math.abs(e.nativeEvent.movementY);
      if (e.ray.intersectPlane(tools.plane, tools.hit)) c.dragTo.copy(tools.hit);
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      if (!c.drag) return;
      (e.target as Element).releasePointerCapture(e.pointerId);
      c.drag = false;
      shared.current.grabbing = false;
      // не тащили — значит, клик: чип переворачивается; бросили — крутится от скорости
      c.flipVel += c.moved < 5 ? 15 : clamp(c.vel.length() * 7, 0, 22);
      // у контакта клик ещё и открывает ссылку: почту здесь же, остальное в новой вкладке
      if (c.moved >= 5) trackOnce("chip_dragged", { chip: c.key });
      if (c.href && c.moved < 5) {
        track("contact_clicked", { channel: c.key.replace("contact-", ""), place: "chip" });
        if (c.href.startsWith("mailto:")) window.location.href = c.href;
        else window.open(c.href, "_blank", "noopener,noreferrer");
      }
      document.body.style.userSelect = "";
      cursor(c.hover ? (c.href ? "pointer" : "grab") : "");
    },
    onPointerCancel: () => {
      c.drag = false;
      shared.current.grabbing = false;
      document.body.style.userSelect = "";
      cursor("");
    },
  });

  // первый показ чипа дорогой (программы, буферы), поэтому все чипы один раз рисуются
  // крошечными ещё во время входа, а не посреди первого перехода
  const warm = useMemo(() => ({ frames: 2 }), []);
  useFrame((state, rawDt) => {
    if (!chips) return;
    if (warm.frames > 0) {
      warm.frames--;
      for (const c of chips) {
        c.group.visible = warm.frames > 0;
        c.group.position.set(stage.x, stage.y, -0.5);
        c.group.scale.setScalar(1e-4);
      }
      return;
    }
    const dt = Math.min(rawDt, 1 / 30);
    const time = tools.still ? 0 : state.clock.elapsedTime;
    const narrow = stacked(stage.mode);
    const rx = stage.scale * (narrow ? 0.5 : 0.66);
    const rz = stage.scale * 0.78;
    const target = tools.target;

    // Часы у чипов одной остановки общие. Навели на чип или взяли его — замирает всё кольцо.
    // Когда часы были у каждого свои, тронутый чип отставал навсегда и наезжал на соседа
    const { clocks, held } = tools;
    held.fill(false);
    for (const c of chips) if (c.on && (c.hover || c.drag)) held[c.stop] = true;
    for (const c of chips) {
      if (c.index !== 0) continue;
      clocks[c.stop] ??= 0;
      if (!tools.still && c.on && !held[c.stop]) clocks[c.stop] += dt;
    }

    for (const c of chips) {
      const on = Math.abs(stage.smooth - c.stop) < 0.38;
      if (on && !c.on) {
        // вылетают из заголовка по очереди слева направо
        const spread = c.count > 1 ? c.index / (c.count - 1) - 0.5 : 0;
        c.pos.copy(stage.slot).add(target.set(spread * stage.titleWidth * 0.8, 0, 0));
        c.vel.set((Math.random() - 0.5) * 0.6, 1.4 + Math.random() * 0.6, 0.3).multiplyScalar(stage.scale);
        c.flipVel = 10 + Math.random() * 6;
        c.wait = tools.still ? 0 : 0.12 + c.index * 0.07;
        c.present = 0;
      }
      if (!on && c.on) {
        // разлетаются в стороны
        target.set(c.pos.x - stage.x, 0.4, c.pos.z).normalize().multiplyScalar(2 * stage.scale);
        c.vel.add(target);
        c.drag = false;
      }
      c.on = on;
      if (c.wait > 0) {
        c.wait -= dt;
        c.group.visible = false;
        continue;
      }
      c.present = damp(c.present, on ? 1 : 0, on ? 6 : 7, dt);
      const visible = c.present > 0.01;
      c.group.visible = visible;
      c.body.raycast = visible && on ? boxHit : noHit;
      if (!visible) continue;

      // место на орбите: эллипс вокруг предмета, спереди чуть ниже, сзади выше
      const a = (c.index / c.count) * Math.PI * 2 + clocks[c.stop] * 0.16 + c.stop * 0.9;
      target.set(
        stage.x + Math.cos(a) * rx,
        stage.y + stage.scale * (0.1 - Math.sin(a) * 0.19 + Math.sin(time * 0.9 + c.phase) * 0.04),
        Math.sin(a) * rz,
      );
      if (c.drag) {
        const prev = tools.prev.copy(c.pos);
        c.pos.x = damp(c.pos.x, c.dragTo.x, 30, dt);
        c.pos.y = damp(c.pos.y, c.dragTo.y, 30, dt);
        c.pos.z = damp(c.pos.z, c.dragTo.z, 30, dt);
        c.vel.copy(c.pos).sub(prev).divideScalar(dt);
      } else {
        // пружина с небольшим перелётом
        const k = on ? 14 : 0;
        c.vel.x += ((target.x - c.pos.x) * k - c.vel.x * 3.6) * dt;
        c.vel.y += ((target.y - c.pos.y) * k - c.vel.y * 3.6) * dt;
        c.vel.z += ((target.z - c.pos.z) * k - c.vel.z * 3.6) * dt;
        c.pos.addScaledVector(c.vel, dt);
      }

      // переворот затухает и доводится до целого оборота, чтобы надпись снова смотрела на нас
      const rest = Math.round(c.flip / (Math.PI * 2)) * Math.PI * 2;
      c.flipVel += ((rest - c.flip) * 18 - c.flipVel * 4.5) * dt;
      c.flip += c.flipVel * dt;
      c.hot.value = damp(c.hot.value, c.hover || c.drag ? 1 : 0, 10, dt);

      c.group.position.copy(c.pos);
      c.group.rotation.set(c.flip + Math.sin(time * 0.8 + c.phase) * 0.14, -Math.cos(a) * 0.45, Math.sin(time * 0.6 + c.phase) * 0.1);
      const grow = 1 - Math.pow(1 - c.present, 3);
      c.group.scale.setScalar(stage.scale * (narrow ? 0.72 : 0.85) * grow * (1 + c.hot.value * 0.15));
    }
  });

  return (
    <>
      {chips?.map((c) => (
        <primitive key={c.key} object={c.group} {...handlers(c)} />
      ))}
    </>
  );
}
