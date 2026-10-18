import * as THREE from "three";

// Гардероб для фигуры из скана. Футболка перекрашивается по частицам: светлые полосы и тёмные
// получают свои цвета, рисунок остаётся. Штаны перекрашиваются по текстуре: всё тёмное и серое на ней —
// ткань штанов. Чужую одежду поверх скана не надеваем: куртка из генератора в позе Т на опущенных руках
// мнётся в плечах, проверено.

export type Top = { id: string; label: string; light?: string; dark?: string };
export type Bottom = { id: string; label: string; color?: string };

export const TOPS: Top[] = [
  { id: "original", label: "Как есть" },
  { id: "red", label: "Красная", light: "#f1ece2", dark: "#b8231b" },
  { id: "green", label: "Зелёная", light: "#e7ece1", dark: "#1e5a3a" },
  { id: "pink", label: "Розовая", light: "#ffd6e0", dark: "#e2467a" },
  { id: "black", label: "Чёрная", light: "#3a3a3a", dark: "#151515" },
];

export const BOTTOMS: Bottom[] = [
  { id: "black", label: "Чёрные" },
  { id: "denim", label: "Джинсы", color: "#41618f" },
  { id: "beige", label: "Бежевые", color: "#c4ad86" },
  { id: "khaki", label: "Хаки", color: "#6b6a3c" },
];

/** Исходные цвета частиц скана и маска футболки. */
export type ScanColors = { rgba: Uint8Array; shirt: Uint8Array; count: number };

/**
 * Футболка — всё ниже плеч: волос и кожи там уже нет, а белые полосы в тёплом свете комнаты желтоватые,
 * по цвету их не отличить. Между воротником и плечами лежат волосы и шея: там берём всё, кроме самой шеи
 * и заметно цветного — волосы насыщеннее желтоватых полос.
 */
export function readScanColors(forEach: (cb: (i: number, center: THREE.Vector3, opacity: number, color: THREE.Color) => void) => void, count: number): ScanColors {
  const rgba = new Uint8Array(count * 4);
  const shirt = new Uint8Array(count);
  forEach((i, center, opacity, color) => {
    rgba[i * 4] = Math.round(THREE.MathUtils.clamp(color.r, 0, 1) * 255);
    rgba[i * 4 + 1] = Math.round(THREE.MathUtils.clamp(color.g, 0, 1) * 255);
    rgba[i * 4 + 2] = Math.round(THREE.MathUtils.clamp(color.b, 0, 1) * 255);
    rgba[i * 4 + 3] = Math.round(THREE.MathUtils.clamp(opacity, 0, 1) * 255);
    const sat = Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
    const fromNeck = Math.hypot(center.x, center.z + 0.02);
    shirt[i] = center.y < -0.27 || (center.y < -0.13 && sat < 0.17 && fromNeck > 0.075) ? 1 : 0;
  });
  return { rgba, shirt, count };
}

/** Цвета частиц для расцветки: футболка перекрашена по яркости, остальное как в скане. */
export function recolorShirt(base: ScanColors, top: Top, out: Uint8Array) {
  out.set(base.rgba);
  if (!top.light || !top.dark) return out;
  const light = new THREE.Color(top.light);
  const dark = new THREE.Color(top.dark);
  const c = new THREE.Color();
  for (let i = 0; i < base.count; i++) {
    if (!base.shirt[i]) continue;
    const r = base.rgba[i * 4] / 255, g = base.rgba[i * 4 + 1] / 255, b = base.rgba[i * 4 + 2] / 255;
    // яркость частицы решает, полоса это или фон; 0,15–0,75 покрывает тени складок
    const t = THREE.MathUtils.smoothstep(0.3 * r + 0.59 * g + 0.11 * b, 0.15, 0.75);
    c.copy(dark).lerp(light, t);
    out[i * 4] = Math.round(c.r * 255);
    out[i * 4 + 1] = Math.round(c.g * 255);
    out[i * 4 + 2] = Math.round(c.b * 255);
  }
  return out;
}

/** Текстура штанов в новом цвете: тёмные почти бесцветные пиксели — ткань, светлое (кеды) не трогаем. */
export function trouserTexture(original: THREE.Texture, color: string): THREE.Texture {
  const image = original.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const target = new THREE.Color(color);
  const tr = target.r * 255, tg = target.g * 255, tb = target.b * 255;
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
    const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    if (lum > 0.24 || sat > 0.15) continue;
    // складки остаются: тёмное темнее, светлое светлее
    const k = 0.85 + lum * 2.2;
    px[i] = Math.min(255, tr * k);
    px[i + 1] = Math.min(255, tg * k);
    px[i + 2] = Math.min(255, tb * k);
  }
  ctx.putImageData(data, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = original.flipY;
  texture.colorSpace = original.colorSpace;
  texture.wrapS = original.wrapS;
  texture.wrapT = original.wrapT;
  return texture;
}
