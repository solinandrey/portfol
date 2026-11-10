// Портрет из точек: сколько точек тянет устройство и какой файл для этого качать.
// Точек меньше там, где экран меньше: на телефоне предмет вдвое меньше, чем на мониторе,
// и 100 тысяч точек стоят так же плотно, как 200 тысяч на большом экране. Заодно это вдвое
// меньше качать и вдвое меньше считать. Файлы делает scripts/make-dots.mjs.

/** Условия не пересекаются и покрывают всё: по ним браузер начинает качать нужный файл ещё
 * до скриптов (ссылки preload в app/page.tsx), и по ним же сцена выбирает число точек. */
export const PORTRAITS = [
  // телефон: палец и короткая сторона экрана меньше 600
  { count: 100000, file: "/models/portrait-dots-100k.bin", media: "(pointer: coarse) and (max-device-width: 599px), (pointer: coarse) and (max-device-height: 599px)" },
  // планшет: палец и экран побольше
  { count: 140000, file: "/models/portrait-dots-140k.bin", media: "(pointer: coarse) and (min-device-width: 600px) and (min-device-height: 600px)" },
  // всё остальное: мышь или тачпад
  { count: 200000, file: "/models/portrait-dots.bin", media: "not all and (pointer: coarse)" },
] as const;

export type Portrait = { count: number; file: string; data: Promise<ArrayBuffer> };

/** Портрет качается один раз на страницу: повторный вызов отдаёт уже начатое. */
export function startPortrait(): Portrait {
  const page = window as unknown as { __portrait?: Portrait };
  if (page.__portrait) return page.__portrait;
  const { count, file } = PORTRAITS.find((p) => window.matchMedia(p.media).matches) ?? PORTRAITS[2];
  // тот же запрос, что в preload: браузер отдаёт уже скачанное, а не качает второй раз
  const data = fetch(file).then((response) => {
    if (!response.ok) throw new Error(`portrait ${response.status}`);
    return response.arrayBuffer();
  });
  return (page.__portrait = { count, file, data });
}
