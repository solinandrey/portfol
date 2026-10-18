"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { STAGES } from "@/lib/stages";
import { Scene } from "./Scene";
import { Hud } from "./Hud";
import { walkState } from "./state";
import styles from "./walk.module.css";

export function Walk() {
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    const lenis = new Lenis({ autoRaf: true, lerp: 0.09 });
    const update = () => {
      walkState.progress = lenis.limit > 0 ? lenis.scroll / lenis.limit : 0;
    };
    lenis.on("scroll", update);
    update();

    const onMove = (e: PointerEvent) => {
      walkState.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      walkState.pointerActive = e.pointerType === "mouse" ? 1 : 0;
    };
    const onLeave = () => {
      walkState.pointerActive = 0;
    };
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      lenis.destroy();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <>
      <div className={styles.canvas}>
        <Canvas
          flat
          dpr={[1, 2]}
          gl={{ antialias: false, powerPreference: "high-performance" }}
          camera={{ fov: 35, near: 0.1, far: 60, position: [1.35, 1.15, 3.4] }}
        >
          <color attach="background" args={["#0b0b0c"]} />
          <Suspense fallback={null}>
            <Scene onStage={setActive} onReady={onReady} />
          </Suspense>
        </Canvas>
      </div>
      <Hud active={active} ready={ready} />
      <div className={styles.track} style={{ height: `${STAGES.length * 120 + 140}vh` }} />
    </>
  );
}
