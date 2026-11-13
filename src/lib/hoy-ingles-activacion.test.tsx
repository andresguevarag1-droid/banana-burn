// Hoy en inglés, camino de activación (#309): primeros pasos, resumen del lunes, lo mejor de Banana Burn, avisos e
// instalar. Estas tarjetas solo aparecen después de leer el dispositivo en un efecto, así que en el HTML del servidor no
// salen: aquí cada efecto corre una vez durante el render, con un iPhone en Safari de mentira.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { EN } from "@/lib/i18n/en";

vi.mock("react", async (orig) => {
  const R = await orig<typeof import("react")>();
  const useEffect = (fn: () => void | (() => void)) => { const done = R.useRef(false); if (!done.current) { done.current = true; fn(); } };
  return { ...R, default: { ...R, useEffect }, useEffect };
});
vi.mock("next/navigation", () => ({ usePathname: () => "/app", useRouter: () => ({ push() {}, refresh() {}, replace() {} }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/components/analytics", () => ({ FunnelTracker: () => null, track: () => {} }));
vi.mock("@/app/actions/learn", () => ({ markLearn: async () => ({ ok: true }) }));

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const store: Record<string, string> = {};

beforeAll(async () => {
  // Se importan antes de inventar el navegador (use-install registra eventos al cargar si hay window).
  await Promise.all([import("@/components/primeros-pasos/first-steps"), import("@/components/primeros-pasos/week-recap"), import("@/components/primeros-pasos/lo-mejor"),
    import("@/components/install/install-card"), import("@/components/install/install-helper"), import("@/components/notifications/enable-push")]);
  vi.stubGlobal("localStorage", { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } });
  vi.stubGlobal("sessionStorage", { getItem: () => null, setItem() {} });
  vi.stubGlobal("navigator", { userAgent: IPHONE, maxTouchPoints: 5 });
  vi.stubGlobal("window", { location: { href: "https://www.bananaburn.app/app", pathname: "/app" }, matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true });
}, 60_000);
afterAll(() => vi.unstubAllGlobals());

async function render(el: ReactElement, locale: "en-US" | "es-419" = "en-US") {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { LocaleProvider } = await import("@/lib/i18n/client");
  const html = renderToStaticMarkup(<LocaleProvider locale={locale} units={locale === "en-US" ? "imperial" : "metric"}>{el}</LocaleProvider>);
  return html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}

// Las frases del diccionario que cambian al traducirse (con más de una palabra, para no confundir "No" o "Normal").
const SPANISH = Object.entries(EN).filter(([es, en]) => es !== en && /\s/.test(es.trim()) && !/\{\w+\}/.test(es)).map(([es]) => es.replace(/[  ]/g, " ").trim());
const leftovers = (text: string) => SPANISH.filter((es) => text.replace(/[  ]/g, " ").includes(es));

const server = { keys: [] as string[], workouts: 1, weights: 1, coachMessages: 0, push: false };
const coach = { name: "Coach Banana", avatar: null };
const recap = async () => (await import("@/lib/week-recap")).recapFrom({ weekOf: "2026-11-02", workouts: 3, sets: 1240, planned: 4, heavier: ["Sentadilla goblet", "Remo"], heavierIds: ["goblet_squat", "db_row"], moreReps: 2 })!;

describe("camino de activación en inglés (#309)", () => {
  it("primeros pasos: título, pasos, el paso de instalar y el anillo", async () => {
    const { FirstSteps } = await import("@/components/primeros-pasos/first-steps");
    const text = await render(<FirstSteps server={server} coach={coach} />);
    for (const s of ["Your first steps", "1/6", "Do them in order.", "Do your first workout", "Look at your plan for the week", "See my week", "Ask Coach Banana something", "Install your LinkApp on your home screen", "First time training?"]) expect(text).toContain(s);
    expect(leftovers(text)).toEqual([]);
  });

  it("primeros pasos completos", async () => {
    const { FirstSteps } = await import("@/components/primeros-pasos/first-steps");
    const keys = ["pp-semana", "pp-tecnica", "pp-peso", "pp-coach", "pp-instalar"];
    const text = await render(<FirstSteps server={{ ...server, keys }} coach={coach} />);
    for (const s of ["You finished your first steps", "You know the essentials now.", "Learn to train", "Done, hide"]) expect(text).toContain(s);
    expect(leftovers(text)).toEqual([]);
  });

  it("resumen del lunes: números, titular y lo que cambia", async () => {
    const { WeekRecap } = await import("@/components/primeros-pasos/week-recap");
    const text = await render(<WeekRecap r={await recap()} />);
    for (const s of ["Your week with Banana Burn", "Good week. Every workout counts.", "3 of 4", "1,240", "sets logged", "consistency", "What changes in your plan", "it's time to go heavier on 2 exercises", "On 2 exercises you add one more rep per set."]) expect(text).toContain(s);
    expect(text).not.toMatch(/Sentadilla/);
    expect(leftovers(text)).toEqual([]);
  });

  it("lo mejor de Banana Burn", async () => {
    const { LoMejor } = await import("@/components/primeros-pasos/lo-mejor");
    const text = await render(<LoMejor serverKeys={["pp-oculto"]} />);
    for (const s of ["The best of Banana Burn", "Ask the coach", "Learn to train", "Seasons", "Run with GPS", "Challenges", "Banana Shield"]) expect(text).toContain(s);
    expect(leftovers(text)).toEqual([]);
  });

  it("instalar: la tarjeta de Hoy y sus pasos en iPhone", async () => {
    const { InstallCard } = await import("@/components/install/install-card");
    const { InstallHelper } = await import("@/components/install/install-helper");
    const card = await render(<InstallCard />);
    for (const s of ["Install your LinkApp on your phone", "(on iPhone they only arrive with the app installed)", "See how to install it"]) expect(card).toContain(s);
    const help = await render(<InstallHelper where="hoy" />);
    for (const s of ["Takes 10 seconds", "Tap Share in the bottom bar.", "Scroll down and choose Add to Home Screen", "Tap Add . Done: Banana Burn is now an app on your screen."]) expect(help).toContain(s);
    expect(leftovers(card + " " + help)).toEqual([]);
  });

  it("avisos: en iPhone sin instalar, los pasos para activarlos", async () => {
    const { EnablePush } = await import("@/components/notifications/enable-push");
    const text = await render(<EnablePush hideWhenSnoozed />);
    for (const s of ["Notifications on iPhone", "Open this page in Safari and tap", "Add to Home Screen", "I did it", "Not now"]) expect(text).toContain(s);
    expect(leftovers(text)).toEqual([]);
  });

  it("en español las mismas tarjetas no cambian", async () => {
    const { FirstSteps } = await import("@/components/primeros-pasos/first-steps");
    const { WeekRecap } = await import("@/components/primeros-pasos/week-recap");
    const { LoMejor } = await import("@/components/primeros-pasos/lo-mejor");
    const { InstallCard } = await import("@/components/install/install-card");
    const text = [await render(<FirstSteps server={server} coach={coach} />, "es-419"), await render(<WeekRecap r={await recap()} />, "es-419"), await render(<LoMejor serverKeys={["pp-oculto"]} />, "es-419"), await render(<InstallCard />, "es-419")].join(" ");
    for (const s of ["Tus primeros pasos", "Haz tu primer entrenamiento", "Pregúntale algo a Coach Banana", "Tu semana con Banana Burn", "3 de 4", "1,240", "Por lo que anotaste, te toca subir el peso en 2 ejercicios, como Sentadilla goblet.",
      "Lo mejor de Banana Burn", "Pregúntale al coach", "Instala tu LinkApp en el celular", "(en iPhone solo llegan con la app instalada)."]) expect(text).toContain(s);
    expect(text).not.toMatch(/Your first steps|The best of|Install your LinkApp/);
  });
});

