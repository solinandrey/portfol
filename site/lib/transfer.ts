import * as THREE from "three";
import type { Cloud } from "./sampling";

// Модель из генератора приходит статуей в позе Т, без скелета.
// Ставим её в позу привязки манекена и раздаём каждой частице кости ближайших вершин манекена —
// дальше её двигает тот же скелет и та же ходьба, что и манекен.

/** Вершины скинованных мешей в позе привязки вместе с костями и весами. */
export type SkinSource = {
  position: Float32Array;
  skinIndex: Float32Array;
  skinWeight: Float32Array;
  box: THREE.Box3;
};

export function skinSource(root: THREE.Object3D): SkinSource {
  root.updateMatrixWorld(true);
  const pos: number[] = [];
  const idx: number[] = [];
  const wgt: number[] = [];
  const v = new THREE.Vector3();
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const g = mesh.geometry;
    const p = g.attributes.position;
    const si = g.attributes.skinIndex;
    const sw = g.attributes.skinWeight;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mesh.bindMatrix);
      pos.push(v.x, v.y, v.z);
      idx.push(si.getX(i), si.getY(i), si.getZ(i), si.getW(i));
      wgt.push(sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i));
    }
  });
  const position = new Float32Array(pos);
  const box = new THREE.Box3().setFromArray(position);
  return { position, skinIndex: new Float32Array(idx), skinWeight: new Float32Array(wgt), box };
}

/** Точки с цветом с поверхности обычных мешей (модель из генератора с текстурой). */
export function sampleTextured(root: THREE.Object3D, count: number, random: () => number) {
  root.updateMatrixWorld(true);
  type Part = { world: Float32Array; uv: THREE.BufferAttribute | undefined; index: ArrayLike<number> | null; triCount: number; pixels: ImageData | null; color: THREE.Color };
  const parts: Part[] = [];
  const v = new THREE.Vector3();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry as THREE.BufferGeometry;
    const p = g.attributes.position;
    const world = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
      world.set([v.x, v.y, v.z], i * 3);
    }
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    parts.push({
      world,
      uv: g.attributes.uv as THREE.BufferAttribute | undefined,
      index: g.index ? g.index.array : null,
      triCount: g.index ? g.index.count / 3 : p.count / 3,
      pixels: material.map ? readPixels(material.map) : null,
      color: material.color ?? new THREE.Color(1, 1, 1),
    });
  });

  const total = parts.reduce((sum, part) => sum + part.triCount, 0);
  const cdf = new Float64Array(total);
  const owner = new Uint16Array(total);
  const first: number[] = [];
  let area = 0;
  let t = 0;
  parts.forEach((part, pi) => {
    first.push(t);
    for (let tri = 0; tri < part.triCount; tri++, t++) {
      const [a, b, c] = triangle(part, tri);
      const w = part.world;
      const abx = w[b * 3] - w[a * 3], aby = w[b * 3 + 1] - w[a * 3 + 1], abz = w[b * 3 + 2] - w[a * 3 + 2];
      const acx = w[c * 3] - w[a * 3], acy = w[c * 3 + 1] - w[a * 3 + 1], acz = w[c * 3 + 2] - w[a * 3 + 2];
      const cx = aby * acz - abz * acy, cy = abz * acx - abx * acz, cz = abx * acy - aby * acx;
      area += 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
      cdf[t] = area;
      owner[t] = pi;
    }
  });

  const position = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = random() * area;
    let lo = 0, hi = total - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    const part = parts[owner[lo]];
    const [a, b, cc] = triangle(part, lo - first[owner[lo]]);
    let u = random(), w = random();
    if (u + w > 1) { u = 1 - u; w = 1 - w; }
    const s = 1 - u - w;
    for (let k = 0; k < 3; k++) {
      position[i * 3 + k] = part.world[a * 3 + k] * s + part.world[b * 3 + k] * u + part.world[cc * 3 + k] * w;
    }

    c.copy(part.color);
    if (part.pixels && part.uv) {
      const tu = part.uv.getX(a) * s + part.uv.getX(b) * u + part.uv.getX(cc) * w;
      const tv = part.uv.getY(a) * s + part.uv.getY(b) * u + part.uv.getY(cc) * w;
      const px = Math.min(part.pixels.width - 1, Math.max(0, Math.floor(fract(tu) * part.pixels.width)));
      const py = Math.min(part.pixels.height - 1, Math.max(0, Math.floor(fract(tv) * part.pixels.height)));
      const o = (py * part.pixels.width + px) * 4;
      c.setRGB(part.pixels.data[o] / 255, part.pixels.data[o + 1] / 255, part.pixels.data[o + 2] / 255, THREE.SRGBColorSpace);
    }
    color.set([c.r, c.g, c.b], i * 3);
  }
  return { position, color };
}

/**
 * Матрица, которая ставит модель в позу привязки манекена: та же высота, ступни на полу, центр по оси.
 * Генераторы отдают модель лицом к +z, манекен в позе привязки тоже смотрит в +z.
 */
export function alignMatrix(box: THREE.Box3, target: THREE.Box3) {
  const scale = (target.max.y - target.min.y) / (box.max.y - box.min.y);
  const from = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
  const to = new THREE.Vector3((target.min.x + target.max.x) / 2, target.min.y, (target.min.z + target.max.z) / 2);
  return new THREE.Matrix4()
    .makeTranslation(to.x, to.y, to.z)
    .multiply(new THREE.Matrix4().makeScale(scale, scale, scale))
    .multiply(new THREE.Matrix4().makeTranslation(-from.x, -from.y, -from.z));
}

export function alignTo(points: Float32Array, target: THREE.Box3) {
  const m = alignMatrix(new THREE.Box3().setFromArray(points), target);
  const v = new THREE.Vector3();
  for (let i = 0; i < points.length; i += 3) {
    v.fromArray(points, i).applyMatrix4(m).toArray(points, i);
  }
}

/**
 * Настоящая модель с текстурой на скелете манекена: те же кости и та же ходьба,
 * что у частиц, но видно лицо. Веса костей переносятся на каждую вершину.
 */
/** Какие треугольники модели оставить: проверка по трём вершинам в позе привязки. */
export type TriangleFilter = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => boolean;

export function skinnedBody(body: THREE.Object3D, source: SkinSource, skeleton: THREE.Skeleton, keep?: TriangleFilter) {
  body.updateMatrixWorld(true);
  let mesh: THREE.Mesh | undefined;
  body.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) mesh ??= obj as THREE.Mesh;
  });
  if (!mesh) throw new Error("В модели нет меша");

  const geometry = (mesh.geometry as THREE.BufferGeometry).clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  geometry.computeBoundingBox();
  geometry.applyMatrix4(alignMatrix(geometry.boundingBox!, source.box));

  const skin = transferSkin(geometry.attributes.position.array as Float32Array, source);
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(Uint16Array.from(skin.skinIndex), 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skin.skinWeight, 4));

  // можно взять только часть модели, например штаны или куртку
  if (keep && geometry.index) {
    const pos = geometry.attributes.position;
    const src = geometry.index.array;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const kept: number[] = [];
    for (let i = 0; i < src.length; i += 3) {
      if (keep(a.fromBufferAttribute(pos, src[i]), b.fromBufferAttribute(pos, src[i + 1]), c.fromBufferAttribute(pos, src[i + 2]))) kept.push(src[i], src[i + 1], src[i + 2]);
    }
    geometry.setIndex(kept);
  }

  const original = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
  // карта шероховатости у генератора делает ткань пластиковой, поэтому матовая одежда задаётся числом
  const material = original.clone();
  material.metalness = 0;
  material.metalnessMap = null;
  material.roughnessMap = null;
  material.roughness = 0.9;

  const skinned = new THREE.SkinnedMesh(geometry, material);
  skinned.bind(skeleton, new THREE.Matrix4());
  skinned.frustumCulled = false;
  return skinned;
}

/**
 * Кости для каждой точки: K ближайших вершин манекена, веса смешиваются обратно квадрату расстояния,
 * остаются четыре самые весомые кости. На сгибах так получается мягче, чем брать одну вершину.
 */
export function transferSkin(points: Float32Array, source: SkinSource, k = 4): Pick<Cloud, "skinIndex" | "skinWeight"> {
  // сетка с числовыми ключами: на сотнях тысяч частиц строки и сортировки слишком медленные
  const cell = 0.03;
  const key = (gx: number, gy: number, gz: number) => gx + 512 + (gy + 512) * 1024 + (gz + 512) * 1048576;
  const grid = new Map<number, number[]>();
  const n = source.position.length / 3;
  for (let i = 0; i < n; i++) {
    const kk = key(Math.floor(source.position[i * 3] / cell), Math.floor(source.position[i * 3 + 1] / cell), Math.floor(source.position[i * 3 + 2] / cell));
    const list = grid.get(kk);
    if (list) list.push(i);
    else grid.set(kk, [i]);
  }

  const count = points.length / 3;
  const skinIndex = new Float32Array(count * 4);
  const skinWeight = new Float32Array(count * 4);
  const bestI = new Int32Array(k);
  const bestD = new Float64Array(k);
  const boneW = new Float64Array(256);
  const touched: number[] = [];

  for (let p = 0; p < count; p++) {
    const x = points[p * 3], y = points[p * 3 + 1], z = points[p * 3 + 2];
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell), gz = Math.floor(z / cell);
    let found = 0;
    for (let ring = 1; ring <= 12 && found < k; ring++) {
      found = 0;
      bestD.fill(Infinity);
      for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) for (let dz = -ring; dz <= ring; dz++) {
        const list = grid.get(key(gx + dx, gy + dy, gz + dz));
        if (!list) continue;
        for (const i of list) {
          const ex = source.position[i * 3] - x, ey = source.position[i * 3 + 1] - y, ez = source.position[i * 3 + 2] - z;
          const d = ex * ex + ey * ey + ez * ez;
          found++;
          if (d >= bestD[k - 1]) continue;
          let j = k - 1;
          while (j > 0 && bestD[j - 1] > d) {
            bestD[j] = bestD[j - 1];
            bestI[j] = bestI[j - 1];
            j--;
          }
          bestD[j] = d;
          bestI[j] = i;
        }
      }
    }

    for (let m = 0; m < Math.min(k, found); m++) {
      const i = bestI[m];
      const w = 1 / (bestD[m] + 1e-6);
      for (let j = 0; j < 4; j++) {
        const bw = source.skinWeight[i * 4 + j] * w;
        if (bw <= 0) continue;
        const bone = source.skinIndex[i * 4 + j];
        if (boneW[bone] === 0) touched.push(bone);
        boneW[bone] += bw;
      }
    }
    touched.sort((a, b) => boneW[b] - boneW[a]);
    let sum = 0;
    for (let j = 0; j < Math.min(4, touched.length); j++) sum += boneW[touched[j]];
    for (let j = 0; j < Math.min(4, touched.length); j++) {
      skinIndex[p * 4 + j] = touched[j];
      skinWeight[p * 4 + j] = boneW[touched[j]] / (sum || 1);
    }
    for (const bone of touched) boneW[bone] = 0;
    touched.length = 0;
  }
  return { skinIndex, skinWeight };
}

/** Вершины манекена в текущей позе скелета, в мировых координатах, вместе с костями. */
export function posedSource(root: THREE.Object3D): SkinSource {
  root.updateMatrixWorld(true);
  const pos: number[] = [];
  const idx: number[] = [];
  const wgt: number[] = [];
  const v = new THREE.Vector3();
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    mesh.skeleton.update();
    const g = mesh.geometry;
    const si = g.attributes.skinIndex;
    const sw = g.attributes.skinWeight;
    for (let i = 0; i < g.attributes.position.count; i++) {
      mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
      pos.push(v.x, v.y, v.z);
      idx.push(si.getX(i), si.getY(i), si.getZ(i), si.getW(i));
      wgt.push(sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i));
    }
  });
  const position = new Float32Array(pos);
  return { position, skinIndex: new Float32Array(idx), skinWeight: new Float32Array(wgt), box: new THREE.Box3().setFromArray(position) };
}

function triangle(part: { index: ArrayLike<number> | null }, tri: number): [number, number, number] {
  const i = tri * 3;
  return part.index ? [part.index[i], part.index[i + 1], part.index[i + 2]] : [i, i + 1, i + 2];
}

/** Убирает треугольники по цвету текстуры в их середине: например, края чужой одежды. */
export function dropTrianglesByTexture(mesh: THREE.Mesh, drop: (r: number, g: number, b: number, center: THREE.Vector3) => boolean) {
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const material = mesh.material as THREE.MeshStandardMaterial;
  const pixels = material.map ? readPixels(material.map) : null;
  const uv = geometry.attributes.uv;
  if (!pixels || !uv || !geometry.index) return;
  const src = geometry.index.array;
  const pos = geometry.attributes.position;
  const center = new THREE.Vector3();
  const corner = new THREE.Vector3();
  const kept: number[] = [];
  for (let i = 0; i < src.length; i += 3) {
    center.set(0, 0, 0);
    for (let k = 0; k < 3; k++) center.add(corner.fromBufferAttribute(pos, src[i + k]));
    center.divideScalar(3);
    const u = (uv.getX(src[i]) + uv.getX(src[i + 1]) + uv.getX(src[i + 2])) / 3;
    const v = (uv.getY(src[i]) + uv.getY(src[i + 1]) + uv.getY(src[i + 2])) / 3;
    const px = Math.min(pixels.width - 1, Math.floor(fract(u) * pixels.width));
    const py = Math.min(pixels.height - 1, Math.floor(fract(v) * pixels.height));
    const o = (py * pixels.width + px) * 4;
    if (!drop(pixels.data[o] / 255, pixels.data[o + 1] / 255, pixels.data[o + 2] / 255, center)) kept.push(src[i], src[i + 1], src[i + 2]);
  }
  geometry.setIndex(kept);
}

function fract(x: number) {
  return x - Math.floor(x);
}

function readPixels(texture: THREE.Texture): ImageData | null {
  const image = texture.image as CanvasImageSource & { width: number; height: number };
  if (!image || !image.width) return null;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, image.width, image.height);
}
