"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { STAGES } from "@/lib/stages";
import { mulberry32 } from "@/lib/sampling";
import { alignTo, sampleTextured, skinSource, skinnedBody, transferSkin } from "@/lib/transfer";
import { makeParticles } from "@/components/walk/Scene";
import styles from "./lab.module.css";

// Стенд для одной модели: покрутить, приблизить лицо, сравнить модель с частицами.

const RIG = "/models/mannequin.glb";
const BODY = "/models/me-2018.glb";
const POINTS = 120000;

type View = "model" | "points";
type Pose = "idle" | "walk" | "tpose";
type Shot = "body" | "face";

function Figure({ view, pose }: { view: View; pose: Pose }) {
  const { scene: rigScene, animations } = useGLTF(RIG);
  const { scene: bodyScene } = useGLTF(BODY);

  const built = useMemo(() => {
    const root = cloneSkinned(rigScene);
    let found: THREE.Skeleton | undefined;
    root.traverse((obj) => {
      const mesh = obj as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) found ??= mesh.skeleton;
    });
    const skeleton = found!;
    skeleton.computeBoneTexture();

    const source = skinSource(root);
    const mesh = skinnedBody(bodyScene, source, skeleton);

    const painted = sampleTextured(bodyScene, POINTS, mulberry32(11));
    alignTo(painted.position, source.box);
    const cloud = { count: POINTS, position: painted.position, color: painted.color, ...transferSkin(painted.position, source) };
    const points = makeParticles(cloud, 1, skeleton.boneTexture!, skeleton.boneTexture!, STAGES.length - 1);
    const u = (points.material as THREE.ShaderMaterial).uniforms;
    u.uOpacity.value = 1;
    u.uLive.value = 1;
    u.uBaseSize.value = 0.0045;

    const mixer = new THREE.AnimationMixer(root);
    const action = (name: string) => mixer.clipAction(animations.find((a) => a.name === name) ?? animations[0]);
    return { root, skeleton, mesh, points, mixer, idle: action("idle"), walk: action("walk") };
  }, [rigScene, bodyScene, animations]);

  useEffect(() => {
    built.mixer.stopAllAction();
    if (pose === "tpose") built.skeleton.pose();
    else built[pose].reset().play();
  }, [pose, built]);

  useFrame((state, dt) => {
    if (pose !== "tpose") built.mixer.update(dt);
    built.root.updateMatrixWorld(true);
    built.skeleton.update();
    const u = (built.points.material as THREE.ShaderMaterial).uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uScale.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(35) / 2));
  });

  return view === "model" ? <primitive object={built.mesh} /> : <primitive object={built.points} />;
}

function Camera({ shot }: { shot: Shot }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (!controls) return;
    if (shot === "face") {
      controls.target.set(0, 1.62, 0);
      camera.position.set(0.18, 1.66, 0.85);
    } else {
      controls.target.set(0, 0.95, 0);
      camera.position.set(0.9, 1.25, 3.6);
    }
    controls.update();
  }, [shot, controls, camera]);
  return null;
}

export function ModelLab() {
  const [view, setView] = useState<View>("model");
  const [pose, setPose] = useState<Pose>("idle");
  const [shot, setShot] = useState<Shot>("body");
  const [dark, setDark] = useState(true);

  return (
    <div className={styles.lab} data-dark={dark || undefined}>
      <Canvas dpr={[1, 2]} camera={{ fov: 35, near: 0.05, far: 50, position: [0.9, 1.25, 3.6] }}>
        <color attach="background" args={[dark ? "#0b0b0c" : "#d9d6d0"]} />
        <hemisphereLight args={["#ffffff", "#3a3a3a", 1.4]} />
        <directionalLight position={[1.5, 2.5, 3]} intensity={2.2} />
        <directionalLight position={[-2, 2, -2]} intensity={1.2} />
        <Suspense fallback={null}>
          <Figure view={view} pose={pose} />
        </Suspense>
        <OrbitControls makeDefault enablePan={false} minDistance={0.35} maxDistance={7} target={[0, 0.95, 0]} />
        <Camera shot={shot} />
      </Canvas>

      <div className={styles.panel}>
        <div className={styles.title}>Модель 2018 · крути мышкой, колесо — ближе</div>
        <Group label="Вид" value={view} onChange={setView} options={[["model", "Модель"], ["points", "Частицы"]]} />
        <Group label="Поза" value={pose} onChange={setPose} options={[["idle", "Стоит"], ["walk", "Идёт"], ["tpose", "Поза Т"]]} />
        <Group label="Кадр" value={shot} onChange={setShot} options={[["body", "Весь рост"], ["face", "Лицо"]]} />
        <Group label="Фон" value={dark ? "dark" : "light"} onChange={(v) => setDark(v === "dark")} options={[["dark", "Тёмный"], ["light", "Светлый"]]} />
      </div>
    </div>
  );
}

function Group<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className={styles.group}>
      <span>{label}</span>
      {options.map(([key, text]) => (
        <button key={key} type="button" className={key === value ? styles.on : undefined} onClick={() => onChange(key)}>
          {text}
        </button>
      ))}
    </div>
  );
}
