import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/workout/workout.module.css", () => ({ default: new Proxy({}, { get: (_, k) => String(k) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => "/app/entreno",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/analytics", () => ({ track: vi.fn(), trackOnce: vi.fn(), FunnelTracker: () => null }));
vi.mock("@/app/actions/notifications", () => ({ saveNotificationPrefs: vi.fn() }));
vi.mock("@/app/(app)/app/entreno/testimonial-action", () => ({ sendTestimonial: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/components/confetti", () => ({ Confetti: () => null }));

const { LocaleProvider } = await import("@/lib/i18n/client");
const { Recap } = await import("./recap");
const { OfferCard, ExitOfferCard } = await import("./first-workout-offer");
const { FirstSetCardLine } = await import("./first-set-card-ask");
const { langOf } = await import("./lang");
const { progressLine, dayList } = await import("@/lib/meta-semanal");
const { nextTimeLine } = await import("@/lib/primeros-pasos");
const { LEVELS } = await import("@/lib/gamify");
const { LEVEL_NAMES } = await import("@/lib/i18n/en/workout-recap");

const L = langOf("en-US", "imperial");
const en = (node: React.ReactNode) => renderToStaticMarkup(<LocaleProvider locale="en-US" units="imperial">{node}</LocaleProvider>);
/** Solo el texto visible y las etiquetas para lectores de pantalla (sin clases ni atributos técnicos). */
const visible = (html: string) => [...html.matchAll(/>([^<]+)</g), ...html.matchAll(/(?:aria-label|alt|title)="([^"]*)"/g)].map((m) => m[1]).join(" | ");

const props = {
  title: "Steel legs and firm chest", icon: "barbell", xpBefore: 250, xp: 120, rushed: false, streak: 4, seconds: 2710, done: 12, total: 12,
  volume: 1250, perWorkout: 150, prs: ["Back squat"], bananas: { got: 4, total: 4 }, saveMsg: null, feedback: "Solid session. Your squat moved well today.",
  testimonial: true,
  progress: [
    { name: "Back squat", ...progressLine([{ kg: 60, reps: 8 }], [{ kg: 62.5, reps: 8 }], undefined, L)! },
    { name: "Push-ups", ...progressLine([{ kg: null, reps: 10 }], [{ kg: null, reps: 12 }], undefined, L)! },
  ],
  next: [
    { name: "Back squat", line: nextTimeLine({ type: "up", kg: 65, reps: [8] }, 6, L)! },
    { name: "Bench press", line: nextTimeLine({ type: "reps", kg: 40, reps: [9] }, 6, L)! },
  ],
  week: { count: 2, goal: 3, week: "esta" as const, days: dayList([4], "en-US"), n: 1, remind: true },
};

describe("Recap en inglés y libras (#300)", () => {
  const html = en(<Recap {...props} />);

  it("se ve igual que siempre", () => expect(html).toMatchSnapshot());

  it("pesos y volumen en lb, nada en kg", () => {
    expect(html).toContain("2,756 lb");
    expect(html).toContain("Last time: 132.5 lb × 8. Today: 137.5 lb × 8.");
    expect(html).toContain("Last time: 10 reps. Today: 12 reps.");
    expect(html).toContain("Go up to 142.5 lb and drop back to 6 reps.");
    expect(html).not.toMatch(/\bkg\b/);
  });

  it("todo el texto en inglés", () => {
    for (const s of ["You reached Ripening Banana", "Leveling up to Ripening Banana", "you reach Ripe Banana in about 3 workouts", "Today&#x27;s bananas", "day streak", "XP earned", "Since last time", "What changes next time", "Personal record",
      "This week: 2 of 3 workouts", "Your next workout", "Thursday", "Remind me that day", "How&#x27;s it going with Banana Burn?", "Send review", "Share", "Done", "Ripening Banana"]) expect(html).toContain(s);
    const text = visible(html);
    for (const s of ["Entreno", "entreno", "series", "racha", "Bananas del día", "Desde la vez", "Compartir", "Listo", "nivel", "Hoy", "semana", "Recuérdame", "repeticiones", "opinión"]) expect(text).not.toContain(s);
  });

  it("sesión parcial con intervalos", () => {
    const h = en(<Recap {...props} xpBefore={400} xp={0} done={8} total={12} unit="intervalos" repeat volume={0} prs={[]} testimonial={false} />);
    for (const s of ["Workout saved", "Partial session: 8 of 12 intervals. It still counts toward your streak.", "intervals", "XP (repeat)", "Ripening Banana", "(level 2)", "You already did this workout today"]) expect(h).toContain(s);
  });

  it("cada nivel tiene su nombre en inglés", () => {
    for (const lv of LEVELS as { n: string; nf?: string }[]) for (const n of [lv.n, lv.nf].filter(Boolean) as string[]) expect(LEVEL_NAMES[n], n).toBeTruthy();
  });

  it("las ofertas del cierre y la tarjeta tras la primera serie, en inglés con precios en USD", () => {
    const offer = en(<OfferCard billing="anual" onBilling={() => {}} onDismiss={() => {}} />);
    for (const s of ["You finished your first workout", "Keep going with your plan", "Training. Prices in USD, tax included.", "Yearly", "$59.99/yr", "Save $59.89 a year", "Monthly", "Start my plan", "Not now"]) expect(offer).toContain(s);
    const exit = en(<ExitOfferCard onDismiss={() => {}} />);
    for (const s of ["Before you go: 50", "Training: your first month at", "Add my card", "No, thanks"]) expect(exit).toContain(s);
    const line = en(<FirstSetCardLine onOpen={() => {}} onClose={() => {}} />);
    for (const s of ["Your first month at", "if you add your card today. Nothing is charged today.", 'aria-label="Close"']) expect(line).toContain(s);
    for (const h of [offer, exit, line]) expect(visible(h)).not.toMatch(/tarjeta|Ahora no|mes|año/);
  });
});
