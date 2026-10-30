// Revisa R02 contra las reglas del issue #14 y del kit: textos, tiempos y archivos de salida.
// Uso: npm run verificar (después de npm run render). Sale con código 1 si algo falla.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AVISO, CORTES, ESCENAS, FPS, H, NUMEROS_PERMITIDOS, W } from "./escenas.mjs";

const SALIDA = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fallas = [];
const ok = (cond, msg) => { if (!cond) fallas.push(msg); };

// Textos
const PROHIBIDO = [
  /ozempic|wegovy|mounjaro|zepbound|saxenda|rybelsus|semaglut|tirzepat|liraglut/i,
  /usas glp/i, /tu tratamiento/i, /\bglp/i, /banano\b/i, /\bIA\b|inteligencia artificial/i,
  /[—·!]/, /\p{Extended_Pictographic}/u,
];
for (const [id, e] of Object.entries(ESCENAS)) {
  const todo = e.texto.join(" ");
  const palabras = todo.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p));
  ok(palabras.length <= 8, `${id}: ${palabras.length} palabras en pantalla (máximo 8)`);
  for (const re of PROHIBIDO) ok(!re.test(todo), `${id}: texto prohibido ${re}`);
  for (const n of todo.match(/\d+(?:\.\d+)?/g) ?? []) ok(NUMEROS_PERMITIDOS.includes(n), `${id}: número ${n} no está en el issue`);
}
ok(ESCENAS.aviso.texto.includes(AVISO) && AVISO === "No sustituye la indicación de tu médico.", "el aviso médico no es el exacto");

// Tiempos
for (const [corte, escenas] of Object.entries(CORTES)) {
  const total = escenas.reduce((s, [, d]) => s + d, 0);
  const meta = corte.endsWith("_15s") ? [15, 15] : [20, 25];
  ok(total >= meta[0] && total <= meta[1], `${corte}: dura ${total} s (debe ser ${meta.join(" a ")} s)`);
  ok(escenas[0][0] === "gancho", `${corte}: no empieza con el gancho`);
  const [ultima, dUlt] = escenas.at(-1);
  ok(ultima === "cierre" && dUlt === 3, `${corte}: el cierre debe ser la última escena y durar 3 s`);
  for (const [id, d] of escenas.slice(0, -1)) ok(d >= 1.5 && d <= 2.5, `${corte}: ${id} dura ${d} s (cambio visual cada 1.5 a 2.5 s)`);
  const aviso = escenas.filter(([id]) => ESCENAS[id].aviso).reduce((s, [, d]) => s + d, 0);
  ok(aviso >= 2, `${corte}: el aviso médico se ve ${aviso} s (mínimo 2 s)`);
}

// Archivos
const ffmpeg = process.env.FFMPEG ?? (await import("@ffmpeg-installer/ffmpeg").then((m) => m.default.path).catch(() => "ffmpeg"));
function info(archivo) {
  try { execFileSync(ffmpeg, ["-hide_banner", "-i", archivo], { stdio: "pipe" }); } catch (e) { return String(e.stderr); }
  return "";
}
for (const [corte, escenas] of Object.entries(CORTES)) {
  const i = info(resolve(SALIDA, `${corte}.mp4`));
  const total = escenas.reduce((s, [, d]) => s + d, 0);
  ok(/Video: h264/.test(i), `${corte}.mp4: no es H.264`);
  ok(i.includes(`${W}x${H}`), `${corte}.mp4: no es ${W}x${H}`);
  ok(new RegExp(`\\b${FPS} fps`).test(i), `${corte}.mp4: no es ${FPS} fps`);
  ok(!/Audio:/.test(i), `${corte}.mp4: trae audio`);
  const [, hh, mm, ss] = i.match(/Duration: (\d+):(\d+):([\d.]+)/) ?? [];
  ok(Math.abs(+hh * 3600 + +mm * 60 + +ss - total) < 0.05, `${corte}.mp4: la duración no coincide con el guion`);
  console.log(`${corte}.mp4: ${(i.match(/Video: [^\n]*/) ?? ["?"])[0]}`);
}
const png = readFileSync(resolve(SALIDA, "R02_musculo-glp1_portada.png"));
ok(png.readUInt32BE(16) === W && png.readUInt32BE(20) === H, `portada: no es ${W}x${H}`);

if (fallas.length) { console.error(fallas.map((f) => `FALLA ${f}`).join("\n")); process.exit(1); }
console.log("Todo en regla.");
