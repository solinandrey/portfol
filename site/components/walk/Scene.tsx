"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { STAGES } from "@/lib/stages";
import { mulberry32, sampleSkinned, type Cloud } from "@/lib/sampling";
import { alignTo, sampleTextured, skinSource, transferSkin } from "@/lib/transfer";
import { dotsFragment, dotsVertex, figureFragment, figureVertex } from "./shaders";
import { walkState } from "./state";

/** манекен даёт скелет и анимации ходьбы */
const MODEL = "/models/mannequin.glb";
/** модель Андрея из генератора; пока её нет, частицы берутся с самого манекена */
const BODY: string | null = "/models/me-2018.glb";
const COUNT = 32000;
const STATUE_EVERY = 3;
/** ширина одной эпохи по оси шага, м */
const STEP = 1.6;
/** столько манекен проходит за полный цикл ходьбы: фаза идёт от пройденного пути, и ноги не скользят */
const STRIDE = 1.45;
/** быстрее фигура не идёт, как ни крути колесо */
const MAX_SPEED = 1.9;
const MARCH_SPEED = 1.15;
const FOV = 35;
const LAST = STAGES.length - 1;
const PATH = LAST * STEP;
const gateX = (k: number) => (k + 0.5) * STEP;
/** статуя прошлой эпохи остаётся чуть позади проёма */
const statueX = (k: number) => gateX(k) - 0.35;

type Rig = {
  root: THREE.Object3D;
  skeleton: THREE.Skeleton;
  mixer: THREE.AnimationMixer;
  walk: THREE.AnimationAction;
  idle: THREE.AnimationAction;
  cloud: Cloud;
  frozen: THREE.DataTexture[];
};

/** Облако с модели из генератора: цвет с её текстуры, кости — от манекена. */
function bodyCloud(body: THREE.Object3D, rigRoot: THREE.Object3D): Cloud {
  const source = skinSource(rigRoot);
  const painted = sampleTextured(body, COUNT, mulberry32(11));
  alignTo(painted.position, source.box);
  const skin = transferSkin(painted.position, source);
  return { count: COUNT, position: painted.position, color: painted.color, ...skin };
}

function buildRig(scene: THREE.Object3D, animations: THREE.AnimationClip[], body: THREE.Object3D | null): Rig {
  const root = cloneSkinned(scene);
  let found: THREE.Skeleton | undefined;
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) found ??= mesh.skeleton;
  });
  if (!found) throw new Error("В модели нет скелета");
  const skeleton = found;
  skeleton.computeBoneTexture();

  const cloud = body ? bodyCloud(body, root) : sampleSkinned(root, COUNT, mulberry32(11));

  const mixer = new THREE.AnimationMixer(root);
  const clip = (name: string) => animations.find((a) => a.name === name) ?? animations[0];
  const walk = mixer.clipAction(clip("walk"));
  const idle = mixer.clipAction(clip("idle"));
  walk.play();
  idle.play();
  walk.timeScale = 0; // фазу шага ставим сами, от пройденного пути

  // статуи: снимок скелета на середине шага у каждого проёма, ноги через раз
  const size = (skeleton.boneTexture as THREE.DataTexture).image.width;
  const frozen = STAGES.slice(0, -1).map((_, k) => {
    root.position.set(statueX(k), 0, 0);
    root.rotation.y = Math.PI / 2;
    walk.setEffectiveWeight(1);
    idle.setEffectiveWeight(0);
    walk.time = (0.12 + 0.5 * (k % 2)) * walk.getClip().duration;
    mixer.update(0);
    root.updateMatrixWorld(true);
    skeleton.update();
    const texture = new THREE.DataTexture(skeleton.boneMatrices!.slice(), size, size, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;
    return texture;
  });

  root.position.set(0, 0, 0);
  return { root, skeleton, mixer, walk, idle, cloud, frozen };
}

export function makeParticles(cloud: Cloud, every: number, bones: THREE.Texture, frozen: THREE.Texture, fixedLook: number) {
  const count = Math.floor(cloud.count / every);
  const pick = (src: Float32Array, size: number) => {
    const out = new Float32Array(count * size);
    for (let i = 0; i < count; i++) out.set(src.subarray(i * every * size, i * every * size + size), i * size);
    return out;
  };
  const random = mulberry32(7);
  const rand = new Float32Array(count * 4);
  for (let i = 0; i < rand.length; i++) rand[i] = random();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pick(cloud.position, 3), 3));
  geometry.setAttribute("aSkinIndex", new THREE.BufferAttribute(pick(cloud.skinIndex, 4), 4));
  geometry.setAttribute("aSkinWeight", new THREE.BufferAttribute(pick(cloud.skinWeight, 4), 4));
  geometry.setAttribute("aRand", new THREE.BufferAttribute(rand, 4));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(cloud.color ? pick(cloud.color, 3) : new Float32Array(count * 3).fill(1), 3));

  const material = new THREE.ShaderMaterial({
    vertexShader: figureVertex,
    fragmentShader: figureFragment,
    uniforms: {
      uBones: { value: bones },
      uFrozen: { value: frozen },
      uLive: { value: fixedLook < 0 ? 1 : 0 },
      uOffset: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uOpacity: { value: fixedLook < 0 ? 1 : 0 },
      uScale: { value: 1 },
      uBaseSize: { value: 0.0085 },
      uMouse: { value: new THREE.Vector3(999, 999, 999) },
      uMouseActive: { value: 0 },
      uStep: { value: STEP },
      uGate: { value: 0.16 },
      uFixedLook: { value: fixedLook },
      uLook: { value: STAGES.map((s) => new THREE.Vector4(s.look.grid, s.look.rows, s.look.square, s.look.swirl)) },
      uLook2: { value: STAGES.map((s) => new THREE.Vector4(s.look.size, s.look.scan, s.look.accent, s.look.photo)) },
      uCol1: { value: STAGES.map((s) => new THREE.Color(s.look.colors[0])) },
      uCol2: { value: STAGES.map((s) => new THREE.Color(s.look.colors[1])) },
    },
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

function makeDots(positions: Float32Array, size: number, alpha: number, fade: number, wrap: number) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.ShaderMaterial({
    vertexShader: dotsVertex,
    fragmentShader: dotsFragment,
    uniforms: {
      uScale: { value: 1 },
      uSize: { value: size },
      uFocusX: { value: 0 },
      uFade: { value: fade },
      uWrap: { value: wrap },
      uColor: { value: new THREE.Color("#e9e6df") },
      uAlpha: { value: alpha },
    },
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

const { damp, smoothstep, clamp, lerp } = THREE.MathUtils;

export function Scene({ onStage, onReady }: { onStage: (index: number) => void; onReady: () => void }) {
  const { scene: model, animations } = useGLTF(MODEL);
  const bodyGltf = useGLTF(BODY ?? MODEL);
  const body = BODY ? bodyGltf.scene : null;
  const rig = useMemo(() => buildRig(model, animations, body), [model, animations, body]);

  const figure = useMemo(() => makeParticles(rig.cloud, 1, rig.skeleton.boneTexture!, rig.frozen[0], -1), [rig]);
  const statues = useMemo(
    () => rig.frozen.map((frozen, k) => makeParticles(rig.cloud, STATUE_EVERY, rig.skeleton.boneTexture!, frozen, k)),
    [rig],
  );

  const floor = useMemo(() => {
    const xs: number[] = [];
    for (let x = -7; x < 7; x += 0.1) for (let z = -1.5; z <= 1.5; z += 0.1) xs.push(x, 0, z);
    return makeDots(new Float32Array(xs), 0.0045, 0.22, 2.6, 7);
  }, []);

  // проёмы между эпохами — редкие вертикальные завесы из точек
  const gates = useMemo(() => {
    const random = mulberry32(3);
    const xs: number[] = [];
    for (let k = 0; k < LAST; k++) {
      for (let i = 0; i < 900; i++) xs.push(gateX(k) + (random() - 0.5) * 0.01, random() * 2.3, (random() - 0.5) * 1.3);
    }
    return makeDots(new Float32Array(xs), 0.004, 0.18, 0, 0);
  }, []);

  const sim = useRef({ x: 0, phase: 0, walk: 0, facing: Math.PI / 2, faceTo: Math.PI / 2, march: 0, wide: 0, active: -1 });
  const mouse = useRef({ plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), ray: new THREE.Raycaster(), hit: new THREE.Vector3() });
  const lookAt = useRef(new THREE.Vector3());

  useEffect(() => {
    onReady();
    return () => {
      [figure, ...statues, floor, gates].forEach((p) => {
        p.geometry.dispose();
        (p.material as THREE.Material).dispose();
      });
    };
  }, [figure, statues, floor, gates, onReady]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = sim.current;
    const p = walkState.progress;
    const scale = (state.size.height * state.viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV) / 2));
    const time = state.clock.elapsedTime;

    // прокрутка задаёт, куда идти; в самом конце все прошлые «я» оживают и идут строем
    s.wide = damp(s.wide, smoothstep(p, 0.94, 1), 3, dt);
    if (s.wide > 0.6) s.march += MARCH_SPEED * dt * smoothstep(s.wide, 0.6, 1);
    else s.march = damp(s.march, 0, 3, dt);
    const goal = clamp((p - 0.04) / 0.86, 0, 1) * PATH + s.march;

    const move = clamp(damp(s.x, goal, 4, dt) - s.x, -MAX_SPEED * dt, MAX_SPEED * dt);
    s.x += move;
    const speed = Math.abs(move) / dt;
    s.walk = damp(s.walk, smoothstep(speed, 0.04, 0.35), 8, dt);
    s.phase = (s.phase + Math.abs(move) / STRIDE) % 1;
    if (move > 0.0004) s.faceTo = Math.PI / 2;
    else if (move < -0.0004) s.faceTo = -Math.PI / 2;
    s.facing = damp(s.facing, s.faceTo, 7, dt);

    rig.root.position.x = s.x;
    rig.root.rotation.y = s.facing;
    rig.walk.time = s.phase * rig.walk.getClip().duration;
    rig.walk.setEffectiveWeight(s.walk);
    rig.idle.setEffectiveWeight(1 - s.walk);
    rig.mixer.update(dt);
    rig.root.updateMatrixWorld(true);
    rig.skeleton.update();

    const active = clamp(Math.floor(s.x / STEP + 0.5), 0, LAST);
    if (active !== s.active) {
      s.active = active;
      onStage(active);
    }
    walkState.stage = Math.min(s.x / STEP, LAST);

    // курсор → точка на плоскости, где идёт фигура
    const fu = (figure.material as THREE.ShaderMaterial).uniforms;
    const m = mouse.current;
    m.ray.setFromCamera(walkState.pointer, state.camera);
    if (m.ray.ray.intersectPlane(m.plane, m.hit)) (fu.uMouse.value as THREE.Vector3).copy(m.hit);
    fu.uMouseActive.value = damp(fu.uMouseActive.value, walkState.pointerActive * (1 - s.wide), 6, dt);
    fu.uTime.value = time;
    fu.uScale.value = scale;

    // статуи проявляются, когда фигура прошла проём; в конце оживают и идут в строю
    const live = smoothstep(s.wide, 0.55, 0.9);
    statues.forEach((statue, k) => {
      const u = (statue.material as THREE.ShaderMaterial).uniforms;
      u.uTime.value = time;
      u.uScale.value = scale;
      u.uLive.value = live;
      // живой скелет стоит там же, где фигура; статуя встаёт в строй на своё место позади
      (u.uOffset.value as THREE.Vector3).set(statueX(k) - PATH, 0, 0);
      const passed = smoothstep(s.x - s.march, gateX(k) + 0.1, gateX(k) + 0.6);
      u.uOpacity.value = passed * lerp(0.28, 0.85, s.wide);
      statue.visible = u.uOpacity.value > 0.001;
    });

    // камера: три четверти спереди, фигура в правой половине кадра; в конце — общий план строя
    const narrow = state.size.width < 720;
    const center = s.x + (statueX(0) - PATH) / 2;
    const camX = lerp(s.x + (narrow ? 1.6 : 2.3), center, s.wide) + walkState.pointer.x * 0.08;
    const camY = lerp(narrow ? 1.25 : 1.1, 1.55, s.wide) + walkState.pointer.y * 0.05;
    const camZ = lerp(narrow ? 4.4 : 3.6, narrow ? 15 : 10.5, s.wide);
    state.camera.position.set(camX, camY, camZ);
    lookAt.current.set(lerp(s.x + (narrow ? 0.15 : -0.35), center, s.wide), lerp(narrow ? 1.15 : 0.92, 0.95, s.wide), 0);
    state.camera.lookAt(lookAt.current);

    const floorU = (floor.material as THREE.ShaderMaterial).uniforms;
    floorU.uScale.value = scale;
    floorU.uFocusX.value = lerp(s.x, center, s.wide);
    floorU.uFade.value = lerp(2.6, 7, s.wide);

    const gateU = (gates.material as THREE.ShaderMaterial).uniforms;
    gateU.uScale.value = scale;
    gateU.uAlpha.value = 0.18 * (1 - s.wide);
  });

  return (
    <>
      <primitive object={floor} />
      <primitive object={gates} />
      {statues.map((statue, k) => (
        <primitive key={k} object={statue} />
      ))}
      <primitive object={figure} />
    </>
  );
}

useGLTF.preload(MODEL);
