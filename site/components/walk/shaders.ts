import { STAGES } from "@/lib/stages";

// Шейдеры фигуры из частиц.
// Частицы скинуются на видеокарте: позиция в позе привязки, четыре кости и веса,
// матрицы костей приходят текстурой скелета (как у обычного SkinnedMesh в three.js).
// Вид частиц зависит от того, в какой эпохе по оси x они сейчас стоят:
// фигура проходит через проём, и новая эпоха прокатывается по телу от груди к спине.

const flow = /* glsl */ `
  vec3 flow(vec3 p, float t) {
    return vec3(
      sin(p.y * 3.1 + t * 0.9) + sin(p.z * 2.3 - t * 0.7),
      sin(p.z * 2.7 + t * 0.8) + sin(p.x * 3.3 + t * 0.6),
      sin(p.x * 2.9 - t * 1.1) + sin(p.y * 2.1 + t * 0.5)
    ) * 0.5;
  }
`;

export const figureVertex = /* glsl */ `
  #define STAGE_COUNT ${STAGES.length}

  uniform highp sampler2D uBones;   // живой скелет
  uniform highp sampler2D uFrozen;  // снимок скелета для статуи
  uniform float uLive;              // 0 — статуя, 1 — идёт вместе со всеми
  uniform vec3 uOffset;             // место в строю, когда статуя оживает
  uniform float uTime;
  uniform float uOpacity;
  uniform float uScale;
  uniform float uBaseSize;
  uniform vec3 uMouse;
  uniform float uMouseActive;
  uniform float uStep;
  uniform float uGate;
  uniform float uFixedLook;         // -1 — вид по эпохе под ногами, иначе номер эпохи
  uniform vec4 uLook[STAGE_COUNT];  // grid, rows, square, swirl
  uniform vec4 uLook2[STAGE_COUNT]; // size, scan, accent, photo
  uniform vec3 uCol1[STAGE_COUNT];
  uniform vec3 uCol2[STAGE_COUNT];

  attribute vec4 aSkinIndex;
  attribute vec4 aSkinWeight;
  attribute vec4 aRand;
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vSquare;
  varying float vAlpha;

  ${flow}

  mat4 boneAt(highp sampler2D tex, float i) {
    int size = textureSize(tex, 0).x;
    int j = int(i) * 4;
    int x = j % size;
    int y = j / size;
    return mat4(
      texelFetch(tex, ivec2(x, y), 0),
      texelFetch(tex, ivec2(x + 1, y), 0),
      texelFetch(tex, ivec2(x + 2, y), 0),
      texelFetch(tex, ivec2(x + 3, y), 0)
    );
  }

  vec3 skin(highp sampler2D tex, vec3 p) {
    vec4 v = vec4(p, 1.0);
    vec4 r = boneAt(tex, aSkinIndex.x) * v * aSkinWeight.x
           + boneAt(tex, aSkinIndex.y) * v * aSkinWeight.y
           + boneAt(tex, aSkinIndex.z) * v * aSkinWeight.z
           + boneAt(tex, aSkinIndex.w) * v * aSkinWeight.w;
    return r.xyz;
  }

  vec3 applyLook(vec3 p, vec4 look) {
    if (look.x > 0.0) p = floor(p / look.x + 0.5) * look.x;
    if (look.y > 0.0) p.y = floor(p.y / look.y + 0.5) * look.y;
    p += flow(p * 2.2 + aRand.z * 6.0, uTime) * look.w * 0.03;
    return p;
  }

  void main() {
    vec3 p = skin(uBones, position) + uOffset;
    if (uLive < 0.999) p = mix(skin(uFrozen, position), p, uLive);

    int ka;
    int kb;
    float t = 0.0;
    float gateDist = 10.0;
    if (uFixedLook >= 0.0) {
      ka = int(uFixedLook);
      kb = ka;
    } else {
      float k = clamp(floor(p.x / uStep - 0.5), 0.0, float(STAGE_COUNT - 2));
      float gate = (k + 0.5) * uStep;
      float edge = gate + (aRand.x - 0.5) * uGate;
      t = smoothstep(edge - uGate * 0.5, edge + uGate * 0.5, p.x);
      ka = int(k);
      kb = ka + 1;
      gateDist = abs(p.x - gate);
    }
    vec4 la = uLook[ka];
    vec4 lb = uLook[kb];
    vec4 la2 = uLook2[ka];
    vec4 lb2 = uLook2[kb];
    p = mix(applyLook(p, la), applyLook(p, lb), t);

    // в проёме между эпохами частицы вспыхивают и разлетаются
    float burst = 1.0 - smoothstep(0.0, uGate * 1.6, gateDist);
    p += flow(p * 1.7 + aRand.w * 4.0, uTime * 1.2 + aRand.y * 6.2832) * burst * 0.07 * (0.3 + aRand.y);

    // еле заметное дыхание
    p += flow(p * 6.0, uTime * 1.4) * 0.0015;

    // курсор расталкивает частицы
    vec3 d = p - uMouse;
    float dist = length(d);
    float push = (1.0 - smoothstep(0.0, 0.32, dist)) * uMouseActive;
    p += (d / max(dist, 1e-4)) * push * 0.16;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float size = mix(la2.x, lb2.x, t) * uBaseSize * (0.55 + aRand.y * 0.9);
    gl_PointSize = size * uScale / -mv.z;

    vSquare = mix(la.z, lb.z, step(aRand.x, t));

    // палитра этапа, подмешанная к настоящему цвету модели;
    // чёрное на чёрном фоне пропадает, поэтому тёмные цвета чуть приподняты
    vec3 photo = aColor + (1.0 - aColor) * 0.07;
    vec3 ca = mix(mix(uCol1[ka], uCol2[ka], step(1.0 - la2.z, aRand.z)), photo, la2.w);
    vec3 cb = mix(mix(uCol1[kb], uCol2[kb], step(1.0 - lb2.z, aRand.z)), photo, lb2.w);
    vColor = mix(ca, cb, t);

    // полоса сканера: всё тускнеет, кроме бегущей по телу линии
    float scanA = la2.y * (1.0 - t);
    float scanB = lb2.y * t;
    float scan = scanA + scanB;
    vec3 scanColor = (uCol2[ka] * scanA + uCol2[kb] * scanB) / max(scan, 1e-4);
    float scanY = fract(uTime * 0.22) * 2.3 - 0.25;
    float band = 1.0 - smoothstep(0.0, 0.05, abs(p.y - scanY));
    vAlpha = mix(0.9, 0.38 + band * 0.62, scan) * uOpacity;
    vColor = mix(vColor, scanColor, band * scan);
    vColor = mix(vColor, vec3(1.0), burst * 0.4);
  }
`;

export const figureFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vSquare;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float round = 1.0 - smoothstep(0.38, 0.5, d);
    float shape = mix(round, 1.0, vSquare);
    if (shape < 0.02) discard;
    gl_FragColor = vec4(vColor, vAlpha * shape);
    #include <colorspace_fragment>
  }
`;

// Пол и проёмы — простые точки одного цвета. Пол заворачивается вокруг камеры,
// чтобы в конце строй мог идти сколько угодно.
export const dotsVertex = /* glsl */ `
  uniform float uScale;
  uniform float uSize;
  uniform float uFocusX;
  uniform float uFade;
  uniform float uWrap;
  varying float vFade;

  void main() {
    vec3 p = position;
    if (uWrap > 0.0) p.x = uFocusX + mod(p.x - uFocusX + uWrap, 2.0 * uWrap) - uWrap;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uScale / -mv.z;
    vFade = uFade > 0.0 ? 1.0 - smoothstep(0.6, uFade, abs(p.x - uFocusX)) : 1.0;
  }
`;

export const dotsFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vFade;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float shape = 1.0 - smoothstep(0.35, 0.5, d);
    if (shape < 0.02) discard;
    gl_FragColor = vec4(uColor, uAlpha * shape * vFade);
    #include <colorspace_fragment>
  }
`;
