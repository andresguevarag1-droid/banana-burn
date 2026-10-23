import { describe, expect, it } from "vitest";
import { cronModeFrom, tzLabel, DEFAULT_PREFS, MAX_PUSHES_PER_DAY, copyFor, liftFact, liftLine, decide, inQuietHours, isRelevantHour, localClock, type DecideInput, type Prefs } from "./notify";

// Costa Rica = UTC−6 todo el año. 2026-10-19 es lunes, 2026-10-21 miércoles.
const cr = (isoDay: string, hour: number, minute = 0) => new Date(Date.UTC(+isoDay.slice(0, 4), +isoDay.slice(5, 7) - 1, +isoDay.slice(8, 10), hour + 6, minute));
const WED = "2026-10-21", MON = "2026-10-19";

const base = (over: Partial<DecideInput> = {}, prefs: Partial<Prefs> = {}): DecideInput => ({
  now: cr(WED, 7), prefs: { ...DEFAULT_PREFS, ...prefs }, mode: "hourly",
  trainingDay: true, trainedToday: false, activeToday: false, streak: 0, daysInactive: 1,
  sentToday: [], pushesToday: 0, hasPushSubscription: true, hasEmail: true, ...over,
});
const kinds = (i: DecideInput) => decide(i).map((d) => d.kind);

describe("hora local", () => {
  it("convierte UTC a Costa Rica", () => {
    expect(localClock(new Date("2026-10-21T13:30:00Z"), "America/Costa_Rica")).toEqual({ iso: "2026-10-21", hour: 7, minute: 30, dow: 3 });
  });
  it("cambia de día local antes que UTC", () => {
    expect(localClock(new Date("2026-10-22T03:00:00Z"), "America/Costa_Rica").iso).toBe("2026-10-21");
  });
  it("respeta otras zonas y cae a CR si la zona es inválida", () => {
    expect(localClock(new Date("2026-10-21T13:00:00Z"), "America/Mexico_City").hour).toBe(7);
    expect(localClock(new Date("2026-10-21T13:00:00Z"), "America/Bogota").hour).toBe(8);
    expect(localClock(new Date("2026-10-21T13:00:00Z"), "Marte/Olympus").hour).toBe(7);
  });
});

describe("horas de silencio", () => {
  it("intervalo que cruza medianoche", () => {
    expect(inQuietHours({ hour: 23, minute: 0 }, "22:00", "07:00")).toBe(true);
    expect(inQuietHours({ hour: 3, minute: 0 }, "22:00", "07:00")).toBe(true);
    expect(inQuietHours({ hour: 7, minute: 0 }, "22:00", "07:00")).toBe(false);
    expect(inQuietHours({ hour: 21, minute: 59 }, "22:00", "07:00")).toBe(false);
  });
  it("intervalo dentro del día y desactivado", () => {
    expect(inQuietHours({ hour: 13, minute: 0 }, "12:00", "14:00")).toBe(true);
    expect(inQuietHours({ hour: 14, minute: 0 }, "12:00", "14:00")).toBe(false);
    expect(inQuietHours({ hour: 3, minute: 0 }, null, null)).toBe(false);
  });
  it("silencio bloquea el push pero no el correo ni in-app", () => {
    const [d] = decide(base({ now: cr(WED, 6) }, { reminder_time: "06:00", quiet_start: "22:00", quiet_end: "07:00" }));
    expect(d).toEqual({ kind: "recordatorio", push: false, email: true, inapp: true });
  });
  it("racha a las 20:00 sin push si el silencio empieza a las 20:00", () => {
    const [d] = decide(base({ now: cr(WED, 20), streak: 4 }, { quiet_start: "20:00", quiet_end: "06:00" }));
    expect(d.kind).toBe("racha");
    expect(d.push).toBe(false);
  });
});

describe("recordatorio de entreno", () => {
  it("a la hora elegida, día de entreno y sin entrenar -> push + correo", () => {
    expect(decide(base())).toEqual([{ kind: "recordatorio", push: true, email: true, inapp: true }]);
  });
  it("usa solo la hora del reminder_time (cron horario)", () => {
    expect(kinds(base({ now: cr(WED, 17, 0) }, { reminder_time: "17:45" }))).toEqual(["recordatorio"]);
    expect(kinds(base({ now: cr(WED, 16) }, { reminder_time: "17:00" }))).toEqual([]);
  });
  it("no se manda si ya entrenó, si es descanso o si ya se mandó hoy", () => {
    expect(kinds(base({ trainedToday: true, activeToday: true }))).toEqual([]);
    expect(kinds(base({ trainingDay: false }))).toEqual([]);
    expect(kinds(base({ sentToday: ["recordatorio"] }))).toEqual([]);
  });
  it("respeta preferencias por canal", () => {
    expect(decide(base({}, { push_reminders: false }))[0]).toMatchObject({ push: false, email: true });
    expect(decide(base({}, { email_reminders: false }))[0]).toMatchObject({ push: true, email: false });
    expect(decide(base({ hasPushSubscription: false }))[0]).toMatchObject({ push: false });
    expect(decide(base({ hasEmail: false }))[0]).toMatchObject({ email: false, inapp: true });
  });
  it("respeta la zona horaria del usuario", () => {
    // 07:00 en CDMX = 13:00Z; para alguien en Bogotá (UTC−5) son las 08:00 -> no toca.
    expect(kinds(base({ now: new Date("2026-10-21T13:00:00Z") }, { timezone: "America/Mexico_City" }))).toEqual(["recordatorio"]);
    expect(kinds(base({ now: new Date("2026-10-21T13:00:00Z") }, { timezone: "America/Bogota" }))).toEqual([]);
  });
});

describe("racha en peligro (20:00)", () => {
  it("sin actividad hoy y racha ≥ 2", () => {
    expect(kinds(base({ now: cr(WED, 20), streak: 2 }))).toEqual(["racha"]);
  });
  it("no con racha < 2, con actividad hoy, ni a otra hora", () => {
    expect(kinds(base({ now: cr(WED, 20), streak: 1 }))).toEqual([]);
    expect(kinds(base({ now: cr(WED, 20), streak: 5, activeToday: true }))).toEqual([]);
    expect(kinds(base({ now: cr(WED, 19), streak: 5 }))).toEqual([]);
  });
  it("se manda también en días de descanso (el check-in mantiene la racha)", () => {
    expect(kinds(base({ now: cr(WED, 20), streak: 3, trainingDay: false }))).toEqual(["racha"]);
  });
  it("en modo diario (Vercel Hobby) se omite", () => {
    expect(kinds(base({ now: cr(WED, 20), streak: 5, mode: "daily", trainingDay: false }))).toEqual([]);
  });
});

describe("resumen semanal (lunes 07:00)", () => {
  it("lunes 07:00 -> resumen por correo + recordatorio solo push (un solo correo)", () => {
    const ds = decide(base({ now: cr(MON, 7) }));
    expect(ds.map((d) => d.kind)).toEqual(["semanal", "recordatorio"]);
    expect(ds[0]).toMatchObject({ push: false, email: true });
    expect(ds[1]).toMatchObject({ push: true, email: false });
  });
  it("respeta weekly_summary y no sale otro día u hora", () => {
    expect(kinds(base({ now: cr(MON, 7), trainingDay: false }, { weekly_summary: false }))).toEqual([]);
    expect(kinds(base({ now: cr(WED, 7), trainingDay: false }))).toEqual([]);
    expect(kinds(base({ now: cr(MON, 8), trainingDay: false }, { reminder_time: "09:00" }))).toEqual([]);
  });
});

describe("reactivación", () => {
  it("3 y 7 días sin actividad, a la hora del recordatorio; reemplaza al recordatorio", () => {
    expect(kinds(base({ daysInactive: 3 }))).toEqual(["reactivacion_3"]);
    expect(kinds(base({ daysInactive: 7, trainingDay: false }))).toEqual(["reactivacion_7"]);
  });
  it("no en otros días de inactividad", () => {
    expect(kinds(base({ daysInactive: 4 }))).toEqual(["recordatorio"]);
    expect(kinds(base({ daysInactive: 5, trainingDay: false }))).toEqual([]);
    expect(kinds(base({ daysInactive: null, trainingDay: false }))).toEqual([]);
  });
});

describe("tope de pushes", () => {
  it(`máximo ${MAX_PUSHES_PER_DAY} pushes por día`, () => {
    expect(decide(base({ pushesToday: MAX_PUSHES_PER_DAY }))[0]).toMatchObject({ kind: "recordatorio", push: false, email: true });
    expect(decide(base({ pushesToday: 1 }))[0]).toMatchObject({ push: true });
  });
  it("recordatorio (mañana) + racha (noche) = 2; un tercero ya no lleva push", () => {
    // Usuario con recordatorio a las 20:00: ese mismo run decide recordatorio y racha.
    const ds = decide(base({ now: cr(WED, 20), streak: 3, pushesToday: 1 }, { reminder_time: "20:00" }));
    expect(ds.map((d) => [d.kind, d.push])).toEqual([["recordatorio", true], ["racha", false]]);
  });
});

describe("modo diario (Hobby)", () => {
  it("manda recordatorio sin importar la hora y el semanal el lunes", () => {
    expect(kinds(base({ now: cr(WED, 13), mode: "daily" }))).toEqual(["recordatorio"]);
    expect(kinds(base({ now: cr(MON, 13), mode: "daily" }))).toEqual(["semanal", "recordatorio"]);
  });
});

describe("filtro de horas relevantes", () => {
  it("hora del recordatorio, 20:00 y lunes 07:00", () => {
    const p = { ...DEFAULT_PREFS, reminder_time: "17:30" };
    expect(isRelevantHour(cr(WED, 17), p)).toBe(true);
    expect(isRelevantHour(cr(WED, 20), p)).toBe(true);
    expect(isRelevantHour(cr(MON, 7), p)).toBe(true);
    expect(isRelevantHour(cr(WED, 7), p)).toBe(false);
    expect(isRelevantHour(cr(WED, 3), p, "daily")).toBe(true);
  });
});

describe("copy", () => {
  const ctx = { name: "Andrés Guevara", routine: "Empuje A", mins: 55, streak: 4, day: WED };
  it("recordatorio: Coach Banana nombra el entreno y sus minutos", () => {
    expect(copyFor("recordatorio", ctx).title).toBe("Coach Banana: hoy toca Empuje A, 55 min");
    expect(copyFor("recordatorio", { ...ctx, routine: "Bombeo Banana: brazos y hombros" }).title).toBe("Coach Banana: hoy toca Bombeo Banana, 55 min");
    expect(copyFor("recordatorio", { ...ctx, mins: undefined, name: "" }).title).toBe("Coach Banana: hoy toca Empuje A");
  });
  it("recordatorio con un dato real de la última vez, en el registro de la persona", () => {
    const lift = liftFact("Remo con barra", [57.5, 60])!;
    expect(lift).toEqual({ name: "Remo con barra", kg: 60, delta: 2.5 });
    const x = { ...ctx, routine: "Espalda de gorila y glúteos", mins: 40, lift };
    const d = (2.5).toLocaleString("es-419"); // separador decimal de es-419
    expect(copyFor("recordatorio", x).title).toBe("Coach Banana: hoy toca Espalda de gorila y glúteos, 40 min");
    expect(copyFor("recordatorio", x).body).toBe(`Tu remo con barra subió ${d} kg la última vez.`);
    expect(copyFor("recordatorio", { ...x, voice: "basico" }).body).toBe(`La última vez tu remo con barra subió ${d} kg. Hoy vamos por más.`);
    expect(copyFor("recordatorio", { ...x, voice: "tecnico" }).body).toBe(`Remo con barra: +${d} kg en tu última sesión (60 kg).`);
    // Sin subida: el último peso y una meta concreta.
    expect(liftLine("intermedio", liftFact("Press banca", [60, 60])!)).toBe("Última vez: press banca con 60 kg. Hoy toca superarlo.");
    expect(liftFact("Press banca", [])).toBeNull();
    expect(liftFact("Press banca", [0])).toBeNull();
  });
  it("recordatorio sin dato: el cuerpo cambia con el registro, nunca con jerga en básico", () => {
    for (const day of ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]) {
      const b = copyFor("recordatorio", { ...ctx, day, voice: "basico", hook: "Hoy armas una espalda ancha" }).body;
      expect(b).not.toMatch(/\bRIR\b|tempo|e1RM|doble progresión/i);
    }
  });
  it("nunca culpa ni avergüenza", () => {
    const bad = /(fallaste|decepcion|vergüenza|flojo|perezos|no tienes excusa|abandon|culpa)/i;
    for (const k of ["recordatorio", "racha", "semanal", "reactivacion_3", "reactivacion_7"] as const) {
      for (const day of ["2026-10-20", "2026-10-21", "2026-10-22"]) {
        const c = copyFor(k, { ...ctx, day, workouts: 3, kgDelta: -0.4 });
        expect(c.title + c.body).not.toMatch(bad);
        expect(c.title + c.body).not.toMatch(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u);
        expect(c.url.startsWith("/app")).toBe(true);
      }
    }
  });
  it("sin raya larga ni punto medio en ningún aviso", () => {
    for (const k of ["recordatorio", "racha", "semanal", "reactivacion_3", "reactivacion_7"] as const) {
      const c = copyFor(k, { ...ctx, workouts: 3, kgDelta: -0.4 });
      expect(c.title + c.body).not.toMatch(/[·—]/);
    }
    expect(copyFor("semanal", { ...ctx, workouts: 3, kgDelta: -0.4 }).body).toMatch(/^3 entrenos y [-−]0[.,]4 kg/);
  });
});

describe("zona horaria y modo del cron", () => {
  it("nombre amigable", () => {
    expect(tzLabel("America/Costa_Rica", new Date("2026-10-22T12:00:00Z"))).toBe("Costa Rica (GMT-6)");
    expect(tzLabel("America/Argentina/Buenos_Aires", new Date("2026-10-22T12:00:00Z"))).toBe("Buenos Aires (GMT-3)");
    expect(tzLabel("No/Existe")).toMatch(/^Costa Rica/);
  });
  it("NOTIFY_CRON_MODE", () => {
    expect(cronModeFrom("hourly")).toBe("hourly");
    expect(cronModeFrom(undefined)).toBe("daily");
    expect(cronModeFrom("cada hora")).toBe("daily");
  });
});
