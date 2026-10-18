"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { PackedSplats, RgbaArray, SplatEditSdf, SplatMesh, SplatSkinning } from "@sparkjsdev/spark";
import { dropTrianglesByTexture, posedSource, skinSource, skinnedBody, transferSkin, type SkinSource } from "@/lib/transfer";
import { BOTTOMS, TOPS, readScanColors, recolorShirt, trouserTexture, type ScanColors } from "./wardrobe";
import styles from "./lab.module.css";

// Стенд для скана: гауссов сплат через Spark, крутить мышкой, колесо — ближе.
// Spark тянет WASM и воркеры, поэтому подгружается только в браузере.
//
// Скан снят сидя и кончается на бёдрах. Ноги берём у модели в пуховике из генератора:
// от низа куртки до кед, переводим в сплаты с цветом текстуры и ставим под торс.
// Всё вместе двигает скелет манекена: поза покоя — его стойка с опущенными руками, как в скане,
// каждая частица получает кости ближайших вершин манекена в этой позе.

const SCAN = "/models/scan-clean.ply";
/** тот же скан целиком, от макушки до ступней: ноги свои, но сняты редко */
const SCAN_FULL = "/models/scan-full.ply";
const BODY = "/models/me-2018.glb";
const RIG = "/models/mannequin.glb";
/** в скане лицо смотрит левее оси z; разворачиваем, чтобы по умолчанию он смотрел в камеру */
const FACE_YAW = THREE.MathUtils.degToRad(30);
/** у модели в пуховике берём всё ниже этой высоты позы привязки (рост 1,8 м): штаны и кеды без куртки */
const LEG_TOP = 0.9;
/** штаны срезаны ровно на этой высоте сцены: на сантиметр выше края футболки */
const WAIST_CLIP = -0.69;
/** пол из скана, в координатах сцены (центр головы в нуле) */
const FLOOR_SCAN = -1.69;
/**
 * Скан срезан на 0,72 м ниже центра головы, а пояс штанов на скелете в позе по полу скана — на 0,775.
 * Поднимаем скелет со штанами, чтобы пояс на пару сантиметров зашёл под край скана; пола на сцене нет.
 */
const LEGS_LIFT = 0.085;
/** ось туловища скана у пояса */
const TORSO = new THREE.Vector2(0.012, 0);
/** макушка в координатах сцены */
const TARGET_TOP = 0.14;
/** камера по умолчанию: фигура целиком и небольшая */
const TARGET = new THREE.Vector3(0, -0.72, 0);
const DISTANCE = 4.8;
/** у манекена ступни на шаге ставятся почти в одну линию; разводим бёдра, чтобы ноги не казались скрещёнными */
const LEG_SPREAD = THREE.MathUtils.degToRad(5.5);
/** стоя манекен ставит ноги шире, чем стоят люди: сводим бёдра */
const STANCE_NARROW = THREE.MathUtils.degToRad(4);
/** кисти висят у шорт: частицы снаружи бёдер на этой высоте принадлежат рукам, а не ногам */
const HAND_DX = 0.165;
const HAND_Y = [-1.12, -0.78] as const;
/** голова — всё выше подбородка в этом радиусе от оси; шея — ось чуть позади центра головы */
const HEAD_RADIUS = 0.17;
const CHIN = -0.14;
const NECK_AXIS_Z = -0.02;
const NECK_RADIUS = 0.12;
const NECK_LOW = -0.22;
/** воротник и плечи у шеи: до этой глубины и в этом радиусе всё бесцветное — верх спины */
const COLLAR_LOW = -0.32;
const COLLAR_RADIUS = 0.18;
/** руки снаружи корпуса: предплечья от низа футболки до локтя, плечо от локтя до подмышки */
const ARM_DX = 0.165;
const FOREARM_Y = [-0.72, -0.42] as const;
const UPPER_ARM_DX = 0.19;
const UPPER_ARM_TOP = -0.22;
/**
 * Зрачки в координатах сцены в стойке (центр головы в нуле, лицо смотрит в +z).
 * Радужка двигается целиком, белок вокруг плавно тянется, веки почти стоят на месте.
 */
const EYES = [new THREE.Vector3(-0.023, 0.0077, 0.1091), new THREE.Vector3(0.0403, 0.0052, 0.101)];
const IRIS_R = 0.0055;
/** докуда тянется белок: вбок до уголков глаза, вверх и вниз почти сразу упирается в веки */
const EYE_REACH_H = 0.014;
const EYE_REACH_V = 0.0075;
/** ход зрачка: больше — заезжает на веко */
const EYE_TRAVEL_H = 0.0026;
const EYE_TRAVEL_V = 0.0009;
/** горизонталь глаза в координатах скана: скан повёрнут на FACE_YAW */
const EYE_RIGHT_LOCAL = new THREE.Vector3(Math.cos(Math.PI / 6), 0, Math.sin(Math.PI / 6));
/** закрытое веко: эллипс поверх глаза, чуть шире разреза */
const LID_HALF_W = 0.0125;
const LID_HALF_H = 0.0052;
/** настоящее верхнее веко: от линии ресниц до складки; поднимается, когда глаза широко открыты */
const LID_LASH = 0.0045;
const LID_CREASE = 0.012;
/** от верхних ресниц до нижних в середине глаза: на столько опускается край века */
const LID_SPAN = 0.0094;
/** полуширина закрытого века: чуть шире разреза, чтобы закрыть уголки */
const LID_W = 0.0131;
/** цвет закрытого века и ресниц — сняты с отрисованной кожи над глазом, она в тени глазницы */
const LID_COLOR = [0.39, 0.225, 0.16] as const;
const LASH_COLOR = [0.13, 0.075, 0.06] as const;
/** моргание: закрыть, подержать, открыть, секунды */
const BLINK = [0.07, 0.04, 0.12] as const;
/**
 * Мимика. Брови над зрачками, нижние веки под ними, уголки рта — найдены по карте лица скана.
 * Каждая зона двигается своей костью поверх головы, кожа вокруг плавно тянется.
 */
const BROW_ABOVE = 0.017;
/** кости поверх скелета: глаза, веки, нижние веки, брови, уголки рта */
const EXTRA_BONES = 10;
const MOUTH = [new THREE.Vector3(-0.016, -0.062, 0), new THREE.Vector3(0.032, -0.061, 0)];
/** центр лица по горизонтали: брови при хмурости сходятся к нему */
const FACE_MID_X = (EYES[0].x + EYES[1].x) / 2;
/** ходы мимики, метры */
const BROW_RAISE = 0.004;
const BROW_FROWN = 0.0022;
const LID_SQUINT = 0.0018;
const LID_WIDEN = 0.0014;
const SMILE_UP = 0.0026;
const SMILE_OUT = 0.002;
type Mood = "auto" | "smile" | "surprise" | "frown";
/** насколько фигура целиком поворачивается за курсором */
const MAX_YAW = THREE.MathUtils.degToRad(15);

type Pose = "idle" | "alive" | "walk";
type LegChain = { up: THREE.Bone; knee: THREE.Bone; foot: THREE.Bone; side: number };
type Legs = "scan" | "mesh";

type Built = {
  root: THREE.Object3D;
  bones: THREE.Bone[];
  restInv: THREE.Matrix4[];
  mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction;
  walk: THREE.AnimationAction;
  neck?: THREE.Bone;
  head?: THREE.Bone;
  arms: { bone: THREE.Bone; rest: THREE.Quaternion }[];
  hips: { bone: THREE.Bone; side: number }[];
  /** стойка: локальные повороты и положения всех костей, от них считается живая поза */
  rest: { q: THREE.Quaternion; p: THREE.Vector3 }[];
  pelvis?: THREE.Bone;
  spine: (THREE.Bone | undefined)[];
  legs: LegChain[];
  shoulders: { bone: THREE.Bone; side: number }[];
  parts: { mesh: SplatMesh; skinning: SplatSkinning }[];
  eyeBones?: [number, number];
  lidBones?: [number, number];
  face?: Pick<Hands, "lower" | "brows" | "mouth">;
  blink?: { hide: SplatEditSdf[]; mesh: SplatMesh; patch: LidPatch; rgba: RgbaArray; next: number; start: number; progress: number };
  walkWeight: number;
  /** срез штанов ездит вместе с тазом, иначе на шаге футболка уходит вниз и пояс вылезает */
  waist?: { plane: THREE.Plane; pelvisY: number };
  wardrobe: Wardrobe;
};

type Wardrobe = {
  scan: SplatMesh;
  colors: ScanColors;
  rgba: RgbaArray;
  legs?: THREE.SkinnedMesh;
  legsMap?: THREE.Texture | null;
  /** перекрашенные текстуры штанов, чтобы не считать заново при каждом переключении */
  trousers: Map<string, THREE.Texture>;
};

/** Ставит камеру вокруг фигуры под заданным углом. */
function Angle({ deg }: { deg: number }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (!controls) return;
    const a = THREE.MathUtils.degToRad(deg);
    controls.target.copy(TARGET);
    camera.position.set(TARGET.x + Math.sin(a) * DISTANCE, TARGET.y + 0.25, TARGET.z + Math.cos(a) * DISTANCE);
    // для проверок: ?cam=x,y,z&at=x,y,z ставит камеру точно
    const params = new URLSearchParams(window.location.search);
    const cam = params.get("cam")?.split(",").map(Number);
    const at = params.get("at")?.split(",").map(Number);
    if (cam?.length === 3) camera.position.set(cam[0], cam[1], cam[2]);
    if (at?.length === 3) controls.target.set(at[0], at[1], at[2]);
    controls.update();
  }, [deg, controls, camera]);
  return null;
}

/** Кости, которые раздаются частицам по геометрии скана, а не по ближайшим точкам манекена. */
type Hands = {
  left: number;
  right: number;
  legs: Set<number>;
  head: number;
  neck: number;
  chest: number;
  arm: { left: number; right: number };
  foreArm: { left: number; right: number };
  /** две дополнительные кости сверх скелета: сдвиг радужки поверх головы */
  eyes: [number, number];
  /** ещё две: закрытые веки, наезжают сверху при моргании */
  lids: [number, number];
  /** мимика: нижние веки, брови, уголки рта — по две кости */
  lower: [number, number];
  brows: [number, number];
  mouth: [number, number];
};

/** Раздаёт частицам кости манекена по ближайшим вершинам. Позы задаются без покоя: готовым поворотом и сдвигом. */
function skin(
  Skinning: typeof SplatSkinning,
  mesh: SplatMesh,
  source: SkinSource,
  numBones: number,
  hands: Hands,
): SplatSkinning {
  mesh.updateMatrixWorld(true);
  const centers: number[] = [];
  const colorful: boolean[] = [];
  const v = new THREE.Vector3();
  mesh.forEachSplat((_, center, _s, _q, _o, color) => {
    v.copy(center).applyMatrix4(mesh.matrixWorld);
    centers.push(v.x, v.y, v.z);
    // кожа и волосы тёплые и цветные, футболка с воротником почти бесцветные
    colorful.push(Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b) > 0.1);
  });
  // восемь соседей вместо четырёх: на стыках ткань тянется, а не рвётся
  const { skinIndex, skinWeight } = transferSkin(new Float32Array(centers), source, 8);

  // ближайший поиск ошибается там, где скан и манекен расходятся по форме; там кости задаём сами
  for (let i = 0; i < centers.length / 3; i++) {
    const x = centers[i * 3];
    const y = centers[i * 3 + 1];
    const z = centers[i * 3 + 2];
    const dx = x - TORSO.x;
    const side = dx > 0 ? "left" : "right";

    // голова у манекена другой формы, и подбородок доставался шее. Всё выше линии подбородка
    // в пределах головы — голова целиком; ниже, на шее, голове достаются только кожа и волосы,
    // а воротник и футболка остаются на корпусе
    if (y > CHIN && Math.hypot(x, z) < HEAD_RADIUS) {
      skinIndex.set([hands.head, 0, 0, 0], i * 4);
      skinWeight.set([1, 0, 0, 0], i * 4);
      // зоны мимики поверх головы. Каждая зона даёт свой вес; веса раскладываются по очереди —
      // первой забирает своё верхнее веко, остаток достаётся следующим, последней голове
      if (z > 0.03) {
        const zones: [number, number][] = [];
        const { smoothstep } = THREE.MathUtils;
        EYES.forEach((eye, e) => {
          const du = x - eye.x;
          const dv = y - eye.y;
          if (z < eye.z - 0.012) return;
          const across = 1 - smoothstep(Math.abs(du) / LID_HALF_W, 0.6, 1);
          // верхнее веко: от ресниц к складке вес спадает — при моргании кожа тянется, а не рвётся
          // ход века в каждом месте — высота разреза там: у уголков меньше, иначе веко переезжает на нижнее
          const open = Math.sqrt(Math.max(0, 1 - (du / LID_HALF_W) ** 2));
          if (dv > LID_LASH - 0.001) zones.push([hands.lids[e], across * open * (1 - smoothstep(dv, LID_LASH, LID_CREASE))]);
          // нижнее веко: сильнее всего у ресниц, к щеке спадает, радужку не трогает
          if (dv < -0.0015) zones.push([hands.lower[e], across * smoothstep(dv, -0.016, -0.0055) * (1 - smoothstep(dv, -0.0045, -0.0015))]);
          // бровь вместе со лбом над ней
          const db = dv - BROW_ABOVE;
          const wb = (1 - smoothstep(Math.abs(du), 0.012, 0.024)) * smoothstep(db, -0.009, -0.003) * (1 - smoothstep(db, 0.004, 0.03));
          if (wb > 0) zones.push([hands.brows[e], wb]);
          // радужка целиком на кости глаза, белок тянется к уголкам
          const r = Math.hypot(du, dv);
          const reach = THREE.MathUtils.lerp(EYE_REACH_V, EYE_REACH_H, Math.abs(du) / (r || 1));
          zones.push([hands.eyes[e], 1 - smoothstep(r, IRIS_R, reach)]);
        });
        MOUTH.forEach((corner, e) => {
          // в сторону щеки уголок тянет дальше, к середине губ — ближе
          const du = x - corner.x;
          const outward = (e === 0 ? -du : du) > 0;
          const r = Math.hypot(du * (outward ? 0.8 : 1.3), y - corner.y);
          zones.push([hands.mouth[e], 1 - smoothstep(r, 0.002, 0.014)]);
        });
        let rest = 1;
        const picked: [number, number][] = [];
        for (const [bone, w] of zones) {
          if (w <= 0.002 || picked.length === 3) continue;
          picked.push([bone, w * rest]);
          rest *= 1 - w;
        }
        if (picked.length) {
          skinIndex.set([...picked.map(([bone]) => bone), hands.head, 0, 0, 0].slice(0, 4), i * 4);
          skinWeight.set([...picked.map(([, w]) => w), rest, 0, 0, 0].slice(0, 4), i * 4);
        }
      }
      continue;
    }
    if (y > NECK_LOW && y <= CHIN && Math.hypot(x, z - NECK_AXIS_Z) < NECK_RADIUS && colorful[i]) {
      const w = THREE.MathUtils.smoothstep(y, NECK_LOW, CHIN);
      skinIndex.set([hands.head, hands.neck, 0, 0], i * 4);
      skinWeight.set([w, 1 - w, 0, 0], i * 4);
      continue;
    }
    // воротник и футболка у шеи — целиком верх спины. Если часть их частиц достаётся шее,
    // на повороте головы воротник рвётся полосами между шеей и неподвижными плечами
    if (!colorful[i] && y > COLLAR_LOW && y <= CHIN && Math.hypot(x, z - NECK_AXIS_Z) < COLLAR_RADIUS) {
      skinIndex.set([hands.chest, 0, 0, 0], i * 4);
      skinWeight.set([1, 0, 0, 0], i * 4);
      continue;
    }
    // руки снаружи корпуса целиком принадлежат руке своей стороны: таз под ними ходит, а рука нет
    if (Math.abs(dx) > ARM_DX && y > FOREARM_Y[0] && y < FOREARM_Y[1]) {
      skinIndex.set([hands.foreArm[side], 0, 0, 0], i * 4);
      skinWeight.set([1, 0, 0, 0], i * 4);
      continue;
    }
    if (Math.abs(dx) > UPPER_ARM_DX && y >= FOREARM_Y[1] && y < UPPER_ARM_TOP) {
      skinIndex.set([hands.arm[side], 0, 0, 0], i * 4);
      skinWeight.set([1, 0, 0, 0], i * 4);
      continue;
    }
    // кисти у бёдер ближайший поиск отдаёт ногам — тогда на шаге руку разрывает
    if (Math.abs(dx) >= HAND_DX && y >= HAND_Y[0] && y <= HAND_Y[1] && hands.legs.has(skinIndex[i * 4])) {
      skinIndex.set([hands[side], 0, 0, 0], i * 4);
      skinWeight.set([1, 0, 0, 0], i * 4);
    }
  }

  const skinning = new Skinning({ mesh, numBones });
  for (let b = 0; b < numBones; b++) skinning.setRestQuatPos(b, new THREE.Quaternion(), new THREE.Vector3());
  const bi = new THREE.Vector4();
  const bw = new THREE.Vector4();
  for (let i = 0; i < centers.length / 3; i++) {
    skinning.setSplatBones(i, bi.fromArray(skinIndex, i * 4), bw.fromArray(skinWeight, i * 4));
  }
  skinning.skinTexture.needsUpdate = true;
  mesh.skinning = skinning;
  mesh.updateGenerator();
  return skinning;
}

/** Слой закрытого века: точки сеткой по разрезу каждого глаза, на его поверхности. */
type LidPatch = { eye: number[]; du: number[]; dv: number[] };

function buildLids(scan: SplatMesh, splats: PackedSplats, patch: LidPatch) {
  scan.updateMatrixWorld(true);
  const cell = 0.0006;
  const v = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scales = new THREE.Vector3(0.0005, 0.0005, 0.00015);
  const color = new THREE.Color(LID_COLOR[0], LID_COLOR[1], LID_COLOR[2]);
  EYES.forEach((eye, e) => {
    // поверхность глаза и век: самая передняя частица в клетке
    const front = new Map<string, number>();
    scan.forEachSplat((_, center) => {
      v.copy(center).applyMatrix4(scan.matrixWorld);
      const du = v.x - eye.x;
      const dv = v.y - eye.y;
      if (Math.abs(du) > LID_W + 0.003 || dv < -0.009 || dv > 0.01 || v.z < eye.z - 0.015) return;
      const k = `${Math.round(du / cell)},${Math.round(dv / cell)}`;
      front.set(k, Math.max(front.get(k) ?? -Infinity, v.z));
    });
    for (let du = -LID_W; du <= LID_W; du += 0.0005) {
      for (let dv = LID_LASH - LID_SPAN - 0.001; dv <= LID_LASH + 0.0025; dv += 0.0005) {
        let z = -Infinity;
        const cu = Math.round(du / cell);
        const cv = Math.round(dv / cell);
        for (let a = -3; a <= 3; a++) for (let c = -3; c <= 3; c++) z = Math.max(z, front.get(`${cu + a},${cv + c}`) ?? -Infinity);
        if (!Number.isFinite(z)) z = eye.z;
        splats.pushSplat(v.set(eye.x + du, eye.y + dv, z + 0.0003), scales, quat, 1, color);
        patch.eye.push(e);
        patch.du.push(du);
        patch.dv.push(dv);
      }
    }
  });
}

function Figure({ pose, follow, legsFrom, top, bottom, mood, onInfo }: { pose: Pose; follow: boolean; legsFrom: Legs; top: string; bottom: string; mood: Mood; onInfo: (text: string) => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const { scene: rigScene, animations } = useGLTF(RIG);
  const { scene: body } = useGLTF(BODY);
  const built = useRef<Built | null>(null);
  const [ready, setReady] = useState(0);
  const look = useRef({ yaw: 0, pitch: 0, inside: false, eyeU: 0, eyeV: 0, lastMove: 0, lastClick: -10, saccade: { at: 0, u: 0, v: 0 } });
  /** текущая мимика, сглаженная: улыбка, прищур, удивление (брови и широкие глаза), хмурость */
  const face = useRef({ smile: 0, squint: 0, raise: 0, widen: 0, frown: 0 });
  // для проверки: ?blink=0.5 держит веко в этой фазе
  const [blinkForCheck] = useState(() => {
    const value = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("blink") : null;
    return value === null ? null : Number(value);
  });

  useEffect(() => {
    const canvas = gl.domElement;
    const enter = () => (look.current.inside = true);
    const leave = () => (look.current.inside = false);
    const move = () => (look.current.lastMove = performance.now() / 1000);
    const down = () => (look.current.lastClick = performance.now() / 1000);
    canvas.addEventListener("pointerenter", enter);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerdown", down);
    return () => {
      canvas.removeEventListener("pointerenter", enter);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerdown", down);
    };
  }, [gl]);

  useEffect(() => {
    let disposed = false;
    const added: THREE.Object3D[] = [];
    (async () => {
      const { SparkRenderer, SplatMesh, SplatSkinning, RgbaArray } = await import("@sparkjsdev/spark");
      if (disposed) return;

      // скелет манекена в стойке, подогнанный по росту и месту под фигуру
      const root = cloneSkinned(rigScene);
      root.scale.setScalar((TARGET_TOP - FLOOR_SCAN) / 1.8);
      root.position.set(TORSO.x, FLOOR_SCAN + (legsFrom === "mesh" ? LEGS_LIFT : 0), TORSO.y);
      let skeleton: THREE.Skeleton | undefined;
      root.traverse((obj) => {
        const m = obj as THREE.SkinnedMesh;
        if (m.isSkinnedMesh) skeleton ??= m.skeleton;
      });
      if (!skeleton) throw new Error("У манекена нет скелета");
      const mixer = new THREE.AnimationMixer(root);
      const clip = (name: string) => animations.find((a) => a.name === name) ?? animations[0];
      const idle = mixer.clipAction(clip("idle"));
      const walk = mixer.clipAction(clip("walk"));
      idle.play();
      walk.play();
      idle.setEffectiveWeight(1);
      walk.setEffectiveWeight(0);
      mixer.update(0);
      root.updateMatrixWorld(true);
      const bones = skeleton.bones;
      const restInv = bones.map((b) => b.matrixWorld.clone().invert());
      const rest = bones.map((b) => ({ q: b.quaternion.clone(), p: b.position.clone() }));
      const source = posedSource(root);

      // меньше экранного сглаживания: по умолчанию Spark размывает сильнее, чем нужно на таком масштабе
      const spark = new SparkRenderer({ renderer: gl, blurAmount: 0.12 });
      scene.add(spark);
      added.push(spark);

      const scan = new SplatMesh({ url: legsFrom === "scan" ? SCAN_FULL : SCAN });
      scan.rotation.y = FACE_YAW;
      scene.add(scan);
      added.push(scan);

      // штаны и кеды — обычная модель на том же скелете: кости переносятся в позе привязки,
      // поэтому ноги гнутся естественно, а скан обрезан по низу футболки, кисти уходят как будто в карманы
      let legs: THREE.SkinnedMesh | undefined;
      let waistPlane: THREE.Plane | undefined;
      if (legsFrom === "mesh") {
        const bind = skinSource(root);
        // режем модель с запасом, а ровную линию пояса даёт плоскость отсечения чуть выше края футболки
        const below = (v: THREE.Vector3) => v.y < LEG_TOP + 0.05;
        legs = skinnedBody(body, bind, skeleton, (a, b, c) => below(a) && below(b) && below(c));
        // жёлтый пуховик с той же модели: на ходьбе таз опускается, и его край вылезает из-под среза
        // в тени край куртки оранжевый, поэтому режем по насыщенности: у чёрных штанов и серых кед её нет
        dropTrianglesByTexture(legs, (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) > 0.16);
        const legsMaterial = legs.material as THREE.MeshStandardMaterial;
        waistPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), WAIST_CLIP);
        legsMaterial.clippingPlanes = [waistPlane];
        // снизу и сверху видно внутреннюю сторону штанин, без неё они просвечивают
        legsMaterial.side = THREE.DoubleSide;
        scene.add(legs);
        added.push(legs);
      }

      await scan.initialized;
      if (disposed) return;

      const meshes = [scan];
      const index = (re: RegExp) => bones.findIndex((b) => re.test(b.name));
      const hands: Hands = {
        left: index(/LeftHand$/),
        right: index(/RightHand$/),
        legs: new Set(bones.flatMap((b, i) => (/(UpLeg|Leg|Foot|Toe)/.test(b.name) ? [i] : []))),
        head: index(/Head$/),
        neck: index(/Neck$/),
        chest: index(/Spine2$/),
        arm: { left: index(/LeftArm$/), right: index(/RightArm$/) },
        foreArm: { left: index(/LeftForeArm$/), right: index(/RightForeArm$/) },
        eyes: [bones.length, bones.length + 1],
        lids: [bones.length + 2, bones.length + 3],
        lower: [bones.length + 4, bones.length + 5],
        brows: [bones.length + 6, bones.length + 7],
        mouth: [bones.length + 8, bones.length + 9],
      };
      const parts = meshes.map((mesh) => ({ mesh, skinning: skin(SplatSkinning, mesh, source, bones.length + EXTRA_BONES, hands) }));

      // моргание. Под опускающимся краем века частицы глаза становятся прозрачными (область перекраски
      // скана), а на их месте проявляется слой цвета века. Двигать частицы нельзя — веко выпирает,
      // просто перекрашивать тоже — у глаз сильные блики, они ложатся поверх и зрачок просвечивает
      const { SplatEdit, SplatEditSdf, SplatEditSdfType, SplatEditRgbaBlendMode } = await import("@sparkjsdev/spark");
      const hide = EYES.map(() => {
        const edit = new SplatEdit({ rgbaBlendMode: SplatEditRgbaBlendMode.SET_RGB, softEdge: 0.0006 });
        const sdf = new SplatEditSdf({ type: SplatEditSdfType.ELLIPSOID, opacity: 0 });
        sdf.position.set(0, 100, 0);
        edit.add(sdf);
        return { edit, sdf };
      });
      scan.edits = hide.map((h) => h.edit);
      scan.updateGenerator();

      const lidPatch: LidPatch = { eye: [], du: [], dv: [] };
      const lids = new SplatMesh({ constructSplats: (splats) => buildLids(scan, splats, lidPatch) });
      scene.add(lids);
      added.push(lids);
      await lids.initialized;
      if (disposed) return;
      const headBone = bones.findIndex((bone) => /Head$/.test(bone.name));
      const lidSkinning = new SplatSkinning({ mesh: lids, numBones: bones.length + EXTRA_BONES });
      for (let i = 0; i < bones.length + EXTRA_BONES; i++) lidSkinning.setRestQuatPos(i, new THREE.Quaternion(), new THREE.Vector3());
      lids.forEachSplat((i) => lidSkinning.setSplatBones(i, new THREE.Vector4(headBone, 0, 0, 0), new THREE.Vector4(1, 0, 0, 0)));
      lidSkinning.skinTexture.needsUpdate = true;
      lids.skinning = lidSkinning;
      const lidRgba = new RgbaArray({ array: new Uint8Array(lidPatch.du.length * 4), count: lidPatch.du.length });
      lids.splatRgba = lidRgba;
      lids.updateGenerator();
      lids.visible = false;
      parts.push({ mesh: lids, skinning: lidSkinning });
      built.current = {
        root,
        bones,
        restInv,
        mixer,
        idle,
        walk,
        neck: bones.find((b) => /Neck$/.test(b.name)),
        head: bones.find((b) => /Head$/.test(b.name)),
        arms: bones.filter((b) => /(Left|Right)(Shoulder|Arm|ForeArm|Hand)/.test(b.name)).map((bone) => ({ bone, rest: bone.quaternion.clone() })),
        hips: bones.filter((b) => /(Left|Right)UpLeg$/.test(b.name)).map((bone) => ({ bone, side: /Left/.test(bone.name) ? 1 : -1 })),
        rest,
        pelvis: bones.find((b) => /Hips$/.test(b.name)),
        spine: [/Spine$/, /Spine1$/, /Spine2$/].map((re) => bones.find((b) => re.test(b.name))),
        legs: (["Left", "Right"] as const).flatMap((side) => {
          const up = bones.find((b) => new RegExp(`${side}UpLeg$`).test(b.name));
          const knee = bones.find((b) => new RegExp(`${side}Leg$`).test(b.name));
          const foot = bones.find((b) => new RegExp(`${side}Foot$`).test(b.name));
          return up && knee && foot ? [{ up, knee, foot, side: side === "Left" ? 1 : -1 }] : [];
        }),
        shoulders: bones.filter((b) => /(Left|Right)Shoulder$/.test(b.name)).map((bone) => ({ bone, side: /Left/.test(bone.name) ? 1 : -1 })),
        parts,
        eyeBones: hands.eyes,
        lidBones: hands.lids,
        face: { lower: hands.lower, brows: hands.brows, mouth: hands.mouth },
        blink: { hide: hide.map((h) => h.sdf), mesh: lids, patch: lidPatch, rgba: lidRgba, next: 1.5, start: -1, progress: 0 },
        walkWeight: 0,
        waist: waistPlane && { plane: waistPlane, pelvisY: bones.find((b) => /Hips$/.test(b.name))!.getWorldPosition(new THREE.Vector3()).y },
        wardrobe: (() => {
          let n = 0;
          scan.forEachSplat(() => n++);
          const colors = readScanColors((cb) => scan.forEachSplat((i, center, _s, _q, opacity, color) => cb(i, center, opacity, color)), n);
          return {
            scan,
            colors,
            rgba: new RgbaArray({ array: new Uint8Array(n * 4), count: n }),
            legs,
            legsMap: legs ? (legs.material as THREE.MeshStandardMaterial).map : null,
            trousers: new Map(),
          };
        })(),
      };
      setReady((r) => r + 1);
      const count = built.current.wardrobe.colors.count;
      onInfo(`${count.toLocaleString("ru")} сплатов скана · ${legsFrom === "scan" ? "ноги свои" : "штаны и кеды из модели"} · готово`);
    })();
    return () => {
      disposed = true;
      built.current = null;
      added.forEach((obj) => scene.remove(obj));
    };
  }, [gl, scene, rigScene, animations, body, legsFrom, onInfo]);

  useEffect(() => {
    const w = built.current?.wardrobe;
    if (!w) return;
    const t = TOPS.find((x) => x.id === top) ?? TOPS[0];
    // как есть — исходные цвета скана вместе с бликами; перекраска их отключает
    // для проверки: ?rgba включает перекраску с исходными цветами — видно, сколько дают блики
    const forceRgba = new URLSearchParams(window.location.search).has("rgba");
    if (forceRgba && !(t.light && t.dark)) {
      w.rgba.array!.set(w.colors.rgba);
      w.rgba.needsUpdate = true;
      w.scan.splatRgba = w.rgba;
    } else if (t.light && t.dark) {
      recolorShirt(w.colors, t, w.rgba.array!);
      w.rgba.needsUpdate = true;
      w.scan.splatRgba = w.rgba;
    } else {
      w.scan.splatRgba = null;
    }
    w.scan.updateGenerator();

    const b = BOTTOMS.find((x) => x.id === bottom) ?? BOTTOMS[0];
    if (w.legs && w.legsMap) {
      const material = w.legs.material as THREE.MeshStandardMaterial;
      if (!b.color) material.map = w.legsMap;
      else {
        if (!w.trousers.has(b.id)) w.trousers.set(b.id, trouserTexture(w.legsMap, b.color));
        material.map = w.trousers.get(b.id)!;
      }
    }
  }, [top, bottom, ready]);

  const tmp = useRef({
    ray: new THREE.Raycaster(),
    plane: new THREE.Plane(),
    hit: new THREE.Vector3(),
    headPos: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    delta: new THREE.Quaternion(),
    p1: new THREE.Vector3(),
    eye: new THREE.Vector3(),
    up: new THREE.Vector3(),
    parentQ: new THREE.Quaternion(),
    euler: new THREE.Euler(0, 0, 0, "YXZ"),
    rel: new THREE.Matrix4(),
    obj: new THREE.Matrix4(),
    inv: new THREE.Matrix4(),
    q: new THREE.Quaternion(),
    t: new THREE.Vector3(),
    s: new THREE.Vector3(),
  });

  /** Доворачивает кость в мировых координатах, сохраняя её родителя. */
  const turn = (bone: THREE.Bone, delta: THREE.Quaternion) => {
    const t = tmp.current;
    bone.parent!.getWorldQuaternion(t.parentQ);
    bone.quaternion.premultiply(t.parentQ.clone().invert().multiply(delta).multiply(t.parentQ));
    bone.updateMatrixWorld(true);
  };

  const axisTurn = (bone: THREE.Bone | undefined, axis: THREE.Vector3, angle: number) => {
    if (bone) turn(bone, tmp.current.delta.setFromAxisAngle(axis, angle));
  };

  /**
   * Живая стойка: вес переходит с ноги на ногу примерно раз в пять секунд.
   * Таз смещается к опорной ноге и опускается со стороны свободной, свободная нога чуть сгибается,
   * ступни остаются на месте, корпус выпрямляется над тазом, грудь дышит. Руки висят от плеч —
   * своих движений у них нет, поэтому скан нигде не рвётся.
   */
  const alive = (b: Built, time: number) => {
    const t = tmp.current;
    const shift = Math.sin((time * Math.PI * 2) / 5.2);
    const ease = shift * (1.5 - 0.5 * shift * shift);
    const breath = Math.sin((time * Math.PI * 2) / 3.6);
    const drift = Math.sin((time * Math.PI * 2) / 7.3 + 1.1);
    const dx = 0.022 * ease;
    const roll = 0.045 * ease;

    if (b.pelvis?.parent) {
      b.pelvis.getWorldPosition(t.p1);
      t.p1.x += dx;
      t.p1.y -= 0.006 * Math.abs(ease);
      b.pelvis.position.copy(b.pelvis.parent.worldToLocal(t.p1));
      b.pelvis.updateMatrixWorld(true);
      axisTurn(b.pelvis, Z_AXIS, roll);
      axisTurn(b.pelvis, Y_AXIS, 0.025 * ease);
    }
    for (const leg of b.legs) {
      // нога снова вертикальна, а ступня возвращается туда, где стояла до смещения таза
      axisTurn(leg.up, Z_AXIS, -roll + Math.asin(-dx / LEG_LENGTH));
      const bend = 0.14 * Math.max(0, -leg.side * ease);
      axisTurn(leg.up, X_AXIS, -bend);
      axisTurn(leg.knee, X_AXIS, bend * 2);
      axisTurn(leg.foot, X_AXIS, -bend);
    }
    axisTurn(b.spine[0], Z_AXIS, -roll * 0.6);
    axisTurn(b.spine[1], X_AXIS, -0.012 * breath);
    axisTurn(b.spine[2], Z_AXIS, -roll * 0.25);
    axisTurn(b.spine[2], X_AXIS, -0.01 * breath);
    axisTurn(b.spine[2], Y_AXIS, 0.015 * drift);
    for (const sh of b.shoulders) axisTurn(sh.bone, Z_AXIS, sh.side * 0.012 * (breath * 0.5 + 0.5));
    axisTurn(b.neck, Z_AXIS, -roll * 0.15);
  };

  useFrame((state, dt) => {
    const b = built.current;
    if (!b) return;
    const t = tmp.current;
    const l = look.current;

    b.root.rotation.y = l.yaw;
    if (pose === "walk") {
      b.walkWeight = THREE.MathUtils.damp(b.walkWeight, 1, 4, dt);
      b.walk.setEffectiveWeight(b.walkWeight);
      b.idle.setEffectiveWeight(1 - b.walkWeight);
      b.mixer.update(dt);
      // «руки в карманах»: ноги идут по анимации, а таз только покачивается, без поворотов;
      // корпус, плечи и руки едут поверх него одним жёстким блоком — иначе скан тянется и рвётся
      if (b.rest) {
        const still = [b.pelvis, ...b.spine, b.neck, b.head, ...(b.arms ?? []).map((a) => a.bone)];
        for (const bone of still) if (bone) bone.quaternion.copy(b.rest[b.bones.indexOf(bone)].q);
      }
      b.root.updateMatrixWorld(true);
      for (const hip of b.hips ?? []) turn(hip.bone, t.delta.setFromAxisAngle(Z_AXIS, hip.side * LEG_SPREAD * b.walkWeight));
    } else if (b.rest) {
      // стоит: каждый кадр от стойки, а живая поза добавляет к ней переминание и дыхание
      b.walkWeight = 0;
      b.bones.forEach((bone, i) => {
        bone.quaternion.copy(b.rest[i].q);
        bone.position.copy(b.rest[i].p);
      });
      b.root.updateMatrixWorld(true);
      for (const hip of b.hips ?? []) turn(hip.bone, t.delta.setFromAxisAngle(Z_AXIS, -hip.side * STANCE_NARROW));
      if (pose === "alive") alive(b, state.clock.elapsedTime);
    }

    // за курсором поворачивается вся фигура целиком. Голову отдельно не крутим: скан при этом
    // рвётся у подбородка, воротника и затылка, а жёсткий поворот всей фигуры ничего не тянет
    let yaw = 0;
    let eyeU = 0;
    let eyeV = 0;
    const now = performance.now() / 1000;
    const want = { smile: 0, squint: 0, raise: 0, widen: 0, frown: 0 };
    if (b.head) t.headPos.setFromMatrixPosition(b.head.matrixWorld).project(state.camera);
    const idle = !l.inside || now - l.lastMove > 2.5;
    if (b.head && follow && l.inside) {
      // от головы на экране до курсора: так реакция одинаковая при любом приближении камеры
      const dx = THREE.MathUtils.clamp(state.pointer.x - t.headPos.x, -1, 1);
      const dy = THREE.MathUtils.clamp(state.pointer.y - t.headPos.y, -1, 1);
      yaw = dx * MAX_YAW;
      // глаза успевают раньше тела и упираются в край быстрее
      eyeU = THREE.MathUtils.clamp(dx * 1.6, -1, 1) * EYE_TRAVEL_H;
      eyeV = THREE.MathUtils.clamp(dy * 1.6, -1, 1) * EYE_TRAVEL_V;

      if (mood === "auto") {
        // курсор на лице — улыбается; кликнули — удивился на секунду
        const ppm = state.size.height / (2 * state.camera.position.distanceTo(t.p1.setFromMatrixPosition(b.head.matrixWorld)) * Math.tan(THREE.MathUtils.degToRad(17.5)));
        const px = Math.hypot(dx * state.size.width / 2, dy * state.size.height / 2);
        const onFace = 1 - THREE.MathUtils.smoothstep(px / (0.11 * ppm), 0.7, 1.3);
        want.smile = onFace;
        want.squint = onFace * 0.6;
        const sinceClick = now - l.lastClick;
        const shock = sinceClick < 1.2 ? 1 - THREE.MathUtils.smoothstep(sinceClick, 0.7, 1.2) : 0;
        want.raise = Math.max(want.raise, shock);
        want.widen = Math.max(want.widen, shock);
        want.smile *= 1 - shock;
      }
    }
    // курсор замер или ушёл — взгляд сам гуляет короткими скачками, как у живого
    if (idle) {
      if (now > l.saccade.at) {
        l.saccade.at = now + 0.6 + Math.random() * 1.6;
        l.saccade.u = (Math.random() * 2 - 1) * EYE_TRAVEL_H * 0.6;
        l.saccade.v = (Math.random() * 2 - 1) * EYE_TRAVEL_V * 0.6;
      }
      eyeU = l.saccade.u;
      eyeV = l.saccade.v;
    }
    if (mood === "smile") Object.assign(want, { smile: 1, squint: 0.6 });
    if (mood === "surprise") Object.assign(want, { raise: 1, widen: 1 });
    if (mood === "frown") Object.assign(want, { frown: 1, squint: 0.4 });
    const f = face.current;
    for (const key of Object.keys(want) as (keyof typeof want)[]) {
      // мимика включается быстро, отпускает медленнее
      f[key] = THREE.MathUtils.damp(f[key], want[key], want[key] > f[key] ? 9 : 4, dt);
    }
    l.yaw = THREE.MathUtils.damp(l.yaw, yaw, 2.5, dt);
    l.eyeU = THREE.MathUtils.damp(l.eyeU, eyeU, idle ? 25 : 14, dt);
    l.eyeV = THREE.MathUtils.damp(l.eyeV, eyeV, idle ? 25 : 14, dt);

    if (b.waist && b.pelvis) b.waist.plane.constant = WAIST_CLIP + b.pelvis.getWorldPosition(t.p1).y - b.waist.pelvisY;

    // моргание раз в 2,5–6 секунд, иногда двойное
    const blink = b.blink;
    if (blink) {
      const now = state.clock.elapsedTime;
      if (blink.start < 0 && now > blink.next) blink.start = now;
      let p = 0;
      if (blink.start >= 0) {
        const k = now - blink.start;
        const [close, hold, open] = BLINK;
        if (k < close) p = THREE.MathUtils.smoothstep(k, 0, close);
        else if (k < close + hold) p = 1;
        else if (k < close + hold + open) p = 1 - THREE.MathUtils.smoothstep(k, close + hold, close + hold + open);
        else {
          blink.start = -1;
          blink.next = now + (Math.random() < 0.15 ? 0.25 : 2.5 + Math.random() * 3.5);
        }
      }
      if (blinkForCheck !== null) p = blinkForCheck;
      blink.progress = p;
      // эллипс века в стойке: верх уходит в кожу над ресницами, низ — опускающиеся ресницы
      const headIndex = b.bones.indexOf(b.head!);
      t.rel.multiplyMatrices(b.head!.matrixWorld, b.restInv[headIndex]);
      t.rel.decompose(t.t, t.q, t.s);
      const lid = EYES.map((eye, e) => {
        const top = LID_LASH + 0.0025;
        const lash = LID_LASH - p * LID_SPAN;
        const cy = (top + lash) / 2;
        const hy = Math.max((top - lash) / 2, 1e-5);
        const sdf = blink.hide[e];
        if (p < 0.02) sdf.position.set(0, 100, 0);
        else {
          sdf.position.set(eye.x, eye.y + cy, eye.z - 0.001).applyMatrix4(t.rel);
          sdf.quaternion.copy(t.q);
          sdf.scale.set(LID_W, hy, 0.0045);
        }
        return { cy, hy };
      });
      blink.mesh.visible = p >= 0.02;
      if (blink.mesh.visible) {
        // слой века проявляется ровно в том же эллипсе, по нижнему краю — ресницы
        const { eye, du, dv } = blink.patch;
        const out = blink.rgba.array!;
        for (let i = 0; i < du.length; i++) {
          const { cy, hy } = lid[eye[i]];
          const across = Math.max(0, 1 - (du[i] / LID_W) ** 2);
          const inside = (du[i] / LID_W) ** 2 + ((dv[i] - cy) / hy) ** 2;
          const alpha = 1 - THREE.MathUtils.smoothstep(inside, 0.82, 1);
          const fromLash = dv[i] - (cy - hy * Math.sqrt(across));
          const lash = 1 - THREE.MathUtils.smoothstep(fromLash, 0.0004, 0.0012);
          // веко выпуклое: к середине светлее, к складке темнее
          const shade = 1 + 0.12 * across * (1 - Math.abs(dv[i] - cy) / hy) - 0.1 * THREE.MathUtils.smoothstep(dv[i], LID_LASH, LID_LASH + 0.0025);
          for (let c = 0; c < 3; c++) {
            const value = THREE.MathUtils.lerp(LID_COLOR[c] * shade, LASH_COLOR[c], lash);
            out[i * 4 + c] = Math.round(THREE.MathUtils.clamp(value, 0, 1) * 255);
          }
          out[i * 4 + 3] = Math.round(alpha * 255);
        }
        blink.rgba.needsUpdate = true;
      }
    }

    // каждой кости — поворот и сдвиг от стойки к текущей позе, в координатах каждой части
    for (const part of b.parts) {
      part.mesh.updateMatrixWorld();
      t.inv.copy(part.mesh.matrixWorld).invert();
      for (let i = 0; i < b.bones.length; i++) {
        t.rel.multiplyMatrices(b.bones[i].matrixWorld, b.restInv[i]);
        t.obj.multiplyMatrices(t.inv, t.rel).multiply(part.mesh.matrixWorld);
        t.obj.decompose(t.t, t.q, t.s);
        part.skinning.setBoneQuatPos(i, t.q, t.t);
        // кости глаз — та же голова, только сдвинутая вдоль глаза до её поворота
        if (b.bones[i] === b.head && b.eyeBones) {
          t.eye.copy(EYE_RIGHT_LOCAL).multiplyScalar(l.eyeU).add(t.up.set(0, l.eyeV, 0)).applyQuaternion(t.q).add(t.t);
          for (const e of b.eyeBones) part.skinning.setBoneQuatPos(e, t.q, t.eye);
          // сдвиг кости мимики задан в осях лица: x вправо, y вверх, z вперёд;
          // части повёрнуты по-разному (скан на FACE_YAW, подложка век нет), поэтому переводим
          const fc = face.current;
          const shift = (bone: number, x: number, y: number, z: number) => {
            t.eye.set(x, y, z).applyAxisAngle(Y_AXIS, -part.mesh.rotation.y).applyQuaternion(t.q).add(t.t);
            part.skinning.setBoneQuatPos(bone, t.q, t.eye);
          };
          if (b.lidBones && b.blink) {
            const p = b.blink.progress;
            for (const lid of b.lidBones) shift(lid, 0, (1 - p) * fc.widen * LID_WIDEN, 0);
          }
          if (b.face) {
            b.face.lower.forEach((bone) => shift(bone, 0, fc.squint * LID_SQUINT, 0));
            b.face.brows.forEach((bone, e) => {
              const inward = Math.sign(FACE_MID_X - EYES[e].x);
              shift(bone, inward * fc.frown * BROW_FROWN, fc.raise * BROW_RAISE - fc.frown * BROW_FROWN, 0);
            });
            b.face.mouth.forEach((bone, e) => {
              const outward = e === 0 ? -1 : 1;
              shift(bone, outward * fc.smile * SMILE_OUT, fc.smile * SMILE_UP, -fc.smile * 0.0006);
            });
          }
        }
      }
      part.skinning.updateBones();
    }
  });

  return null;
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
/** длина ноги для возврата ступни на место при смещении таза */
const LEG_LENGTH = 0.85;

const ANGLES: [number, string][] = [[0, "0°"], [90, "90°"], [180, "180°"], [270, "270°"]];

export function ScanLab() {
  const [info, setInfo] = useState("Загружаю скан…");
  const [deg, setDeg] = useState(0);
  const [follow, setFollow] = useState(true);
  const [pose, setPose] = useState<Pose>("alive");
  const [legsFrom, setLegsFrom] = useState<Legs>("mesh");
  const [mood, setMood] = useState<Mood>("auto");
  const [top, setTop] = useState(TOPS[0].id);
  const [bottom, setBottom] = useState(BOTTOMS[0].id);
  return (
    <div className={styles.lab} data-dark>
      <Canvas dpr={[1, 2]} gl={{ antialias: false, localClippingEnabled: true }} camera={{ fov: 35, near: 0.02, far: 200, position: [0, -0.47, 4.8] }}>
        <color attach="background" args={["#0b0b0c"]} />
        {/* свет нужен только штанам: сплаты несут освещение в себе */}
        <hemisphereLight args={["#ffffff", "#2a2a2a", 1.3]} />
        <directionalLight position={[1.5, 2.5, 3]} intensity={1.8} />
        <OrbitControls makeDefault enablePan screenSpacePanning target={TARGET} />
        <Angle deg={deg} />
        <Suspense fallback={null}>
          <Figure key={legsFrom} pose={pose} follow={follow} legsFrom={legsFrom} top={top} bottom={bottom} mood={mood} onInfo={setInfo} />
        </Suspense>
      </Canvas>
      <div className={styles.panel}>
        <div className={styles.title}>Скан · крути мышкой, колесо — ближе, правая кнопка — сдвиг</div>
        <div>{info}</div>
        <div className={styles.group}>
          <span>Ракурс</span>
          {ANGLES.map(([value, label]) => (
            <button key={value} type="button" className={value === deg ? styles.on : undefined} onClick={() => setDeg(value)}>
              {label}
            </button>
          ))}
        </div>
        <div className={styles.group}>
          <span>Верх</span>
          {TOPS.map((t) => (
            <button key={t.id} type="button" className={t.id === top ? styles.on : undefined} onClick={() => setTop(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className={styles.group}>
          <span>Низ</span>
          {BOTTOMS.map((b) => (
            <button key={b.id} type="button" className={b.id === bottom ? styles.on : undefined} onClick={() => setBottom(b.id)}>
              {b.label}
            </button>
          ))}
        </div>
        <div className={styles.group}>
          <span>Ноги</span>
          <button type="button" className={legsFrom === "scan" ? styles.on : undefined} onClick={() => setLegsFrom("scan")}>
            Из скана
          </button>
          <button type="button" className={legsFrom === "mesh" ? styles.on : undefined} onClick={() => setLegsFrom("mesh")}>
            Штаны из модели
          </button>
        </div>
        <div className={styles.group}>
          <span>Мимика</span>
          {([["auto", "От курсора"], ["smile", "Улыбка"], ["surprise", "Удивление"], ["frown", "Хмурится"]] as [Mood, string][]).map(([value, label]) => (
            <button key={value} type="button" className={value === mood ? styles.on : undefined} onClick={() => setMood(value)}>
              {label}
            </button>
          ))}
        </div>
        <div className={styles.group}>
          <span>Поза</span>
          <button type="button" className={pose === "idle" ? styles.on : undefined} onClick={() => setPose("idle")}>
            Стоит
          </button>
          <button type="button" className={pose === "alive" ? styles.on : undefined} onClick={() => setPose("alive")}>
            Переминается
          </button>
          <button type="button" className={pose === "walk" ? styles.on : undefined} onClick={() => setPose("walk")}>
            Идёт
          </button>
        </div>
        <div className={styles.group}>
          <span>Взгляд</span>
          <button type="button" className={follow ? styles.on : undefined} onClick={() => setFollow(true)}>
            Поворачивается
          </button>
          <button type="button" className={!follow ? styles.on : undefined} onClick={() => setFollow(false)}>
            Прямо
          </button>
        </div>
      </div>
    </div>
  );
}
