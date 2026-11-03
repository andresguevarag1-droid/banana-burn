import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { asksTestimonial, parseTestimonial, showsTestimonialCard, TESTIMONIAL_PUBLISH_LABEL, TESTIMONIAL_QUESTION } from "./testimonials";
import { can } from "./admin-perms";
import { EXPORT_BY_USER } from "./account-export";
import { FUNNEL_EVENTS } from "@/app/api/track/event";

/** Simula una cuenta que guarda entrenos uno tras otro: en cuáles sale la tarjeta. */
function run(workouts: number, answersAt: number | null) {
  let answered = false;
  const shownAt: number[] = [];
  for (let n = 1; n <= workouts; n++) {
    const asked = asksTestimonial({ savedBefore: n - 1, answered, demo: false });
    if (showsTestimonialCard({ asked, fresh: true })) {
      shownAt.push(n);
      if (answersAt === n) answered = true;
    }
  }
  return shownAt;
}

describe("Cuándo sale la tarjeta de opinión (#238)", () => {
  it("solo en el tercer entreno guardado", () => {
    expect(run(8, 3)).toEqual([3]);
    expect([0, 1, 3, 4, 10].map((savedBefore) => asksTestimonial({ savedBefore, answered: false, demo: false }))).toEqual([false, false, false, false, false]);
    expect(asksTestimonial({ savedBefore: 2, answered: false, demo: false })).toBe(true);
  });

  it("una sola vez: si no responde, no vuelve en el cuarto ni después", () => {
    expect(run(8, null)).toEqual([3]);
  });

  it("si ya dejó su opinión (por ejemplo, otra pestaña), no sale", () => {
    expect(asksTestimonial({ savedBefore: 2, answered: true, demo: false })).toBe(false);
  });

  it("en demo nunca (no se guarda nada)", () => {
    expect(asksTestimonial({ savedBefore: 2, answered: false, demo: true })).toBe(false);
  });

  it("un reintento del mismo guardado (ya estaba guardado) no la muestra", () => {
    expect(showsTestimonialCard({ asked: true, fresh: false })).toBe(false);
    expect(showsTestimonialCard({ asked: false, fresh: true })).toBe(false);
  });

  it("el texto de la tarjeta es el del issue", () => {
    expect(TESTIMONIAL_QUESTION).toBe("¿Cómo te ha ido con Banana Burn?");
    expect(TESTIMONIAL_PUBLISH_LABEL).toBe("Pueden publicar mi opinión con mi nombre de pila y país");
  });
});

describe("Validación de la opinión", () => {
  it("1 a 5 estrellas enteras", () => {
    for (const stars of [0, 6, 2.5, "5", null]) expect(parseTestimonial({ stars })).toBeNull();
    expect(parseTestimonial({ stars: 5 })).toEqual({ stars: 5, text: null, publishOk: false });
  });

  it("texto opcional de hasta 200 caracteres, sin espacios de sobra", () => {
    expect(parseTestimonial({ stars: 4, text: "  Muy   bien  " })?.text).toBe("Muy bien");
    expect(parseTestimonial({ stars: 4, text: "   " })?.text).toBeNull();
    expect(parseTestimonial({ stars: 4, text: "a".repeat(200) })?.text).toHaveLength(200);
    expect(parseTestimonial({ stars: 4, text: "a".repeat(201) })).toBeNull();
    expect(parseTestimonial({ stars: 4, text: 12 })).toBeNull();
  });

  it("el permiso para publicar solo vale si viene exactamente true", () => {
    expect(parseTestimonial({ stars: 3, publishOk: "true" })?.publishOk).toBe(false);
    expect(parseTestimonial({ stars: 3, publishOk: 1 })?.publishOk).toBe(false);
    expect(parseTestimonial({ stars: 3, publishOk: true })?.publishOk).toBe(true);
  });
});

describe("Tabla y panel", () => {
  const sql = readFileSync("supabase/migrations/0065_testimonios.sql", "utf8");

  it("la migración 0065 tiene RLS, una opinión por cuenta y solo aprueba lo que se puede publicar", () => {
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/unique \(user_id\)/);
    expect(sql).toMatch(/check \(approved_at is null or publish_ok\)/);
    expect(sql).toMatch(/publish_ok boolean not null default false/);
    expect(sql).toMatch(/grant insert \(stars, text, publish_ok\)/);
  });

  it("solo admin y superadmin aprueban en /admin", () => {
    expect(["admin", "superadmin"].every((r) => can(r as "admin", "testimonials.manage"))).toBe(true);
    expect(["coach", "support", "free", "pro"].some((r) => can(r as "coach", "testimonials.manage"))).toBe(false);
  });

  it("va en la descarga de datos y en el embudo", () => {
    expect(EXPORT_BY_USER).toContain("testimonials");
    expect(FUNNEL_EVENTS).toContain("testimonial_view");
    expect(FUNNEL_EVENTS).toContain("testimonial_sent");
  });
});
