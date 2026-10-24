// Serie por tiempo fuera del modo exprés, como una secuencia de tramos: preparación, trabajo y, si el ejercicio va
// por lado, cambio de lado y segundo lado. Lógica pura (sin React ni navegador) para poder probarla.
//
// El valor que se anota sigue siendo el de un lado (35 s por lado se guarda como 35): los dos tiempos son la forma de
// hacer la serie, no el doble de trabajo registrado.

/** Pausa para cambiar de lado (darse vuelta en la colchoneta). */
export const SWITCH_SECONDS = 5;

export type SegKind = "prep" | "work" | "switch";
/** Un tramo de la serie. `side` marca el lado que se trabaja (o el que viene, en el cambio). */
export type Seg = { kind: SegKind; secs: number; side?: 1 | 2 };
/** Reloj de la serie: tramo actual, cuándo termina y, en pausa, cuánto le quedaba (ms). */
export type TimedRun = { segs: Seg[]; i: number; end: number; paused: number | null };

export const SIDE_LABEL = { 1: "Lado derecho", 2: "Lado izquierdo" } as const;

/** Tramos de una serie de `secs` segundos: [prep, trabajo] o, por lado, [prep, lado 1, cambio, lado 2]. */
export function timedSegments(secs: number, perSide: boolean, prep = 0): Seg[] {
  const s = Math.max(1, Math.round(secs));
  const out: Seg[] = prep > 0 ? [{ kind: "prep", secs: prep }] : [];
  if (!perSide) return [...out, { kind: "work", secs: s }];
  return [...out, { kind: "work", secs: s, side: 1 }, { kind: "switch", secs: SWITCH_SECONDS, side: 2 }, { kind: "work", secs: s, side: 2 }];
}

export const startTimed = (segs: Seg[], now: number): TimedRun => ({ segs, i: 0, end: now + segs[0].secs * 1000, paused: null });

/**
 * Avanza hasta `now` encadenando cada tramo desde el final exacto del anterior (si la pestaña estuvo oculta, se ponen
 * al día todos los tramos que pasaron). `entered`: índices de los tramos que empezaron; `finished`: terminó el último.
 */
export function advanceTimed(run: TimedRun, now: number): { run: TimedRun; entered: number[]; finished: boolean } {
  if (run.paused != null) return { run, entered: [], finished: false };
  let i = run.i, end = run.end;
  const entered: number[] = [];
  while (end <= now) {
    if (i >= run.segs.length - 1) return { run: { ...run, i, end }, entered, finished: true };
    i++;
    end += run.segs[i].secs * 1000;
    entered.push(i);
  }
  return { run: i === run.i ? run : { ...run, i, end }, entered, finished: false };
}

export const pauseTimed = (run: TimedRun, now: number): TimedRun => (run.paused != null ? run : { ...run, paused: Math.max(0, run.end - now) });
export const resumeTimed = (run: TimedRun, now: number): TimedRun => (run.paused == null ? run : { ...run, end: now + run.paused, paused: null });
/** Termina el tramo actual ya (también en pausa): el siguiente avance pasa al que sigue o cierra la serie. */
export const skipTimed = (run: TimedRun, now: number): TimedRun => ({ ...run, end: now, paused: null });

/** Lo que muestra la pantalla: tramo, segundos que quedan y barra (solo el trabajo la vacía). */
export function timedView(run: TimedRun, now: number) {
  const seg = run.segs[run.i];
  const left = run.paused != null ? run.paused / 1000 : Math.max(0, (run.end - now) / 1000);
  const frac = seg.kind === "work" ? Math.min(1, left / Math.max(1, seg.secs)) : 1;
  const perSide = run.segs.some((s) => s.side);
  /** Avance de cada lado (0 a 1) para dibujar dos barras: el primero se llena al terminarlo. */
  const sides: [number, number] | null = !perSide ? null
    : seg.kind === "prep" ? [0, 0]
    : seg.side === 1 && seg.kind === "work" ? [1 - frac, 0]
    : seg.kind === "switch" ? [1, 0]
    : [1, 1 - frac];
  return { seg, left, frac, perSide, sides, paused: run.paused != null, last: run.i === run.segs.length - 1 };
}

/** Nombre corto del tramo (pantalla y lector de pantalla). */
export function segLabel(s: Seg) {
  if (s.kind === "prep") return "Prepárate";
  if (s.kind === "switch") return "Cambia de lado";
  return s.side ? SIDE_LABEL[s.side] : "Trabaja";
}

/** Texto del botón de saltar según el tramo. */
export function skipLabel(s: Seg, last: boolean) {
  if (s.kind === "prep") return "Saltar la preparación";
  if (s.kind === "switch") return "Saltar el cambio de lado";
  return last ? "Terminar la serie" : "Terminar este lado";
}

/** Voz y aviso accesible al empezar un tramo de una serie por lado. Null si no hay nada que decir. */
export function segCue(s: Seg): { say: string; live: string } | null {
  if (s.kind === "switch") return { say: "Cambia de lado.", live: `Primer lado listo. Cambia de lado: ${s.secs} segundos` };
  if (s.kind === "work" && s.side) return { say: `${SIDE_LABEL[s.side]}. Ya.`, live: `${SIDE_LABEL[s.side]}: ${s.secs} segundos` };
  return null;
}
