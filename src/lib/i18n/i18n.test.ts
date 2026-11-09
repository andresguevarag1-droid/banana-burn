import { describe, expect, it } from "vitest";
import { localeFromAcceptLanguage, localeFromPath, resolveLocale, defaultUnits } from "./locale";
import { cmToFtIn, fmtHeight, fmtMoney, fmtNumber, fmtWeight, ftInToCm, kgToLb, kgToPlateLb, lbInputToKg, lbToKg, loadIn, workoutLoad, workoutLoadToKg } from "./format";
import { exerciseName } from "./names";
import { hasTranslation, tr, translate } from "./t";
import { offerFor } from "./offer";
import { offer } from "@/lib/offer";
import { PROMO_PCT } from "@/lib/trial";

describe("elección de idioma (#287)", () => {
  it("el perfil manda sobre la URL, la cookie y el navegador", () => {
    expect(resolveLocale({ profile: "en-US", path: "/", cookie: "es-419", acceptLanguage: "es-CR" })).toBe("en-US");
    expect(resolveLocale({ profile: "es-419", path: "/en", cookie: "en-US", acceptLanguage: "en-US" })).toBe("es-419");
  });
  it("sin perfil, la URL /en decide, luego la cookie de la URL y al final Accept-Language", () => {
    expect(resolveLocale({ path: "/en/pricing", acceptLanguage: "es-CR" })).toBe("en-US");
    expect(resolveLocale({ path: "/entrar", cookie: "en-US", acceptLanguage: "es-CR" })).toBe("en-US");
    expect(resolveLocale({ path: "/entrar", cookie: "es-419", acceptLanguage: "en-US" })).toBe("es-419");
    expect(resolveLocale({ path: "/entrar", acceptLanguage: "en-US,en;q=0.9" })).toBe("en-US");
  });
  it("sin nada que decida (o con valores raros) queda en español", () => {
    expect(resolveLocale({})).toBe("es-419");
    expect(resolveLocale({ profile: "fr", path: "/english", cookie: "xx", acceptLanguage: "fr-FR,de;q=0.5" })).toBe("es-419");
  });
  it("solo /en y lo que cuelga de /en es inglés", () => {
    expect(localeFromPath("/en")).toBe("en-US");
    expect(localeFromPath("/en/pricing")).toBe("en-US");
    expect(localeFromPath("/entrar")).toBeNull();
    expect(localeFromPath("/")).toBeNull();
  });
  it("Accept-Language: el inglés gana solo si es lo primero y no hay español en ninguna parte", () => {
    expect(localeFromAcceptLanguage("en-US,en;q=0.9")).toBe("en-US");
    expect(localeFromAcceptLanguage("en-US,en;q=0.9,es;q=0.8")).toBe("es-419");
    expect(localeFromAcceptLanguage("es-419,es;q=0.9,en;q=0.8")).toBe("es-419");
    expect(localeFromAcceptLanguage("fr;q=0.9,en;q=1")).toBe("en-US");
    expect(localeFromAcceptLanguage("pt-BR")).toBeNull();
    expect(localeFromAcceptLanguage("en;q=0")).toBeNull();
    expect(localeFromAcceptLanguage("")).toBeNull();
  });
  it("la bienvenida propone libras en inglés y kilos en español", () => {
    expect(defaultUnits("en-US")).toBe("imperial");
    expect(defaultUnits("es-419")).toBe("metric");
  });
});

describe("formatos (#287)", () => {
  it("precios y números: $9.99, 1,200, igual en los dos idiomas", () => {
    for (const l of ["es-419", "en-US"] as const) {
      expect(fmtMoney(9.99, l)).toBe("$9.99");
      expect(fmtMoney(1040, l)).toBe("$1,040.00");
      expect(fmtNumber(1200, l)).toBe("1,200");
      expect(fmtNumber(93.14, l)).toBe("93.1");
    }
  });
  it("kg y lb, ida y vuelta", () => {
    expect(kgToLb(100)).toBeCloseTo(220.46, 2);
    expect(lbToKg(220.46)).toBeCloseTo(100, 2);
    expect(fmtWeight(93.1, "metric", "es-419")).toBe("93.1 kg");
    expect(fmtWeight(93.1, "imperial", "en-US")).toBe("205.3 lb");
    expect(fmtWeight(1000, "imperial", "en-US", 0)).toBe("2,205 lb");
    expect(loadIn(20, "imperial")).toBe(44);
    expect(loadIn(22.5, "metric")).toBe(22.5);
  });
  it("cm y ft/in, ida y vuelta", () => {
    expect(cmToFtIn(175)).toEqual({ ft: 5, in: 9 });
    expect(cmToFtIn(182.88)).toEqual({ ft: 6, in: 0 });
    expect(ftInToCm(5, 9)).toBe(175.3);
    expect(fmtHeight(175, "imperial", "en-US")).toBe("5 ft 9 in");
    expect(fmtHeight(175, "metric", "es-419")).toBe("175 cm");
  });
});

describe("cargas del entreno en libras de 2.5 en 2.5 (#295)", () => {
  it("kg del plan a libras redondeadas al disco de 2.5 lb", () => {
    expect(kgToPlateLb(20)).toBe(45);
    expect(kgToPlateLb(22.5)).toBe(50);
    expect(kgToPlateLb(10)).toBe(22.5);
    expect(kgToPlateLb(0)).toBe(0);
    for (const kg of [2, 5, 12.5, 37.5, 60, 101.25]) expect(kgToPlateLb(kg) % 2.5).toBe(0);
  });
  it("lo que escribe la persona en libras se guarda en kg con dos decimales y vuelve igual", () => {
    expect(lbInputToKg(45)).toBe(20.41);
    expect(kgToPlateLb(lbInputToKg(45))).toBe(45);
    for (const lb of [2.5, 25, 47.5, 135, 225, 317.5]) expect(kgToPlateLb(lbInputToKg(lb))).toBe(lb);
  });
  it("workoutLoad y workoutLoadToKg: en imperial convierten, en métrico pasan igual", () => {
    expect(workoutLoad(20, "imperial")).toBe(45);
    expect(workoutLoad(22.5, "imperial")).toBe(50);
    expect(workoutLoadToKg(45, "imperial")).toBe(20.41);
    expect(workoutLoad(workoutLoadToKg(45, "imperial"), "imperial")).toBe(45);
    for (const kg of [0, 2.5, 20, 22.5, 61.25]) {
      expect(workoutLoad(kg, "metric")).toBe(kg);
      expect(workoutLoadToKg(kg, "metric")).toBe(kg);
    }
  });
});

describe("nombres de ejercicios (#295)", () => {
  it("en español devuelve el nombre en español tal cual, aunque el id exista", () => {
    expect(exerciseName("squat", "Sentadilla trasera", "es-419")).toBe("Sentadilla trasera");
    expect(exerciseName(null, "Lo que sea", "es-419")).toBe("Lo que sea");
  });
  it("en inglés, un id conocido da su nombre por id", () => {
    expect(exerciseName("squat", "Sentadilla trasera", "en-US")).toBe("Back squat");
    expect(exerciseName("pushup", "otro texto", "en-US")).toBe("Push-ups");
  });
  it("un id desconocido (programas y retos) busca su nombre en español en el diccionario", () => {
    expect(exerciseName("reto-x", "Sentadilla trasera", "en-US")).toBe("Back squat");
    expect(exerciseName(undefined, "Plancha", "en-US")).toBe(translate("en-US", "Plancha"));
    expect(exerciseName("reto-x", "Ejercicio sin traducir", "en-US")).toBe("Ejercicio sin traducir");
  });
});

describe("traducción (#287)", () => {
  it("el español no cambia: es la frase fuente, con sus valores", () => {
    expect(translate("es-419", "Entrenar ahora")).toBe("Entrenar ahora");
    expect(tr("es-419")("Hola, {name}", { name: "Ana" })).toBe("Hola, Ana");
    expect(tr("es-419")("Frase sin traducir {x}")).toBe("Frase sin traducir {x}");
  });
  it("lo que no tiene traducción sale en español, sin romperse", () => {
    expect(translate("en-US", "Una frase que nadie tradujo")).toBe("Una frase que nadie tradujo");
    expect(hasTranslation("en-US", "Una frase que nadie tradujo")).toBe(false);
  });
  it("la oferta en español es exactamente offer()", () => {
    for (const d of ["2026-10-20T12:00:00Z", "2026-11-10T12:00:00Z", "2027-01-05T12:00:00Z"]) {
      const now = new Date(d);
      const es = offerFor("es-419", now);
      const base = offer(now);
      expect({ ...es, from: es.from("$9.99"), pricingIntro: es.pricingIntro(33), faqTrial: es.faqTrial("X") }).toEqual({ ...base, from: base.from("$9.99"), pricingIntro: base.pricingIntro(33), faqTrial: base.faqTrial("X") });
    }
  });
  it("la oferta en inglés queda traducida entera en sus tres etapas", () => {
    expect(PROMO_PCT).toBe(50); // el diccionario usa 50 (src/lib/i18n/en/offer.ts)
    for (const d of ["2026-10-20T12:00:00Z", "2026-11-10T12:00:00Z", "2027-01-05T12:00:00Z"]) {
      const now = new Date(d);
      const en = offerFor("en-US", now);
      const texts = [en.note, en.seo, en.riskLine, en.statLabel, en.pricingTrial, en.faqCancel, en.signupLine, en.ogLine, en.llms, ...en.guarantee, ...en.signupChecks, en.faqCtaExtra, en.from("$9.99"), en.pricingIntro(33), en.faqTrial("Training + Nutrition")];
      for (const s of texts) expect(s, s).not.toMatch(/[áéíóúñ¿]|días|tarjeta|gratis|\bcon\b/i);
      expect(en.from("$9.99")).toBe("Then from $9.99/month.");
      expect(en.pricingIntro(33)).toContain("save 33%");
    }
  });
});
