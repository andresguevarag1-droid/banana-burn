// Motor de animación de técnica: cinemática directa (los datos de poses vienen del prototipo Banana Burn)
// con un render ilustrado: atleta mono con volumen, músculo objetivo que brilla en la fase concéntrica,
// equipo dibujado de lado en una proyección oblicua ligera y un solo bucle rAF para todas las figuras.

type Pt = [number, number];
type Pose = Record<string, number | Pt>;
type Kind = "ecc" | "con" | "hold" | "air";
type Phase = [string, number, string, Kind];
type Mode = "ankle" | "hip" | "hand" | "front";
type Joints = { ankle: Pt; knee: Pt; hip: Pt; sh: Pt; head: Pt; el: Pt; wr: Pt; toe: Pt };
export type Anim = {
  mode: Mode;
  props: string[];
  bar?: ((j: Joints) => Pt) | null;
  /** Segmentos o zonas que trabajan: thigh, shin, ua, fa, chest, abs, back, lowback, glute */
  hi: string[];
  /** 1 = mira a la derecha (de pie, boca abajo); -1 = boca arriba */
  face?: 1 | -1;
  /** Radio de los discos de la barra */
  plate?: number;
  /** La pierna lejana va media vuelta desfasada (zancada, escaladores) */
  alt?: boolean;
  /** La mano lejana se apoya en este punto (remo a una mano) */
  farHand?: Pt;
  A: Pose;
  B: Pose;
  C?: Pose;
  ph: Phase[];
};

const L = { shin: 38, thigh: 40, torso: 50, neck: 15, ua: 28, fa: 26, foot: 12 };
const FLOOR = 181.5;
/** Radios de las articulaciones: muslo más grueso que pantorrilla, brazo más grueso que antebrazo. */
const R = { hip: 10.2, knee: 6.4, ankle: 3.9, sh: 7.6, el: 5.1, wr: 3.7 };
/** Desplazamiento en pantalla de una unidad de profundidad (lado lejano del cuerpo). */
const D: Pt = [-2.6, -1.6];
const rad = (a: number) => (a * Math.PI) / 180;
const P = (p: Pt, len: number, a: number): Pt => [p[0] + len * Math.cos(rad(a)), p[1] + len * Math.sin(rad(a))];
const add = (a: Pt, b: Pt, k = 1): Pt => [a[0] + b[0] * k, a[1] + b[1] * k];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const len = (a: Pt) => Math.hypot(a[0], a[1]);
const unit = (a: Pt): Pt => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const perp = (a: Pt): Pt => [-a[1], a[0]];
const ang = (a: Pt) => (Math.atan2(a[1], a[0]) * 180) / Math.PI;
const num = (v: number | Pt | undefined, d = 0) => (typeof v === "number" ? v : d);
const pt = (v: number | Pt | undefined, d: Pt): Pt => (Array.isArray(v) ? v : d);

function solve(mode: Mode, q: Pose): Joints {
  const a = (k: string) => num(q[k]);
  let ankle: Pt, knee: Pt, hip: Pt, sh: Pt, el: Pt, wr: Pt;
  if (mode === "hip") {
    hip = pt(q.root, [100, 120]); sh = P(hip, L.torso, a("torso")); knee = P(hip, L.thigh, a("thigh")); ankle = P(knee, L.shin, a("shin"));
    el = P(sh, L.ua, a("ua")); wr = P(el, L.fa, a("fa"));
  } else if (mode === "hand") {
    wr = pt(q.root, [100, 0]); el = P(wr, L.fa, a("fa")); sh = P(el, L.ua, a("ua")); hip = P(sh, L.torso, a("torso"));
    knee = P(hip, L.thigh, a("thigh")); ankle = P(knee, L.shin, a("shin"));
  } else {
    ankle = pt(q.root, [100, 178]); knee = P(ankle, L.shin, a("shin")); hip = P(knee, L.thigh, a("thigh"));
    sh = P(hip, L.torso, a("torso")); el = P(sh, L.ua, a("ua")); wr = P(el, L.fa, a("fa"));
  }
  return { ankle, knee, hip, sh, el, wr, head: P(sh, L.neck, a("neck")), toe: P(ankle, L.foot, num(q.foot, 0)) };
}

const ANIM: Record<string, Anim> = {
  squat: { mode: "ankle", plate: 17, props: ["rack", "barbell"], bar: (j) => { const u = unit(sub(j.sh, j.hip)); return add(add(j.sh, perp(u), -7), u, -1.5); }, hi: ["thigh", "glute"],
    A: { shin: -90, thigh: -90, torso: -90, neck: -80, ua: 127, fa: -66 },
    B: { shin: -60, thigh: -189, torso: -50, neck: -55, ua: 167, fa: -26 },
    ph: [["B", 3, "Baja en 3 segundos", "ecc"], ["B", 0.8, "Pausa abajo", "hold"], ["A", 1, "Sube fuerte", "con"], ["A", 0.7, "Respira y aprieta", "hold"]] },
  frontsquat: { mode: "ankle", plate: 15, props: ["barbell"], bar: (j) => { const u = unit(sub(j.sh, j.hip)); return add(add(j.sh, perp(u), 7), u, 1); }, hi: ["thigh", "abs"],
    A: { shin: -90, thigh: -90, torso: -90, neck: -82, ua: -10, fa: 172 },
    B: { shin: -55, thigh: -185, torso: -62, neck: -60, ua: 18, fa: 200 },
    ph: [["B", 3, "Baja en 3 segundos", "ecc"], ["B", 0.7, "Pausa abajo", "hold"], ["A", 1, "Sube fuerte", "con"], ["A", 0.7, "Codos altos", "hold"]] },
  bench: { mode: "hip", face: -1, props: ["bench", "barbell"], bar: (j) => j.wr, hi: ["chest", "ua"],
    A: { root: [72, 120], torso: 0, thigh: 150, shin: 100, neck: -12, ua: -95, fa: -92, foot: 180 },
    B: { root: [72, 120], torso: 0, thigh: 150, shin: 100, neck: -12, ua: -208, fa: -80, foot: 180 },
    ph: [["B", 3, "Baja en 3 segundos", "ecc"], ["B", 0.6, "Toca pecho", "hold"], ["A", 1, "Empuja fuerte", "con"], ["A", 0.7, "Escápulas atrás", "hold"]] },
  incline: { mode: "hip", face: -1, props: ["incline", "dumbbell"], bar: (j) => j.wr, hi: ["chest", "ua"],
    A: { root: [72, 128], torso: -28, thigh: 160, shin: 96, neck: -35, ua: -100, fa: -96, foot: 180 },
    B: { root: [72, 128], torso: -28, thigh: 160, shin: 96, neck: -35, ua: -212, fa: -78, foot: 180 },
    ph: [["B", 3, "Baja en 3 segundos", "ecc"], ["B", 0.5, "Estira pecho", "hold"], ["A", 1, "Empuja fuerte", "con"], ["A", 0.7, "Aprieta", "hold"]] },
  ohp: { mode: "ankle", props: ["barbell"], bar: (j) => j.wr, hi: ["ua", "fa"],
    A: { shin: -90, thigh: -90, torso: -92, neck: -80, ua: 70, fa: -85 },
    B: { shin: -90, thigh: -90, torso: -88, neck: -95, ua: -85, fa: -88 },
    ph: [["B", 1, "Empuja arriba", "con"], ["B", 0.5, "Bloquea", "hold"], ["A", 3, "Baja en 3 segundos", "ecc"], ["A", 0.6, "Glúteo y abdomen duros", "hold"]] },
  dbpress: { mode: "ankle", props: ["dumbbell"], bar: (j) => j.wr, hi: ["ua", "fa"],
    A: { shin: -90, thigh: -90, torso: -92, neck: -80, ua: 60, fa: -88 },
    B: { shin: -90, thigh: -90, torso: -90, neck: -88, ua: -88, fa: -90 },
    ph: [["B", 1, "Empuja arriba", "con"], ["B", 0.4, "Arriba", "hold"], ["A", 3, "Baja en 3 segundos", "ecc"], ["A", 0.6, "Abajo", "hold"]] },
  deadlift: { mode: "ankle", props: ["barbell"], plate: 26, bar: (j) => j.wr, hi: ["glute", "thigh", "lowback"],
    A: { shin: -72, thigh: -160, torso: -32, neck: -22, ua: 95, fa: 95 },
    B: { shin: -90, thigh: -90, torso: -92, neck: -80, ua: 92, fa: 92 },
    ph: [["B", 1.2, "Empuja el suelo", "con"], ["B", 0.6, "Bloquea glúteos", "hold"], ["A", 2.2, "Baja controlado", "ecc"], ["A", 0.8, "Reset y aire", "hold"]] },
  rdl: { mode: "ankle", props: ["barbell"], plate: 22, bar: (j) => j.wr, hi: ["thigh", "glute"],
    A: { shin: -88, thigh: -95, torso: -92, neck: -80, ua: 92, fa: 92 },
    B: { shin: -82, thigh: -135, torso: -20, neck: -10, ua: 100, fa: 100 },
    ph: [["B", 3, "Cadera atrás en 3 s", "ecc"], ["B", 0.5, "Estira isquios", "hold"], ["A", 1, "Cadera adelante", "con"], ["A", 0.6, "Aprieta glúteo", "hold"]] },
  pullup: { mode: "hand", props: ["pullbar"], hi: ["back", "ua"],
    A: { root: [100, -10], fa: 90, ua: 90, torso: 92, thigh: 98, shin: 115, neck: -90, foot: 60 },
    B: { root: [100, -10], fa: 70, ua: 195, torso: 100, thigh: 105, shin: 125, neck: -80, foot: 60 },
    ph: [["B", 1.2, "Tira con la espalda", "con"], ["B", 0.5, "Barbilla arriba", "hold"], ["A", 3, "Baja en 3 segundos", "ecc"], ["A", 0.6, "Cuelga activo", "hold"]] },
  dips: { mode: "hand", props: ["dipbars"], hi: ["chest", "ua"],
    A: { root: [100, 78], fa: -90, ua: -90, torso: 95, thigh: 110, shin: 150, neck: -88, foot: 70 },
    B: { root: [100, 78], fa: -95, ua: 15, torso: 112, thigh: 125, shin: 165, neck: -70, foot: 80 },
    ph: [["B", 3, "Baja en 3 segundos", "ecc"], ["B", 0.5, "Estira", "hold"], ["A", 1, "Empuja fuerte", "con"], ["A", 0.6, "Bloquea", "hold"]] },
  row: { mode: "ankle", props: ["barbell"], bar: (j) => j.wr, hi: ["back", "ua"],
    A: { shin: -80, thigh: -130, torso: -22, neck: -10, ua: 100, fa: 92 },
    B: { shin: -80, thigh: -130, torso: -22, neck: -10, ua: 210, fa: 88 },
    ph: [["B", 1, "Codos atrás", "con"], ["B", 0.8, "Aprieta escápulas", "hold"], ["A", 2.5, "Baja lento", "ecc"], ["A", 0.5, "Estira", "hold"]] },
  dbrow: { mode: "ankle", props: ["dumbbell-one", "benchlow"], farHand: [146, 143], bar: (j) => j.wr, hi: ["back", "ua"],
    A: { shin: -84, thigh: -128, torso: -14, neck: -6, ua: 96, fa: 92 },
    B: { shin: -84, thigh: -128, torso: -14, neck: -6, ua: 208, fa: 86 },
    ph: [["B", 1, "Codo al bolsillo", "con"], ["B", 0.8, "Aprieta", "hold"], ["A", 2.5, "Baja lento", "ecc"], ["A", 0.5, "Estira", "hold"]] },
  curl: { mode: "ankle", props: ["barbell-sm"], bar: (j) => j.wr, hi: ["fa", "ua"],
    A: { shin: -90, thigh: -90, torso: -91, neck: -82, ua: 92, fa: 92 },
    B: { shin: -90, thigh: -90, torso: -91, neck: -82, ua: 98, fa: -55 },
    ph: [["B", 1, "Sube sin balanceo", "con"], ["B", 0.6, "Aprieta bíceps", "hold"], ["A", 3, "Baja en 3 segundos", "ecc"], ["A", 0.4, "Abajo", "hold"]] },
  facepull: { mode: "ankle", props: ["cable"], bar: (j) => j.wr, hi: ["ua", "back"],
    A: { shin: -92, thigh: -88, torso: -95, neck: -85, ua: -8, fa: -8 },
    B: { shin: -92, thigh: -88, torso: -95, neck: -85, ua: -175, fa: -30 },
    ph: [["B", 1, "Tira a la cara", "con"], ["B", 0.8, "Rota hacia atrás", "hold"], ["A", 2.5, "Vuelve lento", "ecc"], ["A", 0.4, "Estira", "hold"]] },
  pushup: { mode: "ankle", props: [], hi: ["chest", "ua"],
    A: { root: [40, 172], shin: -22, thigh: -22, torso: -22, neck: -18, ua: 90, fa: 90, foot: 42 },
    B: { root: [40, 172], shin: -6, thigh: -6, torso: -6, neck: -4, ua: 180, fa: 45, foot: 42 },
    ph: [["B", 3, "Baja en 3 segundos", "ecc"], ["B", 0.5, "Pecho cerca del piso", "hold"], ["A", 1, "Empuja fuerte", "con"], ["A", 0.5, "Cuerpo en tabla", "hold"]] },
  plank: { mode: "ankle", props: [], hi: ["abs", "glute"],
    A: { root: [40, 172], shin: -12, thigh: -12, torso: -12, neck: -8, ua: 90, fa: 0, foot: 42 },
    B: { root: [40, 172], shin: -12, thigh: -15, torso: -10, neck: -8, ua: 91, fa: 0, foot: 42 },
    ph: [["B", 2, "Respira sin soltar", "con"], ["A", 2, "Glúteo y abdomen duros", "ecc"]] },
  kneeraise: { mode: "hand", props: ["pullbar"], hi: ["abs", "thigh"],
    A: { root: [100, -10], fa: 90, ua: 90, torso: 92, thigh: 95, shin: 100, neck: -90, foot: 60 },
    B: { root: [100, -10], fa: 88, ua: 92, torso: 98, thigh: -5, shin: 85, neck: -90, foot: 20 },
    ph: [["B", 1, "Rodillas al pecho", "con"], ["B", 0.5, "Aprieta abdomen", "hold"], ["A", 2.5, "Baja lento", "ecc"], ["A", 0.5, "Sin balanceo", "hold"]] },
  carry: { mode: "ankle", props: ["dumbbell"], alt: true, bar: (j) => j.wr, hi: ["fa", "abs"],
    A: { shin: -90, thigh: -90, torso: -91, neck: -82, ua: 92, fa: 90 },
    B: { shin: -82, thigh: -98, torso: -92, neck: -82, ua: 93, fa: 91 },
    ph: [["B", 0.6, "Paso firme", "con"], ["A", 0.6, "Pecho alto, hombros abajo", "ecc"]] },
  lateral: { mode: "front", props: ["dumbbell"], hi: ["ua"],
    A: { a: 80 }, B: { a: -4 },
    ph: [["B", 1, "Sube con el codo", "con"], ["B", 0.6, "Pausa arriba", "hold"], ["A", 3, "Baja en 3 segundos", "ecc"], ["A", 0.4, "Abajo", "hold"]] },
};
// Escaladores: raíz en las manos para que queden fijas en el piso mientras las rodillas van al pecho.
const PLANK_HAND: Pose = { root: [158.7, 178.1], fa: -90, ua: -90, torso: 158, thigh: 158, shin: 158, neck: -18, foot: 42 };
// Variantes sin equipo (misma cinemática, sin barra ni discos)
Object.assign(ANIM, {
  squat_bw: { ...ANIM.squat, props: [], bar: null, A: { ...ANIM.squat.A, ua: -10, fa: -10 }, B: { ...ANIM.squat.B, ua: 20, fa: 10 } },
  jump_bw: { ...ANIM.squat, props: [], bar: null, hi: ["thigh", "glute"], A: { ...ANIM.squat.A, ua: 100, fa: 100 }, B: { ...ANIM.squat.B, ua: 150, fa: 120 },
    ph: [["B", 0.8, "Baja rápido", "ecc"], ["A", 0.32, "¡Salta!", "con"], ["A", 0.5, "¡Salta!", "air"], ["A", 0.6, "Aterriza suave", "hold"]] },
  rdl_bw: { ...ANIM.rdl, props: [], bar: null },
  curl_bw: { ...ANIM.curl, props: [], bar: null },
  burpee: { mode: "hand", props: [], hi: ["chest", "thigh"], A: PLANK_HAND,
    B: { ...PLANK_HAND, fa: -135, ua: 0, torso: 174, thigh: 174, shin: 174, neck: -4 },
    C: { ...PLANK_HAND, torso: 151, thigh: 10, shin: 143, neck: -35, foot: 0 },
    ph: [["B", 0.7, "Pecho al piso", "ecc"], ["A", 0.55, "Empuja", "con"], ["C", 0.45, "Pies a las manos", "con"], ["C", 0.3, "Pies a las manos", "hold"], ["A", 0.45, "Atrás a plancha", "ecc"]] },
  mountain: { mode: "hand", props: [], alt: true, hi: ["abs", "thigh"], A: PLANK_HAND, B: { ...PLANK_HAND, thigh: 38, shin: 170, foot: 20 },
    ph: [["B", 0.35, "Rodilla al pecho", "con"], ["A", 0.35, "Cambia rápido", "ecc"]] },
} satisfies Record<string, Anim>);

/* ---------- Tiempo y curvas ---------- */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// Concéntrica: un pelo de anticipación al arrancar y un asentamiento suave al bloquear.
const backInOut = (t: number) => {
  const c = 0.55 * 1.525;
  return t < 0.5 ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2 : (Math.pow(2 * t - 2, 2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2;
};
const EASE: Record<Kind, (t: number) => number> = {
  ecc: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  con: backInOut,
  hold: () => 1,
  air: () => 1,
};
const keyPose = (an: Anim, k: string): Pose => (k === "B" ? an.B : k === "C" && an.C ? an.C : an.A);
const total = (an: Anim) => an.ph.reduce((s, p) => s + p[1], 0);
type State = { q: Pose; label: string; k: Kind; i: number; phaseProg: number; lift: number };
function mix(A: Pose, B: Pose, e: number): Pose {
  const q: Pose = {};
  for (const key in A) {
    const a = A[key], b = B[key] ?? a;
    q[key] = Array.isArray(a) && Array.isArray(b) ? [lerp(a[0], b[0], e), lerp(a[1], b[1], e)] : lerp(num(a), num(b), e);
  }
  return q;
}
function poseAt(an: Anim, time: number): State {
  const T = total(an);
  let t = ((time % T) + T) % T, cur = an.ph[an.ph.length - 1][0];
  for (let i = 0; i < an.ph.length; i++) {
    const [to, d, label, k] = an.ph[i];
    if (t <= d || i === an.ph.length - 1) {
      const p = d ? Math.min(1, t / d) : 1;
      const lift = k === "air" ? Math.sin(Math.PI * p) : 0;
      return { q: mix(keyPose(an, cur), keyPose(an, to), EASE[k](p)), label, k, i, phaseProg: p, lift };
    }
    t -= d; cur = to;
  }
  return { q: an.A, label: "", k: "hold", i: 0, phaseProg: 0, lift: 0 };
}

/* ---------- Geometría ---------- */
const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
const xy = (p: Pt) => `${f1(p[0])} ${f1(p[1])}`;
/** Cápsula cónica: dos círculos unidos por sus tangentes exteriores. */
function capsule(p1: Pt, r1: number, p2: Pt, r2: number) {
  const v = sub(p2, p1); const d = Math.max(len(v), Math.abs(r1 - r2) + 0.01);
  const u = unit(v), n = perp(u);
  const s = (r1 - r2) / d, c = Math.sqrt(Math.max(0, 1 - s * s));
  const a: Pt = add([u[0] * s, u[1] * s], n, c), b: Pt = add([u[0] * s, u[1] * s], n, -c);
  const big2 = r2 > r1 ? 1 : 0, big1 = r1 > r2 ? 1 : 0;
  return `M${xy(add(p1, a, r1))}L${xy(add(p2, a, r2))}A${f1(r2)} ${f1(r2)} 0 ${big2} 0 ${xy(add(p2, b, r2))}L${xy(add(p1, b, r1))}A${f1(r1)} ${f1(r1)} 0 ${big1} 0 ${xy(add(p1, a, r1))}Z`;
}
/** Extremidad musculosa: como capsule pero con un vientre muscular (bíceps, cuádriceps, pantorrilla) que se ensancha en `peak`. */
function muscle(p1: Pt, r1: number, p2: Pt, r2: number, bulge: number, peak = 0.42, cap = 0) {
  const u = unit(sub(p2, p1)), n = perp(u);
  const ts = [0, 0.1, 0.24, peak, Math.min(0.9, peak + 0.22), 1];
  // vientre muscular + "cap" opcional junto a la articulación de arriba (deltoide en el brazo)
  const r = (t: number) => lerp(r1, r2, t) + bulge * Math.exp(-((t - peak) ** 2) / 0.04) + cap * Math.exp(-((t - 0.06) ** 2) / 0.012);
  const at2 = (t: number, side: number): Pt => add(add(p1, sub(p2, p1), t), n, side * r(t));
  const ps: Pt[] = [];
  for (const t of ts) ps.push(at2(t, 1));
  ps.push(add(p2, u, r2 * 0.95));
  for (const t of [...ts].reverse()) ps.push(at2(t, -1));
  ps.push(add(p1, u, -r1 * 0.95));
  return closed(ps);
}
/** Curva cerrada suave (Catmull-Rom) por los puntos. */
function closed(ps: Pt[]) {
  const n = ps.length; let d = `M${xy(ps[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = ps[(i - 1 + n) % n], p1 = ps[i], p2 = ps[(i + 1) % n], p3 = ps[(i + 2) % n];
    d += `C${xy([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${xy([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${xy(p2)}`;
  }
  return d + "Z";
}
// Perfil del torso de lado: [t a lo largo de cadera→hombro, grosor]. Frente = pecho/abdomen, espalda = dorsales/glúteo.
const FRONT: Pt[] = [[-0.1, 6], [0.06, 7.4], [0.3, 6.8], [0.5, 7.6], [0.68, 11.6], [0.84, 12.4], [0.97, 9.6], [1.07, 4.4]];
const BACK: Pt[] = [[1.08, 6.6], [0.98, 11], [0.82, 12], [0.62, 9.6], [0.42, 7.6], [0.22, 8.8], [0.04, 11], [-0.12, 8]];
function prof(tbl: Pt[], t: number) {
  const s = [...tbl].sort((a, b) => a[0] - b[0]);
  if (t <= s[0][0]) return s[0][1];
  for (let i = 1; i < s.length; i++) if (t <= s[i][0]) return lerp(s[i - 1][1], s[i][1], (t - s[i - 1][0]) / (s[i][0] - s[i - 1][0]));
  return s[s.length - 1][1];
}
type Frame = { H: Pt; u: Pt; f: Pt; l: number };
const frame = (hip: Pt, sh: Pt, face: number): Frame => { const v = sub(sh, hip); const u = unit(v); const n = perp(u); return { H: hip, u, f: [n[0] * face, n[1] * face], l: len(v) }; };
const at = (F: Frame, t: number, side: number) => add(add(F.H, F.u, t * F.l), F.f, side);
function torsoPath(F: Frame) {
  const ps: Pt[] = [];
  for (const [t, o] of FRONT) ps.push(at(F, t, o));
  ps.push(at(F, 1.13, 0));
  for (const [t, o] of BACK) ps.push(at(F, t, -o));
  ps.push(at(F, -0.2, 0));
  return closed(ps);
}
const ZONES: Record<string, [number, number, number]> = { chest: [0.56, 0.97, 1], abs: [0.06, 0.56, 1], back: [0.42, 0.98, -1], lowback: [0.12, 0.5, -1], glute: [-0.12, 0.24, -1] };
function zonePath(F: Frame, z: [number, number, number]) {
  const [t0, t1, side] = z, ps: Pt[] = [], N = 6;
  const tbl = side > 0 ? FRONT : BACK;
  for (let i = 0; i <= N; i++) { const t = lerp(t0, t1, i / N); ps.push(at(F, t, side * (prof(tbl, t) - 0.35))); }
  for (let i = N; i >= 0; i--) { const t = lerp(t0, t1, i / N); ps.push(at(F, t, side * Math.min(2.2, prof(tbl, t) * 0.35))); }
  return closed(ps);
}
function hexPath(c: Pt, r: number) {
  let d = "";
  for (let i = 0; i < 6; i++) { const p = P(c, r, 60 * i + 30); d += (i ? "L" : "M") + xy(p); }
  return d + "Z";
}
function ik(s: Pt, t: Pt, a: number, b: number, back: Pt): Pt {
  const v = sub(t, s); const d = Math.min(len(v), a + b - 0.01);
  const base = ang(v), al = (Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)))) * 180) / Math.PI;
  const e1 = P(s, a, base + al), e2 = P(s, a, base - al);
  const dot = (p: Pt) => (p[0] - s[0]) * back[0] + (p[1] - s[1]) * back[1];
  return dot(e1) > dot(e2) ? e1 : e2;
}

/* ---------- DOM ---------- */
const NS = "http://www.w3.org/2000/svg";
type Attrs = Record<string, string | number>;
function mk<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  parent?.appendChild(e);
  return e;
}
const setD = (e: SVGPathElement, d: string) => e.setAttribute("d", d);
let uid = 0;

const C = {
  ink: "var(--figure)", ember: "var(--ember)", banana: "var(--banana)", face: "var(--mo-face)",
  steel: "var(--mo-steel)", pad: "var(--mo-pad)", paper: "var(--mo-paper)",
};

type Limb = { seg: SVGPathElement; hot: boolean };
type Rig = {
  g: SVGGElement;
  torso: SVGPathElement; zones: [SVGPathElement, [number, number, number]][]; neck: SVGPathElement; head: SVGCircleElement;
  ear: SVGCircleElement; earIn: SVGCircleElement; facePatch: SVGPathElement; muzzle: SVGPathElement; eye: SVGCircleElement; band: SVGPathElement; tail: SVGPathElement; waist: SVGPathElement;
  thigh: Limb; shin: Limb; shoe: SVGPathElement; sole: SVGPathElement; stripe: SVGPathElement;
  ua: Limb; fa: Limb; hand: SVGCircleElement; cuff: SVGPathElement;
  far: { g: SVGGElement; thigh: Limb; shin: Limb; shoe: SVGPathElement; ua: Limb; fa: Limb; hand: SVGCircleElement; cuff: SVGPathElement };
};

function limb(parent: Element, hot: boolean, ghost = false, far = false): Limb {
  return { seg: mk("path", { fill: hot && !ghost && !far ? C.ember : C.ink }, parent), hot };
}

/** Construye el atleta (lado lejano + cuerpo + lado cercano). Devuelve los nodos para actualizar por cuadro. */
function buildRig(parent: Element, an: Anim, layers: { farBehind: Element; mid: Element }, ghost = false): Rig {
  const hi = new Set(an.hi);
  const g = mk("g", {}, parent);
  const farG = mk("g", { class: "mo-far" }, layers.farBehind);
  const far = {
    g: farG, thigh: limb(farG, false, ghost, true), shin: limb(farG, false, ghost, true),
    shoe: mk("path", { fill: C.ink }, farG),
    ua: limb(farG, false, ghost, true), fa: limb(farG, false, ghost, true),
    cuff: mk("path", { fill: C.banana }, farG), hand: mk("circle", { r: 3.7, fill: C.ink }, farG),
  };
  const tail = mk("path", { fill: "none", stroke: C.ink, "stroke-width": 2.8, "stroke-linecap": "round", opacity: (an.face ?? 1) < 0 ? 0 : 1 }, g);
  const thigh = limb(g, hi.has("thigh"), ghost);
  const stripe = mk("path", { fill: "none", stroke: C.banana, "stroke-width": 1.5, "stroke-linecap": "round" }, g);
  const torso = mk("path", { fill: C.ink }, g);
  const zones: Rig["zones"] = [];
  if (!ghost) for (const z of an.hi) if (ZONES[z]) zones.push([mk("path", { fill: C.ember }, g), ZONES[z]]);
  const waist = mk("path", { fill: "none", stroke: C.banana, "stroke-width": 1.8, "stroke-linecap": "round" }, g);
  const neck = mk("path", { fill: C.ink }, g);
  const ear = mk("circle", { r: 3.6, fill: C.ink }, g);
  const earIn = mk("circle", { r: 1.6, fill: C.face }, g);
  const head = mk("circle", { r: 8.8, fill: C.ink }, g);
  const facePatch = mk("path", { fill: C.face }, g);
  const muzzle = mk("path", { fill: C.face }, g);
  const eye = mk("circle", { r: 1.2, fill: C.ink }, g);
  const band = mk("path", { fill: C.banana }, g);
  const shin = limb(g, hi.has("shin"), ghost);
  const shoe = mk("path", { fill: C.ink }, g);
  const sole = mk("path", { fill: "none", stroke: C.paper, "stroke-width": 1.5, "stroke-linecap": "round" }, g);
  parent.appendChild(layers.mid);
  const armG = mk("g", {}, parent);
  const ua = limb(armG, hi.has("ua"), ghost), fa = limb(armG, hi.has("fa"), ghost);
  const cuff = mk("path", { fill: C.banana }, armG);
  const hand = mk("circle", { r: 3.8, fill: C.ink }, armG);
  return { g, torso, zones, neck, head, ear, earIn, facePatch, muzzle, eye, band, tail, waist, thigh, shin, shoe, sole, stripe, ua, fa, hand, cuff, far };
}

type FarJ = { hip: Pt; knee: Pt; ankle: Pt; toe: Pt; sh: Pt; el: Pt; wr: Pt };
function drawRig(r: Rig, j: Joints, fj: FarJ, face: number, neckAng: number) {
  const F = frame(j.hip, j.sh, face);
  // lado lejano
  setD(r.far.thigh.seg, muscle(fj.hip, R.hip, fj.knee, R.knee, 3.2, 0.45)); setD(r.far.shin.seg, muscle(fj.knee, R.knee - 0.1, fj.ankle, R.ankle, 2.4, 0.28));
  setD(r.far.shoe, shoe(fj.ankle, fj.toe));
  setD(r.far.ua.seg, muscle(fj.sh, R.sh, fj.el, R.el, 3.4, 0.55, 2.2)); setD(r.far.fa.seg, muscle(fj.el, R.el, fj.wr, R.wr, 2.1, 0.26));
  const fdir = unit(sub(fj.wr, fj.el));
  setD(r.far.cuff, capsule(add(fj.wr, fdir, -6.4), 3.8, add(fj.wr, fdir, -2.8), 3.5));
  r.far.hand.setAttribute("cx", f1(fj.wr[0] + fdir[0] * 2)); r.far.hand.setAttribute("cy", f1(fj.wr[1] + fdir[1] * 2));
  // cuerpo
  setD(r.torso, torsoPath(F));
  for (const [el, z] of r.zones) setD(el, zonePath(F, z));
  setD(r.waist, `M${xy(at(F, 0.17, prof(FRONT, 0.17) - 0.2))}L${xy(at(F, 0.17, -prof(BACK, 0.17) + 0.2))}`);
  const tb = at(F, 0.02, -9.6);
  setD(r.tail, `M${xy(tb)}C${xy(add(add(tb, F.f, -12), F.u, -6))} ${xy(add(add(tb, F.f, -26), F.u, -2))} ${xy(add(add(tb, F.f, -28), F.u, 10))}S${xy(add(add(tb, F.f, -22), F.u, 24))} ${xy(add(add(tb, F.f, -15), F.u, 19))}`);
  setD(r.thigh.seg, muscle(j.hip, R.hip, j.knee, R.knee, 3.2, 0.45));
  const td = unit(sub(j.knee, j.hip));
  setD(r.stripe, `M${xy(add(j.hip, td, 2))}L${xy(add(j.hip, td, 17))}`);
  setD(r.shin.seg, muscle(j.knee, R.knee - 0.1, j.ankle, R.ankle, 2.4, 0.28));
  setD(r.shoe, shoe(j.ankle, j.toe));
  const sd = unit(sub(j.toe, j.ankle)); const sn = perp(sd); const sol: Pt = [sn[0] * face, sn[1] * face];
  setD(r.sole, `M${xy(add(add(j.ankle, sd, -3.2), sol, 3.7))}L${xy(add(add(j.toe, sd, 1.6), sol, 2.7))}`);
  // cabeza: perfil de mono atleta
  const ha = unit([Math.cos(rad(neckAng)), Math.sin(rad(neckAng))]); const hn = perp(ha); const hf: Pt = [hn[0] * face, hn[1] * face];
  const H = j.head;
  setD(r.neck, capsule(j.sh, 4, add(j.sh, ha, 9), 3.4));
  r.head.setAttribute("cx", f1(H[0])); r.head.setAttribute("cy", f1(H[1]));
  const E = add(add(H, hf, -6.6), ha, 0.6);
  r.ear.setAttribute("cx", f1(E[0])); r.ear.setAttribute("cy", f1(E[1])); r.earIn.setAttribute("cx", f1(E[0])); r.earIn.setAttribute("cy", f1(E[1]));
  setD(r.facePatch, closed([add(add(H, hf, 0.6), ha, 4.6), add(add(H, hf, 5.4), ha, 4.2), add(add(H, hf, 8.6), ha, 0.6), add(add(H, hf, 7.6), ha, -4.2), add(add(H, hf, 2.8), ha, -5.6), add(add(H, hf, 0.4), ha, -1)]));
  setD(r.muzzle, closed([add(add(H, hf, 6.6), ha, -0.6), add(add(H, hf, 10.6), ha, -1.4), add(add(H, hf, 10.2), ha, -4.4), add(add(H, hf, 6.2), ha, -5.2)]));
  const ey = add(add(H, hf, 4.6), ha, 1.6);
  r.eye.setAttribute("cx", f1(ey[0])); r.eye.setAttribute("cy", f1(ey[1]));
  setD(r.band, closed([add(add(H, hf, -8.4), ha, 2.4), add(add(H, hf, -2), ha, 6.6), add(add(H, hf, 4.4), ha, 8), add(add(H, hf, 4.8), ha, 6), add(add(H, hf, -1.6), ha, 4.4), add(add(H, hf, -8.2), ha, 0.2)]));
  // brazo cercano
  setD(r.ua.seg, muscle(j.sh, R.sh, j.el, R.el, 3.4, 0.55, 2.2)); setD(r.fa.seg, muscle(j.el, R.el, j.wr, R.wr, 2.1, 0.26));
  const wd = unit(sub(j.wr, j.el));
  setD(r.cuff, capsule(add(j.wr, wd, -6.4), 3.8, add(j.wr, wd, -2.8), 3.5));
  r.hand.setAttribute("cx", f1(j.wr[0] + wd[0] * 2.2)); r.hand.setAttribute("cy", f1(j.wr[1] + wd[1] * 2.2));
}
function shoe(ankle: Pt, toe: Pt) {
  const d = unit(sub(toe, ankle));
  return capsule(add(ankle, d, -2.8), 4.1, add(toe, d, 1.2), 3);
}

/* ---------- Vista frontal (elevaciones laterales) ---------- */
type FrontRig = { uaL: SVGPathElement; faL: SVGPathElement; uaR: SVGPathElement; faR: SVGPathElement; hL: SVGCircleElement; hR: SVGCircleElement; cL: SVGPathElement; cR: SVGPathElement; dL: SVGPathElement[]; dR: SVGPathElement[]; delts: SVGPathElement[] };
function buildFront(parent: Element, hot: boolean, ghost: boolean, withDb: boolean): FrontRig {
  const g = mk("g", {}, parent);
  for (const s of [-1, 1]) {
    mk("path", { fill: C.ink, d: muscle([100 + s * 7.8, 104], 9.4, [100 + s * 9, 140], 6.2, 2.6, 0.42) }, g);
    mk("path", { fill: C.ink, d: muscle([100 + s * 9, 140], 6, [100 + s * 9.6, 175], 3.9, 2.2, 0.28) }, g);
    mk("path", { fill: C.ink, d: capsule([100 + s * 9.6, 178], 3.6, [100 + s * 12.6, 178.6], 3) }, g);
    mk("path", { fill: "none", stroke: C.paper, "stroke-width": 1.4, "stroke-linecap": "round", d: `M${100 + s * 7} 181.4L${100 + s * 14.4} 181.4` }, g);
    mk("path", { fill: "none", stroke: C.banana, "stroke-width": 1.5, "stroke-linecap": "round", d: `M${100 + s * 14.2} 107L${100 + s * 15.4} 122` }, g);
  }
  mk("path", { fill: C.ink, d: closed([[83.5, 54], [100, 51], [116.5, 54], [119.5, 62], [115.5, 80], [112, 92], [115.5, 106], [100, 110.5], [84.5, 106], [88, 92], [84.5, 80], [80.5, 62]]) }, g);
  mk("path", { fill: "none", stroke: C.banana, "stroke-width": 1.8, "stroke-linecap": "round", d: "M88.5 100Q100 102.5 111.5 100" }, g);
  mk("path", { fill: C.ink, d: capsule([100, 54], 4.6, [100, 44], 4) }, g);
  for (const s of [-1, 1]) { mk("circle", { cx: 100 + s * 9.6, cy: 36, r: 3.8, fill: C.ink }, g); mk("circle", { cx: 100 + s * 9.6, cy: 36, r: 1.7, fill: C.face }, g); }
  mk("circle", { cx: 100, cy: 34.5, r: 9.2, fill: C.ink }, g);
  mk("path", { fill: C.face, d: closed([[100, 30.5], [106.4, 33], [106.8, 39], [103.4, 43.4], [100, 44], [96.6, 43.4], [93.2, 39], [93.6, 33]]) }, g);
  mk("path", { fill: C.face, d: closed([[100, 38.4], [104.2, 40.2], [103.2, 44.6], [100, 45.4], [96.8, 44.6], [95.8, 40.2]]) }, g);
  for (const s of [-1, 1]) mk("circle", { cx: 100 + s * 3, cy: 36, r: 1.15, fill: C.ink }, g);
  mk("path", { fill: C.banana, d: closed([[91, 30], [100, 26.4], [109, 30], [108.4, 32], [100, 29], [91.6, 32]]) }, g);
  const arm = (): [SVGPathElement, SVGPathElement, SVGPathElement, SVGCircleElement] => [mk("path", { fill: hot && !ghost ? C.ember : C.ink }, g), mk("path", { fill: C.ink }, g), mk("path", { fill: C.banana }, g), mk("circle", { r: 3.8, fill: C.ink }, g)];
  const [uaL, faL, cL, hL] = arm(), [uaR, faR, cR, hR] = arm();
  const delts = hot && !ghost ? [mk("path", { fill: C.ember }, g), mk("path", { fill: C.ember }, g)] : [];
  const db = () => (withDb ? [mk("path", { fill: C.ink, "fill-opacity": 0.45, stroke: C.ink, "stroke-opacity": 0.45, "stroke-width": 1, "stroke-linejoin": "round" }, g), mk("path", { stroke: C.ink, "stroke-width": 2.4, "stroke-linecap": "round" }, g), mk("path", { fill: C.banana, stroke: C.ink, "stroke-width": 1.3, "stroke-linejoin": "round" }, g)] : []);
  return { uaL, faL, uaR, faR, hL, hR, cL, cR, dL: db(), dR: db(), delts };
}
function drawFront(r: FrontRig, a: number) {
  const sR: Pt = [114.5, 57.5], sL: Pt = [85.5, 57.5];
  const eR = P(sR, L.ua, a), wR = P(eR, L.fa - 2, a - 8);
  const eL: Pt = [200 - eR[0], eR[1]], wL: Pt = [200 - wR[0], wR[1]];
  for (const [ua, fa, cf, h, s, e, w, dbs, dl] of [[r.uaR, r.faR, r.cR, r.hR, sR, eR, wR, r.dR, r.delts[0]], [r.uaL, r.faL, r.cL, r.hL, sL, eL, wL, r.dL, r.delts[1]]] as const) {
    setD(ua, muscle(s, R.sh, e, R.el, 3.4, 0.55, 2.2)); setD(fa, muscle(e, R.el, w, R.wr, 2.1, 0.26));
    const d = unit(sub(w, e));
    setD(cf, capsule(add(w, d, -6.4), 3.8, add(w, d, -2.8), 3.5));
    const hc = add(w, d, 2.2); h.setAttribute("cx", f1(hc[0])); h.setAttribute("cy", f1(hc[1]));
    if (dl) setD(dl, capsule(s, 6.6, add(s, unit(sub(e, s)), 9), 4.6));
    if (dbs.length) { setD(dbs[0], hexPath(add(hc, D, 2.4), 6)); setD(dbs[1], `M${xy(hc)}L${xy(add(hc, D, 2.4))}`); setD(dbs[2], hexPath(add(hc, D, -0.9), 6.4)); }
  }
}

/* ---------- Figura ---------- */
type Fig = {
  svg: SVGSVGElement; an: Anim; t: number; visible: boolean; root: HTMLElement;
  render: (time: number) => State; hudLabel: HTMLElement | null; segs: HTMLElement[]; lastLabel: string; lastI: number;
};
const FIGS = new Set<Fig>();
let rafId = 0, last = 0;
const reduce = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let io: IntersectionObserver | null = null;
const byEl = new WeakMap<Element, Fig>();

function buildFigure(container: HTMLElement, key: string, { label = true }: { label?: boolean } = {}) {
  const an = ANIM[key];
  if (!an) return null;
  const id = `mo${++uid}`;
  const face = an.face ?? 1;
  const still = reduce();
  const svg = mk("svg", { "aria-hidden": "true", focusable: "false", preserveAspectRatio: "xMidYMid meet" });
  const defs = mk("defs", {}, svg);
  const glowF = mk("filter", { id: `${id}g`, x: "-60%", y: "-60%", width: "220%", height: "220%" }, defs);
  mk("feGaussianBlur", { stdDeviation: 2.6 }, glowF);
  const sh = mk("radialGradient", { id: `${id}s` }, defs);
  mk("stop", { offset: "0", "stop-color": "#1B1505", "stop-opacity": 0.32 }, sh);
  mk("stop", { offset: "1", "stop-color": "#1B1505", "stop-opacity": 0 }, sh);

  const floor = mk("g", {}, svg);
  mk("line", { x1: -2000, x2: 2000, y1: FLOOR, y2: FLOOR, stroke: "var(--mo-floor)", "stroke-width": 1.4 }, floor);
  const shadow = mk("ellipse", { cx: 100, cy: FLOOR, rx: 30, ry: 3.6, fill: `url(#${id}s)` }, floor);
  const scene = mk("g", {}, svg);
  const back = mk("g", {}, scene);
  const trail = mk("path", { fill: "none", stroke: C.ink, "stroke-opacity": 0.32, "stroke-width": 1.3, "stroke-linecap": "round", "stroke-dasharray": "0.1 3.6" }, scene);
  const farEq = mk("g", { class: "mo-far" }, scene);
  const farBehind = mk("g", {}, scene);
  const shaft = mk("g", {}, scene);
  const ghostG = still && an.mode !== "front" ? mk("g", { opacity: 0.2 }, scene) : null;
  // El brillo va detrás del cuerpo: se ve como un halo alrededor del músculo, no como una mancha encima.
  const glow = mk("g", { filter: `url(#${id}g)`, opacity: 0 }, scene);
  const body = mk("g", {}, scene);
  const mid = mk("g", {});
  const nearEq = mk("g", {}, scene);

  const has = (p: string) => an.props.includes(p);
  const steel = (attrs: Attrs, p: Element = back) => mk("path", { fill: "none", stroke: C.steel, "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round", ...attrs }, p);
  const pad = (d: string, p: Element = back) => mk("path", { d, fill: C.pad }, p);

  /* equipo fijo */
  if (has("rack")) {
    for (const [k, op] of [[5, 0.5], [0, 1]] as const) {
      const x = 142 + D[0] * k, y0 = 36 + D[1] * k, base = FLOOR + D[1] * k;
      const g = mk("g", { opacity: op }, back);
      mk("rect", { x: f1(x - 2.6), y: f1(y0), width: 5.2, height: f1(base - y0), rx: 1.6, fill: C.steel }, g);
      for (let y = y0 + 8; y < base - 10; y += 7) mk("circle", { cx: f1(x), cy: f1(y), r: 0.9, fill: C.paper, opacity: 0.7 }, g);
      steel({ d: `M${f1(x - 2)} ${f1(y0 + 26)}H${f1(x - 9)}V${f1(y0 + 21)}`, "stroke-width": 2.6 }, g);
      steel({ d: `M${f1(x - 10)} ${f1(base)}H${f1(x + 10)}`, "stroke-width": 3 }, g);
    }
  }
  if (has("bench")) {
    pad(`M40 128.6h102a3.8 3.8 0 0 1 0 7.6H40a3.8 3.8 0 0 1 0-7.6Z`);
    steel({ d: `M56 136.2L56 ${FLOOR}M126 136.2L126 ${FLOOR}M48 ${FLOOR}H64M118 ${FLOOR}H134` });
    steel({ d: `M154 52L154 ${FLOOR}M146 ${FLOOR}H162M154 64H143L143 59`, "stroke-width": 3 });
  }
  if (has("incline")) {
    const h = pt(an.A.root, [72, 128]), a = num(an.A.torso);
    const u: Pt = [Math.cos(rad(a)), Math.sin(rad(a))], bn: Pt = [-u[1] * -1, u[0] * -1];
    const b0 = add(add(h, u, -8), bn, -12.6), b1 = add(add(h, u, 62), bn, -12.6);
    mk("path", { d: capsule(b0, 4.2, b1, 4.2), fill: C.pad }, back);
    pad(`M44 138.6h30a3.8 3.8 0 0 1 0 7.6H44a3.8 3.8 0 0 1 0-7.6Z`);
    const mid0 = add(b0, sub(b1, b0), 0.55);
    steel({ d: `M62 146.2L62 ${FLOOR}M${f1(mid0[0])} ${f1(mid0[1] + 3)}L${f1(mid0[0] + 16)} ${FLOOR}M50 ${FLOOR}H${f1(mid0[0] + 24)}` });
  }
  if (has("benchlow")) {
    pad(`M128 143.4h52a3.8 3.8 0 0 1 0 7.6H128a3.8 3.8 0 0 1 0-7.6Z`);
    steel({ d: `M138 151L138 ${FLOOR}M172 151L172 ${FLOOR}M131 ${FLOOR}H145M165 ${FLOOR}H179` });
  }
  if (has("pullbar")) {
    const r = pt(an.A.root, [100, -10]);
    const top = r[1] - 13, far = add(r, D, 4);
    steel({ d: `M162 ${top}L162 ${FLOOR}M152 ${FLOOR}H172M162 ${top}H${f1(far[0])}M${f1(far[0])} ${top}V${f1(far[1])}`, "stroke-width": 3.2 });
    mk("path", { d: `M${xy(r)}L${xy(far)}`, stroke: C.ink, "stroke-opacity": 0.75, "stroke-width": 3, "stroke-linecap": "round" }, back);
    mk("path", { d: `M${xy(add(r, D, -0.2))}L${xy(add(r, D, -1.5))}`, stroke: C.ink, "stroke-width": 3, "stroke-linecap": "round" }, nearEq);
  }
  if (has("dipbars")) {
    const r = pt(an.A.root, [100, 78]);
    for (const [k, p, op] of [[3, back, 0.5], [-1, mid, 1]] as const) {
      const o = add(r, D, k);
      const g = mk("g", { opacity: op }, p);
      steel({ d: `M${f1(o[0] - 30)} ${f1(o[1])}H${f1(o[0] + 30)}`, stroke: C.ink, "stroke-opacity": 0.8, "stroke-width": 2.6 }, g);
      steel({ d: `M${f1(o[0] - 24)} ${f1(o[1])}V${FLOOR}M${f1(o[0] + 24)} ${f1(o[1])}V${FLOOR}` }, g);
    }
  }
  if (has("cable")) {
    mk("rect", { x: 180, y: -26, width: 14, height: FLOOR + 26, rx: 3, fill: C.steel }, back);
    for (let i = 0; i < 6; i++) mk("rect", { x: 182.5, y: 150 + i * 5, width: 9, height: 3.6, rx: 1, fill: i === 0 ? C.banana : C.pad }, back);
    mk("line", { x1: 187, x2: 187, y1: 40, y2: 150, stroke: C.ink, "stroke-opacity": 0.4, "stroke-width": 1 }, back);
    mk("circle", { cx: 186, cy: 36, r: 5, fill: C.pad }, back);
    mk("circle", { cx: 186, cy: 36, r: 1.6, fill: C.paper }, back);
  }

  /* equipo móvil */
  const plateR = an.plate ?? 18;
  type Plates = { ink: SVGCircleElement; outer: SVGCircleElement; ring: SVGCircleElement; hub: SVGCircleElement; dot: SVGCircleElement };
  const plateSet = (p: Element, r: number): Plates => ({
    ink: mk("circle", { r: r * 0.86, fill: C.ink }, p),
    outer: mk("circle", { r, fill: C.banana, stroke: C.ink, "stroke-width": 1.4 }, p),
    ring: mk("circle", { r: r * 0.62, fill: "none", stroke: C.ink, "stroke-opacity": 0.22, "stroke-width": 1 }, p),
    hub: mk("circle", { r: Math.max(2.2, r * 0.18), fill: C.ink }, p),
    dot: mk("circle", { r: Math.max(0.8, r * 0.07), fill: C.paper }, p),
  });
  const isBar = has("barbell") || has("barbell-sm");
  const pr = has("barbell-sm") ? 9 : plateR;
  const plates = isBar ? { far: plateSet(farEq, pr), near: plateSet(nearEq, pr), shaft: mk("path", { stroke: C.ink, "stroke-width": has("barbell-sm") ? 2 : 2.4, "stroke-linecap": "round" }, shaft) } : null;
  const dbs = has("dumbbell") || has("dumbbell-one");
  const dbNear = dbs && an.mode !== "front" ? { farHead: mk("path", { fill: C.ink, "fill-opacity": 0.5, stroke: C.ink, "stroke-opacity": 0.5, "stroke-width": 1, "stroke-linejoin": "round" }, shaft), handle: mk("path", { stroke: C.ink, "stroke-width": 2.4, "stroke-linecap": "round" }, shaft), head: mk("path", { fill: C.banana, stroke: C.ink, "stroke-width": 1.3, "stroke-linejoin": "round" }, nearEq) } : null;
  const dbFar = has("dumbbell") && an.mode !== "front" ? { head: mk("path", { fill: C.banana, stroke: C.ink, "stroke-width": 1.3, "stroke-linejoin": "round" }, farEq), farHead: mk("path", { fill: C.ink, stroke: C.ink, "stroke-width": 1, "stroke-linejoin": "round" }, farEq) } : null;
  const cable = has("cable") ? { line: mk("path", { stroke: C.ink, "stroke-opacity": 0.7, "stroke-width": 1.1, fill: "none" }, mid), rope: mk("path", { stroke: C.ink, "stroke-width": 2.2, "stroke-linecap": "round", fill: "none" }, nearEq) } : null;

  /* atleta */
  let rig: Rig | null = null, ghost: Rig | null = null, front: FrontRig | null = null;
  if (an.mode === "front") front = buildFront(body, an.hi.includes("ua"), false, dbs);
  else {
    if (ghostG) ghost = buildRig(ghostG, an, { farBehind: ghostG, mid: mk("g", {}) }, true);
    rig = buildRig(body, an, { farBehind, mid }, false);
  }
  // copias para el brillo del músculo objetivo
  const glowEls: [string, SVGPathElement][] = an.hi.map((h) => [h, mk("path", { fill: C.ember }, glow)]);
  const hotOpacity = (s: State) => (s.k === "con" ? 0.2 + 0.75 * Math.sin(Math.PI * Math.min(1, s.phaseProg * 1.15)) : s.k === "hold" && an.ph[(s.i - 1 + an.ph.length) % an.ph.length][3] === "con" ? 0.2 * (1 - s.phaseProg) : 0);

  const T = total(an);
  const farJ = (j: Joints, time: number): FarJ => {
    const s = (p: Pt) => add(p, D);
    const hip = s(j.hip), fsh = s(j.sh);
    let knee = s(j.knee), ankle = s(j.ankle), toe = s(j.toe), el = s(j.el), wr = s(j.wr);
    if (an.alt) {
      const qa = poseAt(an, time + T / 2).q;
      const k180 = an.mode === "ankle" ? 180 : 0;
      knee = P(hip, L.thigh, num(qa.thigh) + k180); ankle = P(knee, L.shin, num(qa.shin) + k180); toe = P(ankle, L.foot, num(qa.foot, 0));
    }
    if (an.farHand) { wr = add(an.farHand, D); el = ik(fsh, wr, L.ua, L.fa, [-face, 0.4]); }
    return { hip, knee, ankle, toe, sh: fsh, el, wr };
  };

  const zoneFor = (F: Frame, h: string) => (ZONES[h] ? zonePath(F, ZONES[h]) : "");
  const render = (time: number) => {
    const s = poseAt(an, time);
    if (front) {
      drawFront(front, num(s.q.a));
      const pts: Pt[] = [[90, 181], [110, 181]];
      setShadow(pts, 100, 0);
    } else if (rig) {
      const q = { ...s.q };
      if (s.lift) { const r = pt(q.root, [100, 178]); q.root = [r[0], r[1] - 20 * s.lift]; q.foot = 50 * s.lift; }
      const j = solve(an.mode, q);
      const fj = farJ(j, time);
      drawRig(rig, j, fj, face, num(q.neck));
      const F = frame(j.hip, j.sh, face);
      for (const [h, el] of glowEls) {
        el.setAttribute("d", h === "thigh" ? capsule(j.hip, R.hip, j.knee, R.knee) : h === "shin" ? capsule(j.knee, R.knee, j.ankle, R.ankle) : h === "ua" ? capsule(j.sh, R.sh, j.el, R.el) : h === "fa" ? capsule(j.el, R.el, j.wr, R.wr) : zoneFor(F, h));
      }
      // equipo
      const b = an.bar ? an.bar(j) : j.wr;
      if (plates) {
        const n0 = add(b, D, -1.2), f0 = add(b, D, 2.2);
        placePlates(plates.near, n0, add(b, D, -0.7)); placePlates(plates.far, f0, add(b, D, 1.7));
        setD(plates.shaft, `M${xy(add(b, D, -1.5))}L${xy(add(b, D, 2.5))}`);
      }
      if (dbNear) {
        const hc = add(j.wr, unit(sub(j.wr, j.el)), 2.2);
        setD(dbNear.head, hexPath(add(hc, D, -0.9), 6.4)); setD(dbNear.farHead, hexPath(add(hc, D, 2.6), 6)); setD(dbNear.handle, `M${xy(add(hc, D, -0.9))}L${xy(add(hc, D, 2.6))}`);
      }
      if (dbFar) {
        const hc = add(fj.wr, unit(sub(fj.wr, fj.el)), 2);
        setD(dbFar.head, hexPath(add(hc, D, -0.9), 6.2)); setD(dbFar.farHead, hexPath(add(hc, D, 2.6), 5.8));
      }
      if (cable) {
        const hc = add(j.wr, unit(sub(j.wr, j.el)), 2.2);
        setD(cable.line, `M181 36.5L${xy(hc)}`);
        const cu = unit(sub([181, 36], hc)), cn = perp(cu);
        setD(cable.rope, `M${xy(add(hc, cn, 3.2))}L${xy(hc)}L${xy(add(hc, cn, -3.2))}`);
      }
      // sombra de contacto
      const pts = [j.ankle, j.toe, fj.ankle, fj.toe, j.wr, j.el, fj.wr].filter((p) => p[1] > FLOOR - 8);
      setShadow(pts, (j.hip[0] + j.sh[0]) / 2, Math.max(0, (j.hip[1] - 90) / 60));
      if (ghost && time === 0) {
        const g0 = solve(an.mode, an.A);
        drawRig(ghost, g0, farJ(g0, 0), face, num(an.A.neck));
      }
    }
    glow.setAttribute("opacity", f1(still ? 0.35 : hotOpacity(s)));
    return s;
  };
  function placePlates(p: Plates, outer: Pt, inner: Pt) {
    p.ink.setAttribute("cx", f1(inner[0])); p.ink.setAttribute("cy", f1(inner[1]));
    for (const c of [p.outer, p.ring, p.hub, p.dot]) { c.setAttribute("cx", f1(outer[0])); c.setAttribute("cy", f1(outer[1])); }
  }
  function setShadow(pts: Pt[], cx: number, load: number) {
    if (!pts.length) { shadow.setAttribute("cx", f1(cx)); shadow.setAttribute("rx", "16"); shadow.setAttribute("opacity", "0.45"); return; }
    const xs = pts.map((p) => p[0]); const lo = Math.min(...xs), hi = Math.max(...xs);
    const c = Math.max(lo - 4, Math.min(hi + 4, cx));
    shadow.setAttribute("cx", f1((c + (lo + hi) / 2) / 2));
    shadow.setAttribute("rx", f1((hi - lo) / 2 + 14 + 6 * load));
    shadow.setAttribute("opacity", f1(0.8 + 0.2 * load));
  }

  // trayectoria de la barra
  if (an.bar && an.mode !== "front" && label) {
    let d = "";
    for (let i = 0; i <= 72; i++) { const q = poseAt(an, (T * i) / 72).q; const j = solve(an.mode, q); const b = an.bar(j); d += (i ? "L" : "M") + xy(b); }
    trail.setAttribute("d", d);
  }

  /* HUD: fase + barra segmentada */
  let hudLabel: HTMLElement | null = null; const segs: HTMLElement[] = [];
  if (label) {
    const hud = document.createElement("div"); hud.className = "motion-hud"; hud.setAttribute("aria-hidden", "true");
    hudLabel = document.createElement("p"); hudLabel.className = "motion-label"; hud.appendChild(hudLabel);
    const track = document.createElement("div"); track.className = "motion-track"; hud.appendChild(track);
    for (const [, d, , k] of an.ph) {
      const seg = document.createElement("span"); seg.className = "motion-seg"; seg.style.flexGrow = String(d);
      const fill = document.createElement("i"); fill.dataset.k = k; seg.appendChild(fill); track.appendChild(seg); segs.push(fill);
    }
    container.prepend(hud);
  }
  container.appendChild(svg);

  // Encuadre: caja de todas las poses del ciclo + equipo, para que la figura llene el recuadro.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (bb: DOMRect) => { if (!bb.width && !bb.height) return; x0 = Math.min(x0, bb.x); y0 = Math.min(y0, bb.y); x1 = Math.max(x1, bb.x + bb.width); y1 = Math.max(y1, bb.y + bb.height); };
  try {
    for (let i = 0; i < 24; i++) { render((T * i) / 24); grow(scene.getBBox()); }
  } catch { x0 = 0; y0 = -30; x1 = 200; y1 = 190; }
  if (!isFinite(x0)) { x0 = 0; y0 = -30; x1 = 200; y1 = 190; }
  y1 = Math.max(y1, FLOOR + 3);
  const w = x1 - x0, h = y1 - y0, padP = Math.max(w, h) * (label ? 0.07 : 0.05);
  svg.setAttribute("viewBox", `${f1(x0 - padP)} ${f1(y0 - padP)} ${f1(w + padP * 2)} ${f1(h + padP * 1.6)}`);

  const fig: Fig = { svg, an, t: 0, visible: true, root: container, render, hudLabel, segs, lastLabel: "", lastI: -1 };
  if (still) {
    render(0);
    // Pose de trabajo fija sobre la inicial en fantasma, con la etiqueta de la fase principal.
    const main = an.ph.findIndex((p) => p[0] !== "A") >= 0 ? an.ph.findIndex((p) => p[0] !== "A") : 0;
    const stillT = an.ph.slice(0, main + 1).reduce((a, p) => a + p[1], 0) - 0.001;
    render(stillT);
    if (hudLabel) hudLabel.textContent = an.ph[main][2];
    return { destroy: () => { svg.remove(); container.querySelector(".motion-hud")?.remove(); } };
  }
  fig.t = 0;
  hud(fig, render(0));
  FIGS.add(fig); byEl.set(container, fig);
  observe(container);
  start();
  return {
    destroy() {
      FIGS.delete(fig); io?.unobserve(container); svg.remove(); container.querySelector(".motion-hud")?.remove();
    },
  };
}

function hud(f: Fig, s: State) {
  if (!f.hudLabel) return;
  if (s.label !== f.lastLabel) {
    f.hudLabel.textContent = s.label; f.lastLabel = s.label;
    f.hudLabel.animate?.([{ opacity: 0.35, transform: "translateY(2px)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  }
  if (s.i !== f.lastI) { f.segs.forEach((e, i) => { e.style.transform = `scaleX(${i < s.i ? 1 : 0})`; }); f.lastI = s.i; }
  f.segs[s.i].style.transform = `scaleX(${s.phaseProg.toFixed(3)})`;
}

function observe(el: Element) {
  if (typeof IntersectionObserver === "undefined") return;
  io ??= new IntersectionObserver((entries) => {
    for (const e of entries) { const f = byEl.get(e.target); if (f) f.visible = e.isIntersecting; }
    start();
  }, { rootMargin: "80px" });
  io.observe(el);
}
function anyActive() { for (const f of FIGS) if (f.visible) return true; return false; }
function start() {
  if (rafId || typeof document === "undefined" || document.hidden || !anyActive()) return;
  last = performance.now();
  rafId = requestAnimationFrame(loop);
}
function loop(now: number) {
  rafId = 0;
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  for (const f of FIGS) {
    if (!f.root.isConnected) { FIGS.delete(f); continue; }
    if (!f.visible) continue;
    f.t += dt;
    hud(f, f.render(f.t));
  }
  if (!document.hidden && anyActive()) rafId = requestAnimationFrame(loop);
}
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelAnimationFrame(rafId); rafId = 0; } else start(); });

export { ANIM, buildFigure };
