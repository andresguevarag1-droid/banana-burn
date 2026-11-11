// Une la voz de cada corte (VOZ en escenas.mjs) al MP4 ya renderizado, con un "whoosh" suave en cada cambio de escena.
// La voz suena de corrido desde el cuadro 0; los tiempos de las escenas (CORTES) ya están medidos sobre ella.
// Todas las pistas duran lo mismo que el video, así amix no cambia el volumen (sirve con el ffmpeg 4 del instalador).
// Uso: node audio.mjs (después de node render.mjs). La música se agrega al publicar, desde la biblioteca de Meta.
import { spawnSync } from "node:child_process";
import { renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CORTES, VOZ } from "./escenas.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = resolve(AQUI, "..");
const ffmpeg = process.env.FFMPEG ?? (await import("@ffmpeg-installer/ffmpeg").then((m) => m.default.path).catch(() => "ffmpeg"));

/** Segundos en que cambia la escena. */
export const cambios = (corte) => { let t = 0; return CORTES[corte].slice(0, -1).map(([, d]) => (t += d)); };
export const duracion = (corte) => CORTES[corte].reduce((s, [, d]) => s + d, 0);

function audio(corte) {
  const mp4 = resolve(SALIDA, `${corte}.mp4`), tmp = resolve(SALIDA, `${corte}.tmp.mp4`), total = duracion(corte);
  const filtros = [`[0:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad,atrim=0:${total}[voz]`];
  const cs = cambios(corte);
  cs.forEach((c, i) => {
    const ms = Math.max(0, Math.round((c - 0.16) * 1000));
    filtros.push(`anoisesrc=color=pink:d=0.26:a=0.5:r=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,highpass=f=1200,lowpass=f=8000,afade=t=in:d=0.16,afade=t=out:st=0.16:d=0.1,volume=0.07,adelay=${ms}|${ms},apad,atrim=0:${total}[w${i}]`);
  });
  filtros.push(`[voz]${cs.map((_, i) => `[w${i}]`).join("")}amix=inputs=${cs.length + 1}:duration=first,volume=${cs.length + 1},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a]`);
  const r = spawnSync(ffmpeg, ["-y", "-loglevel", "error", "-i", resolve(SALIDA, VOZ[corte]), "-i", mp4, "-filter_complex", filtros.join(";"),
    "-map", "1:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", String(total), "-movflags", "+faststart", tmp], { stdio: "inherit" });
  if (r.status) throw new Error(`ffmpeg salió con ${r.status}`);
  renameSync(tmp, mp4);
  console.log(`${corte}.mp4: voz ${VOZ[corte]} y ${cs.length} whooshes`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) for (const corte of Object.keys(CORTES)) audio(corte);
