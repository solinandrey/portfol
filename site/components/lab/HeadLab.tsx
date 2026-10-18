"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { SplatMesh, SplatSkinning } from "@sparkjsdev/spark";
import { dropTrianglesByTexture, skinSource, skinnedBody } from "@/lib/transfer";
import styles from "./lab.module.css";

// Голова из скана на теле из генератора. Скан гнуть не приходится: голова целиком сидит на кости
// головы и шеи, а всё, что гнётся, — обычная 3D-модель на скелете манекена. Шов на шее закрывает ворот.

const HEAD = "/models/scan-head.ply";
/**
 * Тела из генератора. Выше шеи у каждого остаётся только ворот, остальное срезается по цвету текстуры:
 * голову модели заменяет скан.
 */
type BodyId = "tee" | "jacket";
const BODIES: Record<BodyId, { url: string; label: string; collar: (r: number, g: number, b: number, c: THREE.Vector3) => boolean }> = {
  tee: {
    url: "/models/body-tee.glb",
    label: "Лонгслив",
    // белый круглый ворот; кожа шеи и всё выше срезаются
    collar: (r, g, b, c) => c.y < TEE_COLLAR_TOP && (r + g + b) / 3 > 0.62 && Math.max(r, g, b) - Math.min(r, g, b) < 0.12,
  },
  jacket: {
    url: "/models/me-2018.glb",
    label: "Пуховик",
    // капюшон худи и ворот пуховика; спереди на уровне подбородка тёмное — контур челюсти модели
    collar: (r, g, b, c) => {
      if (c.y > HEAD_CUT || (c.y > CHIN_CUT && c.z > 0 && Math.abs(c.x) < 0.1)) return false;
      const dark = (r + g + b) / 3 < 0.22 && Math.max(r, g, b) - Math.min(r, g, b) < 0.15;
      return dark || (r > 0.4 && b < g * 0.5);
    },
  },
};
const RIG = "/models/mannequin.glb";
const { degToRad, smoothstep, clamp, damp } = THREE.MathUtils;

/** в скане лицо смотрит левее оси z; разворачиваем, чтобы по умолчанию он смотрел в камеру */
const FACE_YAW = degToRad(30);
/** пол и макушка скана относительно центра головы: по ним скелет приводится к росту */
const FLOOR = -1.69;
const TOP = 0.14;
const TORSO_X = 0.012;
/** выше подбородка частицы целиком на кости головы, ниже плавно переходят на шею */
const CHIN = -0.14;
const NECK_LOW = -0.26;
/** у тела срезаем голову: выше NECK_CUT в позе привязки остаётся только ворот, выше HEAD_CUT ничего */
const NECK_CUT = 1.45;
const HEAD_CUT = 1.6;
const CHIN_CUT = 1.5;
const TEE_COLLAR_TOP = 1.56;
/** руки чуть в стороны: опущенные из позы Т рукава иначе уходят внутрь объёмной куртки */
const ARM_OUT = degToRad(12);
const MAX_YAW = degToRad(32);
const MAX_PITCH = degToRad(18);
const LEG_LENGTH = 0.85;
const TARGET = new THREE.Vector3(0, -0.72, 0);
const DISTANCE = 4.8;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

type Pose = "idle" | "alive" | "walk";

type Rig = {
  root: THREE.Object3D;
  bones: THREE.Bone[];
  rest: { q: THREE.Quaternion; p: THREE.Vector3 }[];
  restInv: THREE.Matrix4[];
  mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction;
  walk: THREE.AnimationAction;
  walkWeight: number;
  find: (re: RegExp) => THREE.Bone | undefined;
  head: { mesh: SplatMesh; skinning: SplatSkinning; bones: number[] };
};

/** Параметры для подгонки на глаз: ?cam=x,y,z&at=x,y,z&head=dx,dy,dz&neck=1.45 */
function param(name: string) {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get(name)?.split(",").map(Number);
}

function Angle({ deg }: { deg: number }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (!controls) return;
    const a = degToRad(deg);
    controls.target.copy(TARGET);
    camera.position.set(TARGET.x + Math.sin(a) * DISTANCE, TARGET.y + 0.25, TARGET.z + Math.cos(a) * DISTANCE);
    const cam = param("cam");
    const at = param("at");
    if (cam?.length === 3) camera.position.set(cam[0], cam[1], cam[2]);
    if (at?.length === 3) controls.target.set(at[0], at[1], at[2]);
    controls.update();
  }, [deg, controls, camera]);
  return null;
}

function Figure({ bodyId, pose, follow, onInfo }: { bodyId: BodyId; pose: Pose; follow: boolean; onInfo: (text: string) => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const { scene: rigScene, animations } = useGLTF(RIG);
  const { scene: bodyScene } = useGLTF(BODIES[bodyId].url);
  const rig = useRef<Rig | null>(null);
  const look = useRef({ yaw: 0, pitch: 0, inside: false });
  const tmp = useRef({
    ray: new THREE.Raycaster(),
    plane: new THREE.Plane(),
    hit: new THREE.Vector3(),
    headPos: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    delta: new THREE.Quaternion(),
    parentQ: new THREE.Quaternion(),
    euler: new THREE.Euler(0, 0, 0, "YXZ"),
    p1: new THREE.Vector3(),
    rel: new THREE.Matrix4(),
    obj: new THREE.Matrix4(),
    inv: new THREE.Matrix4(),
    q: new THREE.Quaternion(),
    t: new THREE.Vector3(),
    s: new THREE.Vector3(),
  });

  useEffect(() => {
    const canvas = gl.domElement;
    const enter = () => (look.current.inside = true);
    const leave = () => (look.current.inside = false);
    canvas.addEventListener("pointerenter", enter);
    canvas.addEventListener("pointerleave", leave);
    return () => {
      canvas.removeEventListener("pointerenter", enter);
      canvas.removeEventListener("pointerleave", leave);
    };
  }, [gl]);

  useEffect(() => {
    let disposed = false;
    const added: THREE.Object3D[] = [];
    (async () => {
      const { SparkRenderer, SplatMesh, SplatSkinning } = await import("@sparkjsdev/spark");
      if (disposed) return;

      // скелет манекена, приведённый к росту из скана
      const root = cloneSkinned(rigScene);
      root.scale.setScalar((TOP - FLOOR) / 1.8);
      root.position.set(TORSO_X, FLOOR, 0);
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
      walk.setEffectiveWeight(0);
      mixer.update(0);
      root.updateMatrixWorld(true);
      const bones = skeleton.bones;
      const rest = bones.map((b) => ({ q: b.quaternion.clone(), p: b.position.clone() }));
      const restInv = bones.map((b) => b.matrixWorld.clone().invert());
      const find = (re: RegExp) => bones.find((b) => re.test(b.name));

      // тело: вся модель на скелете, без головы — выше шеи остаётся только ворот
      const neckCut = param("neck")?.[0] ?? NECK_CUT;
      const body = skinnedBody(bodyScene, skinSource(root), skeleton);
      dropTrianglesByTexture(body, (r, g, b, c) => c.y > neckCut && !BODIES[bodyId].collar(r, g, b, c));
      (body.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      scene.add(body);
      added.push(body);

      const spark = new SparkRenderer({ renderer: gl, blurAmount: 0.12 });
      scene.add(spark);
      added.push(spark);

      const head = new SplatMesh({ url: HEAD });
      head.rotation.y = FACE_YAW;
      const offset = param("head");
      if (offset?.length === 3) head.position.set(offset[0], offset[1], offset[2]);
      scene.add(head);
      added.push(head);
      await head.initialized;
      if (disposed) return;

      // кости частицам: выше подбородка голова, ниже плавный переход на шею
      const headBone = bones.findIndex((b) => /Head$/.test(b.name));
      const neckBone = bones.findIndex((b) => /Neck$/.test(b.name));
      const skinning = new SplatSkinning({ mesh: head, numBones: bones.length });
      for (let i = 0; i < bones.length; i++) skinning.setRestQuatPos(i, new THREE.Quaternion(), new THREE.Vector3());
      const bi = new THREE.Vector4(headBone, neckBone, 0, 0);
      const bw = new THREE.Vector4();
      let count = 0;
      head.forEachSplat((i, center) => {
        const w = smoothstep(center.y, NECK_LOW, CHIN);
        skinning.setSplatBones(i, bi, bw.set(w, 1 - w, 0, 0));
        count++;
      });
      skinning.skinTexture.needsUpdate = true;
      head.skinning = skinning;
      head.updateGenerator();

      rig.current = { root, bones, rest, restInv, mixer, idle, walk, walkWeight: 0, find, head: { mesh: head, skinning, bones: [headBone, neckBone] } };
      onInfo(`${count.toLocaleString("ru")} частиц головы · тело из модели · готово`);
    })();
    return () => {
      disposed = true;
      rig.current = null;
      added.forEach((obj) => scene.remove(obj));
    };
  }, [gl, scene, rigScene, animations, bodyScene, bodyId, onInfo]);

  /** Доворачивает кость в мировых координатах, сохраняя её родителя. */
  const turn = (bone: THREE.Bone | undefined, delta: THREE.Quaternion) => {
    if (!bone?.parent) return;
    const t = tmp.current;
    bone.parent.getWorldQuaternion(t.parentQ);
    bone.quaternion.premultiply(t.parentQ.clone().invert().multiply(delta).multiply(t.parentQ));
    bone.updateMatrixWorld(true);
  };
  const axisTurn = (bone: THREE.Bone | undefined, axis: THREE.Vector3, angle: number) => turn(bone, tmp.current.delta.setFromAxisAngle(axis, angle));

  /** Переминание: вес с ноги на ногу раз в пять секунд, ступни на месте, корпус над тазом, дыхание. */
  const alive = (r: Rig, time: number) => {
    const t = tmp.current;
    const shift = Math.sin((time * Math.PI * 2) / 5.2);
    const ease = shift * (1.5 - 0.5 * shift * shift);
    const breath = Math.sin((time * Math.PI * 2) / 3.6);
    const drift = Math.sin((time * Math.PI * 2) / 7.3 + 1.1);
    const dx = 0.022 * ease;
    const roll = 0.045 * ease;
    const pelvis = r.find(/Hips$/);
    if (pelvis?.parent) {
      pelvis.getWorldPosition(t.p1);
      t.p1.x += dx;
      t.p1.y -= 0.006 * Math.abs(ease);
      pelvis.position.copy(pelvis.parent.worldToLocal(t.p1));
      pelvis.updateMatrixWorld(true);
      axisTurn(pelvis, Z_AXIS, roll);
      axisTurn(pelvis, Y_AXIS, 0.025 * ease);
    }
    for (const [side, sign] of [["Left", 1], ["Right", -1]] as const) {
      const bend = 0.14 * Math.max(0, -sign * ease);
      axisTurn(r.find(new RegExp(`${side}UpLeg$`)), Z_AXIS, -roll + Math.asin(-dx / LEG_LENGTH));
      axisTurn(r.find(new RegExp(`${side}UpLeg$`)), X_AXIS, -bend);
      axisTurn(r.find(new RegExp(`${side}Leg$`)), X_AXIS, bend * 2);
      axisTurn(r.find(new RegExp(`${side}Foot$`)), X_AXIS, -bend);
      // руки у тела-модели свои, им можно чуть отставать от корпуса
      axisTurn(r.find(new RegExp(`${side}Arm$`)), Z_AXIS, sign * 0.03 * (breath * 0.5 + 0.5) - roll * 0.4);
    }
    axisTurn(r.find(/Spine$/), Z_AXIS, -roll * 0.6);
    axisTurn(r.find(/Spine1$/), X_AXIS, -0.012 * breath);
    axisTurn(r.find(/Spine2$/), Z_AXIS, -roll * 0.25);
    axisTurn(r.find(/Spine2$/), X_AXIS, -0.01 * breath);
    axisTurn(r.find(/Spine2$/), Y_AXIS, 0.015 * drift);
    axisTurn(r.find(/Neck$/), Z_AXIS, -roll * 0.15);
  };

  useFrame((state, rawDt) => {
    const r = rig.current;
    if (!r) return;
    const dt = Math.min(rawDt, 1 / 20);
    const t = tmp.current;
    const l = look.current;

    if (pose === "alive") {
      r.bones.forEach((bone, i) => {
        bone.quaternion.copy(r.rest[i].q);
        bone.position.copy(r.rest[i].p);
      });
      r.root.updateMatrixWorld(true);
      alive(r, state.clock.elapsedTime);
    } else {
      r.walkWeight = damp(r.walkWeight, pose === "walk" ? 1 : 0, 4, dt);
      r.walk.setEffectiveWeight(r.walkWeight);
      r.idle.setEffectiveWeight(1 - r.walkWeight);
      r.mixer.update(dt);
      r.root.updateMatrixWorld(true);
    }

    axisTurn(r.find(/LeftArm$/), Z_AXIS, ARM_OUT);
    axisTurn(r.find(/RightArm$/), Z_AXIS, -ARM_OUT);

    // взгляд за курсором; со спины голова смотрит прямо — под волосами у скана нет данных
    let yaw = 0;
    let pitch = 0;
    const headBone = r.bones[r.head.bones[0]];
    if (follow && l.inside) {
      headBone.getWorldPosition(t.headPos);
      state.camera.getWorldDirection(t.normal).negate();
      t.plane.setFromNormalAndCoplanarPoint(t.normal, t.headPos.clone().addScaledVector(t.normal, 0.42));
      t.ray.setFromCamera(state.pointer, state.camera);
      if (t.ray.ray.intersectPlane(t.plane, t.hit)) {
        const d = t.hit.sub(t.headPos);
        yaw = clamp(Math.atan2(d.x, d.z), -MAX_YAW, MAX_YAW);
        pitch = clamp(Math.atan2(d.y - 0.1, Math.hypot(d.x, d.z)), -MAX_PITCH, MAX_PITCH);
      }
    }
    const front = smoothstep(Math.cos(Math.atan2(state.camera.position.x - TORSO_X, state.camera.position.z)), 0, 0.6);
    l.yaw = damp(l.yaw, yaw * front, 4, dt);
    l.pitch = damp(l.pitch, pitch * front, 4, dt);
    turn(r.find(/Neck$/), t.delta.setFromEuler(t.euler.set(-l.pitch * 0.4, l.yaw * 0.4, 0, "YXZ")));
    turn(headBone, t.delta.setFromEuler(t.euler.set(-l.pitch * 0.6, l.yaw * 0.6, 0, "YXZ")));

    // частицам головы нужны только кости головы и шеи
    const mesh = r.head.mesh;
    mesh.updateMatrixWorld();
    t.inv.copy(mesh.matrixWorld).invert();
    for (const i of r.head.bones) {
      t.rel.multiplyMatrices(r.bones[i].matrixWorld, r.restInv[i]);
      t.obj.multiplyMatrices(t.inv, t.rel).multiply(mesh.matrixWorld);
      t.obj.decompose(t.t, t.q, t.s);
      r.head.skinning.setBoneQuatPos(i, t.q, t.t);
    }
    r.head.skinning.updateBones();
  });

  return null;
}

const ANGLES: [number, string][] = [[0, "0°"], [90, "90°"], [180, "180°"], [270, "270°"]];
const POSES: [Pose, string][] = [["idle", "Стоит"], ["alive", "Переминается"], ["walk", "Идёт"]];

export function HeadLab() {
  const [info, setInfo] = useState("Загружаю…");
  const [deg, setDeg] = useState(0);
  const [pose, setPose] = useState<Pose>("alive");
  const [follow, setFollow] = useState(true);
  const [bodyId, setBodyId] = useState<BodyId>("tee");
  return (
    <div className={styles.lab} data-dark>
      <Canvas dpr={[1, 2]} gl={{ antialias: true }} camera={{ fov: 35, near: 0.02, far: 200, position: [0, -0.47, 4.8] }}>
        <color attach="background" args={["#0b0b0c"]} />
        {/* свет нужен только телу: частицы головы несут освещение комнаты в себе */}
        <hemisphereLight args={["#ffffff", "#2a2a2a", 1.3]} />
        <directionalLight position={[1.5, 2.5, 3]} intensity={1.8} />
        <directionalLight position={[-2, 1.5, -2.5]} intensity={0.8} />
        <OrbitControls makeDefault enablePan screenSpacePanning target={TARGET} />
        <Angle deg={deg} />
        <Suspense fallback={null}>
          <Figure key={bodyId} bodyId={bodyId} pose={pose} follow={follow} onInfo={setInfo} />
        </Suspense>
      </Canvas>
      <div className={styles.panel}>
        <div className={styles.title}>Голова из скана, тело из модели · крути мышкой, колесо — ближе</div>
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
          <span>Тело</span>
          {(Object.keys(BODIES) as BodyId[]).map((id) => (
            <button key={id} type="button" className={id === bodyId ? styles.on : undefined} onClick={() => setBodyId(id)}>
              {BODIES[id].label}
            </button>
          ))}
        </div>
        <div className={styles.group}>
          <span>Поза</span>
          {POSES.map(([value, label]) => (
            <button key={value} type="button" className={value === pose ? styles.on : undefined} onClick={() => setPose(value)}>
              {label}
            </button>
          ))}
        </div>
        <div className={styles.group}>
          <span>Взгляд</span>
          <button type="button" className={follow ? styles.on : undefined} onClick={() => setFollow(true)}>
            За курсором
          </button>
          <button type="button" className={!follow ? styles.on : undefined} onClick={() => setFollow(false)}>
            Прямо
          </button>
        </div>
      </div>
    </div>
  );
}
