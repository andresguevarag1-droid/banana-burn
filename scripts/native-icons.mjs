// Imágenes fuente del ícono y del splash de la app nativa, desde el logo oficial (public/icons/logo.svg: la llama con la
// banana adentro, amarilla sobre ink). Escribe assets/*.png; después `npm run native:assets` genera todos los tamaños
// de iOS y Android con @capacitor/assets.
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "assets");
mkdirSync(out, { recursive: true });

const INK = "#1B1505";
const svg = readFileSync(join(root, "public", "icons", "logo.svg"), "utf8");
const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)?.[0];
// Todo lo que va después del fondo redondeado: la llama y la banana.
const mark = svg.replace(/^[\s\S]*?<rect[^>]*\/>/, "").replace(/<\/svg>\s*$/, "");
if (!defs || !mark.includes("<path")) throw new Error("No reconozco public/icons/logo.svg");

// Centro y alto de la llama en las coordenadas del logo (viewBox 512).
const CX = 256, CY = 260, H = 384;

/** Lienzo cuadrado `size` con la llama centrada de `markH` px de alto. Fondo ink o transparente. */
function scene(size, markH, background) {
  const k = markH / H;
  const tx = size / 2 - CX * k, ty = size / 2 - CY * k;
  const bg = background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : "";
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${defs}${bg}<g transform="translate(${tx} ${ty}) scale(${k})">${mark}</g></svg>`);
}

const png = (buf, name) => sharp(buf).png().toFile(join(out, name));

await Promise.all([
  // iOS y tiendas: cuadrado sin esquinas (el sistema las redondea), la llama del mismo tamaño que en el logo.
  png(scene(1024, 768, INK), "icon-only.png"),
  // Android adaptativo: @capacitor/assets ya recorta el margen de la capa (inset 16.7 %), así que este lienzo es lo
  // visible; la llama queda dentro del círculo seguro para que ninguna máscara (círculo, gota, cuadrado) la corte.
  png(scene(1024, 660, null), "icon-foreground.png"),
  png(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${INK}"/></svg>`), "icon-background.png"),
  // Splash: la llama al centro sobre ink (claro y oscuro iguales: la marca no cambia).
  png(scene(2732, 620, INK), "splash.png"),
  png(scene(2732, 620, INK), "splash-dark.png"),
]);
console.log("assets/: icon-only, icon-foreground, icon-background, splash, splash-dark");
