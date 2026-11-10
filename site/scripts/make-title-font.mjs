// Шрифт для объёмных заголовков на барабане: узкий Archivo 800, как заголовки на сайте,
// переведённый в typeface JSON для TextGeometry. Берём только нужные знаки, файл выходит маленьким.
// Исходник: https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75,800 (ссылка на .ttf внутри)
// Запуск: node scripts/make-title-font.mjs archivo-condensed-800.ttf public/fonts/archivo-title.json
import fs from "node:fs";
import opentype from "opentype.js";

const [src, dst] = process.argv.slice(2);
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 '’.,-&!?@";

const buf = fs.readFileSync(src);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
const scale = 100000 / ((font.unitsPerEm || 2048) * 72);
const round = Math.round;

const glyphs = {};
for (const char of CHARS) {
  const glyph = font.charToGlyph(char);
  const token = { ha: round(glyph.advanceWidth * scale), x_min: round((glyph.xMin ?? 0) * scale), x_max: round((glyph.xMax ?? 0) * scale), o: "" };
  for (const c of glyph.path.commands) {
    token.o += (c.type === "C" ? "b" : c.type.toLowerCase()) + " ";
    for (const [x, y] of [["x", "y"], ["x1", "y1"], ["x2", "y2"]]) if (c[x] !== undefined) token.o += `${round(c[x] * scale)} ${round(c[y] * scale)} `;
  }
  glyphs[char] = token;
}

const json = {
  glyphs,
  familyName: font.getEnglishName("fullName"),
  ascender: round(font.ascender * scale),
  descender: round(font.descender * scale),
  underlinePosition: font.tables.post.underlinePosition,
  underlineThickness: font.tables.post.underlineThickness,
  boundingBox: { xMin: font.tables.head.xMin, xMax: font.tables.head.xMax, yMin: font.tables.head.yMin, yMax: font.tables.head.yMax },
  resolution: 1000,
};
fs.mkdirSync(new URL(".", `file://${process.cwd()}/${dst}`), { recursive: true });
fs.writeFileSync(dst, JSON.stringify(json));
console.log(`${json.familyName}: ${Object.keys(glyphs).length} знаков, ${(fs.statSync(dst).size / 1024).toFixed(1)} КБ, A шириной ${glyphs.A.ha}`);
