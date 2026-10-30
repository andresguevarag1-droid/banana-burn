// Pista de audio común de R03, sintetizada en código (sin muestras ni música de terceros, así no hay licencias).
// 120 bpm: un compás de 4 tiempos dura 2 s y cae con los cambios de pantalla. Bombo, palmas, hi-hat y un bajo
// sencillo; en el cierre (s 12) se queda solo el bajo y suena una campana cuando el botón cede (s 13.6).
// Devuelve un WAV PCM de 16 bits, 48 kHz, estéreo. Es determinista: siempre sale el mismo archivo.

const SR = 48000;
const BPM = 120;
const TIEMPO = 60 / BPM;

export function pista(duracion) {
  const n = Math.round(duracion * SR);
  const L = new Float32Array(n), R = new Float32Array(n);

  // Ruido con semilla fija para que la pista sea idéntica en cada render.
  let semilla = 20261105;
  const ruido = () => ((semilla = (semilla * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;

  const suma = (desde, largo, fn, pan = 0) => {
    const i0 = Math.round(desde * SR), m = Math.min(n - i0, Math.round(largo * SR));
    for (let i = 0; i < m; i++) {
      const v = fn(i / SR);
      L[i0 + i] += v * (1 - Math.max(0, pan));
      R[i0 + i] += v * (1 + Math.min(0, pan));
    }
  };

  const bombo = (t0) => {
    let fase = 0;
    suma(t0, 0.35, (t) => {
      fase += (2 * Math.PI * (45 + 95 * Math.exp(-t * 28))) / SR;
      return Math.sin(fase) * Math.exp(-t * 9) * 0.9;
    });
  };
  const palmas = (t0) => {
    let y = 0;
    suma(t0, 0.18, (t) => {
      const x = ruido();
      y = 0.6 * y + 0.4 * x;
      const capas = t < 0.03 ? 1 - ((t * 100) % 1) * 0.5 : 1;
      return (x - y) * Math.exp(-t * 26) * 0.32 * capas;
    });
  };
  const hihat = (t0, pan) => {
    let previo = 0;
    suma(t0, 0.06, (t) => {
      const x = ruido(), v = x - previo;
      previo = x;
      return v * Math.exp(-t * 70) * 0.09;
    }, pan);
  };
  const nota = (t0, largo, hz, vol) => {
    suma(t0, largo, (t) => {
      const env = Math.min(1, t * 200) * Math.exp(-t * 3.2);
      const w = 2 * Math.PI * hz * t;
      return (Math.sin(w) + 0.35 * Math.sin(2 * w) + 0.12 * Math.sin(3 * w)) * env * vol;
    });
  };
  const campana = (t0) => {
    for (const [hz, v] of [[880, 0.16], [1318.5, 0.1], [1760, 0.05]]) {
      suma(t0, 1.4, (t) => Math.sin(2 * Math.PI * hz * t) * Math.exp(-t * 3.5) * v * Math.min(1, t * 400));
    }
  };

  // Bajo por compás (2 s): La, Fa, Do, Sol, en corcheas.
  const BAJO = [110, 87.31, 130.81, 98];
  const cierre = 12;
  for (let b = 0; b < duracion / TIEMPO; b++) {
    const t = b * TIEMPO;
    const compas = Math.floor(b / 4);
    const hz = BAJO[compas % BAJO.length];
    nota(t, TIEMPO / 2, hz, 0.22);
    nota(t + TIEMPO / 2, TIEMPO / 2, hz, t + TIEMPO / 2 < cierre ? 0.16 : 0.1);
    if (t >= cierre) {
      if (t === cierre) bombo(t);
      continue;
    }
    bombo(t);
    if (b % 2 === 1) palmas(t);
    hihat(t + TIEMPO / 2, b % 2 ? 0.3 : -0.3);
  }
  campana(13.6);

  // Normaliza a -1 dBFS y baja el volumen en los últimos 0.5 s.
  let pico = 0;
  for (let i = 0; i < n; i++) pico = Math.max(pico, Math.abs(L[i]), Math.abs(R[i]));
  const g = 10 ** (-1 / 20) / pico;
  const datos = Buffer.alloc(44 + n * 4);
  datos.write("RIFF", 0); datos.writeUInt32LE(36 + n * 4, 4); datos.write("WAVE", 8);
  datos.write("fmt ", 12); datos.writeUInt32LE(16, 16); datos.writeUInt16LE(1, 20); datos.writeUInt16LE(2, 22);
  datos.writeUInt32LE(SR, 24); datos.writeUInt32LE(SR * 4, 28); datos.writeUInt16LE(4, 32); datos.writeUInt16LE(16, 34);
  datos.write("data", 36); datos.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const f = Math.min(1, (n - i) / (0.5 * SR)) * g;
    datos.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * f)) * 32767), 44 + i * 4);
    datos.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * f)) * 32767), 46 + i * 4);
  }
  return datos;
}
