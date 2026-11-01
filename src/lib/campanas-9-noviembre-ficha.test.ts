// La ficha de lanzamiento del 9 de noviembre (docs/metas/campanas-9-noviembre-ficha.md) configura la campaña de
// campana-conversion-noviembre.md: estas pruebas vigilan que el evento, el píxel, los nombres, los textos y el dinero
// cuadren con el código y los documentos, y que nada quede activado ni con IDs inventados.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { usd2 as usd } from "@/lib/num";
import { pixelIdFrom, toMetaEvent } from "@/lib/meta-pixel";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { promoPrice } from "@/lib/trial";

const doc = readFileSync("docs/metas/campanas-9-noviembre-ficha.md", "utf8");
const propuesta = readFileSync("docs/metas/campana-conversion-noviembre.md", "utf8");
const metaAds = readFileSync("marketing/estrategia/meta-ads-noviembre.md", "utf8");

function section(title: string): string {
  const start = doc.indexOf(title);
  expect(start, `falta la sección ${title}`).toBeGreaterThanOrEqual(0);
  const next = doc.indexOf("\n## ", start + title.length);
  return doc.slice(start, next === -1 ? undefined : next);
}
const ONVO = { c: 0.039, f: 0.35 };
const TILOPAY = { c: 0.0425, f: 0.35 };
const netoRaw = (cobro: number, k: { c: number; f: number }) => cobro / 1.13 - (cobro * k.c + k.f);
const neto = (cobro: number, k: { c: number; f: number }) => Math.round(netoRaw(cobro, k) * 100) / 100;
const price = (id: string) => PLANS.find((p) => p.id === id)!.price;

describe("evento y píxel", () => {
  it("la prueba iniciada es CompleteRegistration con status trial, como en meta-pixel.ts", () => {
    expect(toMetaEvent("onboarding_done", { trial: true })).toEqual({ name: "CompleteRegistration", params: { status: "trial" } });
    expect(TRIAL_DAYS).toBe(7);
    expect(readFileSync("src/app/bienvenida/wizard.tsx", "utf8")).toContain('view="onboarding_done"');
    expect(section("## 2. Objetivo y evento")).toContain("**`CompleteRegistration`** (prueba iniciada)");
  });

  it("usa el píxel que está en el código", () => {
    const id = pixelIdFrom({});
    expect(id).toBe("1544502257509303");
    expect(doc).toContain(`dataset \`${id}\``);
  });
});

describe("campaña, conjuntos y anuncios", () => {
  it("los nombres son los de la propuesta", () => {
    expect(propuesta).toContain("`BB Conv Nov26` (campaña), `BB Conv Nov26 CR` y `BB Conv Nov26 CO` (conjuntos)");
    for (const n of ["`BB Conv Nov26`", "`BB Conv Nov26 CR`", "`BB Conv Nov26 CO`"]) expect(doc).toContain(n);
    for (const pais of ["CR", "CO"])
      for (const a of ["Cuanto peso", "CP2 11s", "CP3 11s", "CP4 11s"]) expect(doc).toContain(`\`BB Conv Nov26 ${pais} ${a}\``);
  });

  it("solo Instagram y Facebook, en celular", () => {
    const s = section("## 3. Campaña y conjuntos");
    expect(s).toContain("Plataformas: solo Instagram y Facebook.");
    expect(s).toContain("**Dispositivos: solo celulares**");
    expect(s).toContain("Fuera: Audience Network, Messenger, Threads");
  });

  it("los IDs de públicos no se inventan: plan-ads-octubre-2026.md no existe", () => {
    expect(existsSync("marketing/plan-ads-octubre-2026.md")).toBe(false);
    const s = section("### 3.2 Públicos que se excluyen");
    expect(s.match(/\| por confirmar en Ads Manager/g)?.length).toBe(3);
    expect(s).not.toMatch(/\b\d{13,20}\b/);
    expect(metaAds).toContain("| BB registrados | Píxel: `CompleteRegistration` | 180 días |");
    expect(metaAds).toContain("| BB suscriptores | Píxel: `Subscribe` | 180 días |");
  });

  it("CP2 a CP4 no se cargan antes de tener MP4 y aprobación", () => {
    for (const slug of ["CP2_otra-persona-condominio", "CP3_con-cuanto-empiezo", "CP4_peso-en-pantalla"]) {
      expect(existsSync(`marketing/videos/${slug}/${slug}_11s.mp4`)).toBe(false);
      expect(doc).toContain(`\`${slug}_11s.mp4\` | Pendiente de render y aprobación`);
    }
  });

  it("el texto del anuncio es el aprobado para principiantes", () => {
    const t = "Si no sabes cuánto peso usar, empieza aquí. Rutina a tu nivel y técnica de cada ejercicio. 7 días gratis, sin tarjeta.";
    expect(metaAds).toContain(t);
    expect(doc).toContain(`Texto principal: "${t}"`);
  });

  it("las URLs de Cuánto peso son las del anuncio A de la propuesta", () => {
    for (const c of ["cr-conv-a-15s", "co-conv-a-15s"]) {
      const url = `https://www.bananaburn.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=bb-conv-nov26&utm_content=${c}`;
      expect(propuesta).toContain(url);
      expect(doc).toContain(url);
    }
  });
});

describe("presupuesto y dinero", () => {
  const s = section("## 5. Presupuesto según la regla");
  const rows = s.split("\n").filter((l) => /^\| [123] \|/.test(l)).map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));

  it("los niveles son la mitad por país de los de la propuesta y caben en el tope de $70.00", () => {
    expect(rows).toHaveLength(3);
    const minCR = neto(promoPrice("entreno"), ONVO);
    const minCO = neto(promoPrice("entreno"), TILOPAY);
    expect([usd(minCR), usd(minCO)]).toEqual(["$3.87", "$3.85"]);
    for (const [nivel, diaCR, diaCO, semCR, semCO, total, pagosCR, pagosCO] of rows) {
      const d = Number(diaCR.slice(1));
      expect(diaCO).toBe(diaCR);
      expect(semCR).toBe(usd(d * 7));
      expect(semCO).toBe(usd(d * 7));
      expect(total).toBe(usd(d * 14));
      expect(d * 14).toBeLessThanOrEqual(70);
      expect(propuesta).toMatch(new RegExp(`\\| ${nivel} \\| \\$${(d * 2).toFixed(2)} \\| \\$${d.toFixed(2)} \\| \\$${d.toFixed(2)} \\|`));
      expect(Number(pagosCR)).toBe(Math.ceil((d * 7) / minCR));
      expect(Number(pagosCO)).toBe(Math.ceil((d * 7) / minCO));
    }
  });

  it("los pagos con Entreno + Nutrición con 50 % son 3, 5 o 6 por conjunto", () => {
    const cr = rows.map(([, d]) => Math.ceil((Number(d.slice(1)) * 7) / neto(promoPrice("completo"), ONVO)));
    const co = rows.map(([, d]) => Math.ceil((Number(d.slice(1)) * 7) / neto(promoPrice("completo"), TILOPAY)));
    expect(cr).toEqual(co);
    expect(s).toContain(`hacen falta ${cr.slice(0, 2).join(", ")} o ${cr[2]} pagos por conjunto`);
  });

  it("la tabla de netos sale de plans.ts y trial.ts", () => {
    const cobros = [promoPrice("entreno"), promoPrice("completo"), price("entreno").mes, price("completo").mes, price("entreno").anual, price("completo").anual];
    const s8 = section("## 8. Qué paso del embudo mueve");
    for (const c of cobros) expect(s8).toContain(`| ${usd(c)} | ${usd(neto(c, ONVO))} | ${usd(neto(c, TILOPAY))} |`);
  });

  it("los umbrales de pausa son 35.2 % del caso más exigente y su doble", () => {
    const porPrueba = (n: number) => Math.floor(Math.round(n * 100) * 352 / 1000) / 100;
    const cr = porPrueba(neto(promoPrice("entreno"), ONVO));
    const co = porPrueba(neto(promoPrice("entreno"), TILOPAY));
    expect(doc).toContain(`**${usd(cr)} en Costa Rica y ${usd(co)} en Colombia**`);
    expect(doc).toContain(`**${usd(cr * 2)} en Costa Rica** o **${usd(co * 2)} en Colombia**`);
    expect(propuesta).toContain(`si pasa de ${usd(cr * 2)}`);
  });
});

describe("reglas de la oficina", () => {
  it("nada se crea ni se activa y lo no verificable queda por confirmar", () => {
    expect(doc).toContain("**nada se crea ni se activa en Meta**");
    expect(doc).toContain("**En pausa**");
    expect(doc).toContain('**"por confirmar en Ads Manager"**');
    expect(doc).toContain("Solo él lo enciende.");
  });

  it("lee cada país por separado el lunes 16 con la semana del 9", () => {
    const s = section("## 7. Cómo leer cada país el lunes 16 de noviembre");
    expect(new Date("2026-11-16T12:00:00Z").getUTCDay()).toBe(1);
    expect(s).toContain("`lunes` = `date '2026-11-09'`");
    expect(s).toContain("`pagos_nuevos` del subtotal `onvo`");
    expect(s).toContain("`pagos_nuevos` del subtotal `tilopay`");
  });

  it("marca: sin emojis, sin guiones largos, sin mencionar IA, GLP-1 con su aviso", () => {
    expect(doc).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(doc).not.toContain("—");
    expect(doc).not.toMatch(/\bIA\b|inteligencia artificial/i);
    expect(doc).not.toMatch(/banano\b/i);
    if (/GLP-1/.test(doc)) expect(doc).toContain("No sustituye la indicación de tu médico.");
  });
});
