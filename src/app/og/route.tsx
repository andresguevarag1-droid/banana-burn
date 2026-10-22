import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_3KlOTMXim7g88SAyF4A03SG6JZ6/";
/** Escenas UGC ilustrativas (persona real + Coach Banana) para cada página. */
const SCENES: Record<string, string> = {
  gym: "hf_20261022_153719_0be6b29d-ae57-4937-a122-798fdf72baa4",
  casa: "hf_20261022_155001_e82f1d0e-5f20-4eba-9039-6f62a9d79152",
  cocina: "hf_20261022_155041_f2cc4028-cb3a-48a8-ade4-3d6edcbbf98f",
  edad: "hf_20261022_155042_171fc15e-6a39-489f-a615-de397a0bcec2",
  record: "hf_20261022_155003_11f3b250-6cbe-4354-ab64-49e1d65832ec",
};

const clip = (s: string | null, max: number, fallback: string) => (s ? s.replace(/\s+/g, " ").trim().slice(0, max) : fallback);

/** Trae una imagen como data URL; si no responde a tiempo, devuelve null (la tarjeta se arma igual). */
async function dataUrl(url: string, type: string, ms = 2500): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms), cache: "force-cache" });
    if (!r.ok) return null;
    return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Imagen para compartir (Open Graph) de cada página pública: marca nueva, titular y una escena UGC del mono.
 * /og?t=Titular&s=Subtítulo&v=gym|casa|cocina|edad|record
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = clip(searchParams.get("t"), 90, "Baja grasa sin perder músculo");
  const sub = clip(searchParams.get("s"), 120, "Tu entrenador personal con IA, en español y para toda Latinoamérica.");
  const scene = SCENES[searchParams.get("v") ?? "gym"] ?? SCENES.gym;
  const dir = join(process.cwd(), "src/app/og");
  const pub = join(process.cwd(), "public");
  const [f800, f600, logo, mascot, photo] = await Promise.all([
    readFile(join(dir, "jakarta-800.woff")),
    readFile(join(dir, "jakarta-600.woff")),
    readFile(join(pub, "icons/logo.svg"), "utf8"),
    readFile(join(pub, "brand/mascota.jpg")),
    dataUrl(`${CDN}${scene}.png`, "image/png"),
  ]);
  const logoUrl = `data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`;
  const mascotUrl = `data:image/jpeg;base64,${mascot.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#FFD60A", fontFamily: "Jakarta", color: "#1B1505" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 0 56px 64px", width: 700 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} width={64} height={64} alt="" />
            <div style={{ display: "flex", fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>Banana<span style={{ color: "#C2410C" }}>Burn</span></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: title.length > 48 ? 54 : 64, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2 }}>{title}</div>
            <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.3, color: "rgba(27,21,5,.78)" }}>{sub}</div>
          </div>
          <div style={{ display: "flex", alignSelf: "flex-start", background: "#1B1505", color: "#FFD60A", borderRadius: 999, padding: "14px 26px", fontSize: 26, fontWeight: 800 }}>
            Prueba gratis 7 días, sin tarjeta
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", position: "relative" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} width={392} height={490} alt="" style={{ borderRadius: 36, objectFit: "cover", border: "8px solid #1B1505", transform: "rotate(3deg)" }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mascotUrl} width={460} height={460} alt="" style={{ borderRadius: 48 }} />
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Jakarta", data: f800, weight: 800, style: "normal" },
        { name: "Jakarta", data: f600, weight: 600, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400" },
    },
  );
}
