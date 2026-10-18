import * as THREE from "three";

/** Детерминированный генератор, чтобы облако не менялось от перезагрузки к перезагрузке. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Облако частиц на поверхности скинованной модели: позиция в позе привязки и кости, которые её двигают. */
export type Cloud = {
  count: number;
  position: Float32Array;
  skinIndex: Float32Array;
  skinWeight: Float32Array;
  /** цвет с текстуры модели; у манекена его нет */
  color?: Float32Array;
};

type Source = {
  position: Float32Array;
  skinIndex: THREE.BufferAttribute;
  skinWeight: THREE.BufferAttribute;
  index: ArrayLike<number> | null;
  triCount: number;
};

/**
 * Равномерные по площади точки на всех SkinnedMesh объекта.
 * Позиции сразу умножены на bindMatrix: в шейдере остаётся сложить матрицы костей с весами.
 * Каждая точка берёт кости ближайшей вершины своего треугольника — для частиц этого хватает.
 */
export function sampleSkinned(root: THREE.Object3D, count: number, random: () => number): Cloud {
  root.updateMatrixWorld(true);
  const sources: Source[] = [];
  const v = new THREE.Vector3();

  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const geometry = mesh.geometry;
    const attr = geometry.attributes.position;
    const position = new Float32Array(attr.count * 3);
    for (let i = 0; i < attr.count; i++) {
      v.fromBufferAttribute(attr, i).applyMatrix4(mesh.bindMatrix);
      position[i * 3] = v.x;
      position[i * 3 + 1] = v.y;
      position[i * 3 + 2] = v.z;
    }
    sources.push({
      position,
      skinIndex: geometry.attributes.skinIndex as THREE.BufferAttribute,
      skinWeight: geometry.attributes.skinWeight as THREE.BufferAttribute,
      index: geometry.index ? geometry.index.array : null,
      triCount: geometry.index ? geometry.index.count / 3 : attr.count / 3,
    });
  });

  // накопленная площадь по всем треугольникам всех мешей
  const total = sources.reduce((sum, s) => sum + s.triCount, 0);
  const cdf = new Float64Array(total);
  const owner = new Uint16Array(total);
  let area = 0;
  let t = 0;
  sources.forEach((s, si) => {
    for (let tri = 0; tri < s.triCount; tri++, t++) {
      const [a, b, c] = corners(s, tri);
      const abx = s.position[b] - s.position[a], aby = s.position[b + 1] - s.position[a + 1], abz = s.position[b + 2] - s.position[a + 2];
      const acx = s.position[c] - s.position[a], acy = s.position[c + 1] - s.position[a + 1], acz = s.position[c + 2] - s.position[a + 2];
      const cx = aby * acz - abz * acy, cy = abz * acx - abx * acz, cz = abx * acy - aby * acx;
      area += 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
      cdf[t] = area;
      owner[t] = si;
    }
  });
  const firstTri = sources.map((_, si) => sources.slice(0, si).reduce((sum, s) => sum + s.triCount, 0));

  const cloud: Cloud = {
    count,
    position: new Float32Array(count * 3),
    skinIndex: new Float32Array(count * 4),
    skinWeight: new Float32Array(count * 4),
  };

  for (let i = 0; i < count; i++) {
    const r = random() * area;
    let lo = 0, hi = total - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    const s = sources[owner[lo]];
    const [a, b, c] = corners(s, lo - firstTri[owner[lo]]);

    let u = random(), w = random();
    if (u + w > 1) { u = 1 - u; w = 1 - w; }
    for (let k = 0; k < 3; k++) {
      cloud.position[i * 3 + k] = s.position[a + k] + u * (s.position[b + k] - s.position[a + k]) + w * (s.position[c + k] - s.position[a + k]);
    }

    const weights = [1 - u - w, u, w];
    const nearest = [a, b, c][weights.indexOf(Math.max(...weights))] / 3;
    cloud.skinIndex[i * 4] = s.skinIndex.getX(nearest);
    cloud.skinIndex[i * 4 + 1] = s.skinIndex.getY(nearest);
    cloud.skinIndex[i * 4 + 2] = s.skinIndex.getZ(nearest);
    cloud.skinIndex[i * 4 + 3] = s.skinIndex.getW(nearest);
    cloud.skinWeight[i * 4] = s.skinWeight.getX(nearest);
    cloud.skinWeight[i * 4 + 1] = s.skinWeight.getY(nearest);
    cloud.skinWeight[i * 4 + 2] = s.skinWeight.getZ(nearest);
    cloud.skinWeight[i * 4 + 3] = s.skinWeight.getW(nearest);
  }
  return cloud;
}

/** Смещения трёх вершин треугольника в массиве позиций. */
function corners(s: Source, tri: number): [number, number, number] {
  const i = tri * 3;
  return s.index
    ? [s.index[i] * 3, s.index[i + 1] * 3, s.index[i + 2] * 3]
    : [i * 3, (i + 1) * 3, (i + 2) * 3];
}
