"use client";

import { memo, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Chips } from "./Chips";
import { Cloud, type Shared } from "./Cloud";
import { Drum } from "./Drum";
import { Backdrop } from "./Backdrop";
import { createStage } from "./paper";

// Всё, что в холсте: решётка точек фоном, предмет из точек в центре, барабан с заголовками под ним, чипы стека вокруг.

type Props = { shared: RefObject<Shared>; onStation: (i: number) => void; onReady: () => void };

// не перерисовывается вместе с интерфейсом: смена главы в подписях не трогает 3D
export const Scene = memo(function Scene({ shared, onStation, onReady }: Props) {
  const stage = useMemo(createStage, []);
  // когда все части собраны, шейдеры компилируются в фоне ещё во время входа:
  // иначе первая глава ждёт компиляции, и переход дёргается
  const warmed = useRef(false);
  useFrame(({ gl, scene, camera }) => {
    if (warmed.current || stage.parts < 3) return;
    warmed.current = true;
    gl.compileAsync(scene, camera);
  });
  // Страховка по скорости. Если после входа кадры три секунды подряд идут медленнее 50 в секунду,
  // сцена дешевеет на ступень: сначала меньше пикселей в холсте, потом и точек. Обратно не
  // поднимается, чтобы качество не прыгало туда-сюда
  const quality = useRef({ levels: null as [number, number][] | null, level: 0, time: 0, frames: 0, slow: 0, settle: 0, before: 0, trial: false, done: false });
  useFrame((state, dt) => {
    const q = quality.current;
    if (!q.levels) {
      // ступени: плотность пикселей и доля точек, от того, с чего устройство начало
      const top = state.viewport.dpr;
      const all: [number, number][] = [[top, 1], [Math.max(1, top * 0.75), 1], [Math.max(1, top * 0.6), 0.75], [1, 0.55]];
      q.levels = all.filter(([dpr, keep], i) => i === 0 || dpr !== all[i - 1][0] || keep !== all[i - 1][1]);
    }
    // вход и свёрнутая вкладка не в счёт, одиночный рывок тоже
    if (q.done || stage.intro < 1 || document.hidden || dt > 0.1) return;
    if (q.settle > 0) return void q.settle--;
    q.time += dt;
    if (++q.frames < 90) return;
    const average = q.time / q.frames;
    q.time = 0;
    q.frames = 0;
    const set = (level: number) => {
      q.level = level;
      state.setDpr(q.levels![level][0]);
      stage.keep = q.levels![level][1];
      q.settle = 20;
    };
    if (q.trial) {
      q.trial = false;
      // не помогло: кадры упираются не в нагрузку, а в потолок частоты (режим энергосбережения
      // держит 30 кадров). Возвращаем как было и больше не трогаем
      if (average > q.before * 0.92) {
        set(q.level - 1);
        q.done = true;
        return;
      }
    }
    if (average <= 1 / 50) return void (q.slow = 0);
    if (++q.slow < 2 || q.level >= q.levels.length - 1) return;
    q.slow = 0;
    q.before = average;
    q.trial = true;
    set(q.level + 1);
  });
  return (
    <>
      <Backdrop shared={shared} stage={stage} />
      <Cloud shared={shared} stage={stage} onStation={onStation} onReady={onReady} />
      <Drum shared={shared} stage={stage} />
      <Chips shared={shared} stage={stage} />
    </>
  );
});
