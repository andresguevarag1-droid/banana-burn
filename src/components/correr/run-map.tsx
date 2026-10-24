// Mapa de una carrera sin librerías: teselas de OpenStreetMap y el recorrido en SVG encima.
// Cada tramo se dibuja aparte (las pausas y señales perdidas no se unen con una recta).
import type { Track } from "@/lib/runs";

const W = 512, H = 320, TILE = 256;
const wx = (lng: number, z: number) => ((lng + 180) / 360) * TILE * 2 ** z;
const wy = (lat: number, z: number) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z; };

export function RunMap({ track, here, className = "", label = "Mapa del recorrido" }: { track: Track; here?: { lat: number; lng: number } | null; className?: string; label?: string }) {
  const pts = track.flat();
  const all = here ? [...pts, here] : pts;
  if (!all.length) return <div className={`grid place-items-center rounded-2xl bg-paper text-sm text-muted aspect-[8/5] ${className}`}>El mapa aparece cuando haya señal de GPS.</div>;
  const lats = all.map((p) => p.lat), lngs = all.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  let z = here && pts.length < 2 ? 16 : 17;
  while (z > 3 && (wx(maxLng, z) - wx(minLng, z) > W - 48 || wy(minLat, z) - wy(maxLat, z) > H - 48)) z--;
  const cx = here ? wx(here.lng, z) : (wx(minLng, z) + wx(maxLng, z)) / 2;
  const cy = here ? wy(here.lat, z) : (wy(maxLat, z) + wy(minLat, z)) / 2;
  const ox = cx - W / 2, oy = cy - H / 2;
  const n = 2 ** z;
  const tiles: { x: number; y: number }[] = [];
  for (let tx = Math.floor(ox / TILE); tx <= Math.floor((ox + W) / TILE); tx++) for (let ty = Math.floor(oy / TILE); ty <= Math.floor((oy + H) / TILE); ty++) if (ty >= 0 && ty < n) tiles.push({ x: tx, y: ty });
  const P = (p: { lat: number; lng: number }) => `${(wx(p.lng, z) - ox).toFixed(1)},${(wy(p.lat, z) - oy).toFixed(1)}`;
  const first = pts[0], last = pts[pts.length - 1];
  return (
    <figure className={`relative overflow-hidden rounded-2xl bg-paper aspect-[8/5] ${className}`} aria-label={label} role="img">
      {tiles.map(({ x, y }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${x}-${y}`} alt="" loading="lazy" decoding="async" draggable={false} src={`https://tile.openstreetmap.org/${z}/${((x % n) + n) % n}/${y}.png`}
          className="absolute max-w-none select-none" style={{ left: `${((x * TILE - ox) / W) * 100}%`, top: `${((y * TILE - oy) / H) * 100}%`, width: `${(TILE / W) * 100}%`, height: `${(TILE / H) * 100}%` }} />
      ))}
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
        {track.map((seg, i) => seg.length > 1 && <polyline key={i} points={seg.map(P).join(" ")} fill="none" stroke="#C2410C" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />)}
        {first && !here && <circle cx={P(first).split(",")[0]} cy={P(first).split(",")[1]} r={6} fill="#17703A" stroke="#fff" strokeWidth={2} />}
        {last && !here && pts.length > 1 && <circle cx={P(last).split(",")[0]} cy={P(last).split(",")[1]} r={6} fill="#1A1A1A" stroke="#fff" strokeWidth={2} />}
        {here && <circle cx={W / 2} cy={H / 2} r={8} fill="#2563EB" stroke="#fff" strokeWidth={3} />}
      </svg>
      <figcaption className="absolute bottom-1 right-1 rounded bg-white/85 px-1.5 text-[10px] text-ink">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a></figcaption>
    </figure>
  );
}
