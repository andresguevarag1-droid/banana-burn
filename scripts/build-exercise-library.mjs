// Construye src/data/exercise-library.json desde hasaneyldrm/exercises-dataset (datos MIT).
// Uso: node scripts/build-exercise-library.mjs <ruta/exercises.json> <ruta/names_es.json>
// NOTA: los GIF/imágenes son © Gym visual y NO se copian: solo guardamos el id de media para
// mostrarlos si Banana Burn obtiene su propia licencia (ver README → Biblioteca de ejercicios).
import fs from "node:fs";

const [src, namesPath] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(src, "utf8"));
const es = namesPath && fs.existsSync(namesPath) ? JSON.parse(fs.readFileSync(namesPath, "utf8")) : {};
const out = data.map((e) => ({
  id: e.id,
  n: es[e.id] || e.name,
  en: e.name,
  bp: e.body_part,
  eq: e.equipment,
  t: e.target,
  m2: (e.secondary_muscles || []).slice(0, 4),
  s: (e.instruction_steps?.es || []).filter((x) => !/^repite/i.test(x.trim())).slice(0, 6),
  media: e.media_id,
  gif: e.gif_url,
}));
fs.writeFileSync(new URL("../src/data/exercise-library.json", import.meta.url), JSON.stringify(out));
console.log(`${out.length} ejercicios, ${Object.keys(es).length} nombres en español`);
