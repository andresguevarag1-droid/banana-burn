import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/analytics", () => ({ FunnelTracker: ({ view }: { view: string }) => <span data-view={view} />, track: () => {} }));
vi.mock("@/app/(app)/app/entreno/testimonial-action", () => ({ sendTestimonial: async () => ({ ok: true }) }));
import { TestimonialForm } from "./testimonial-card";

const noop = () => {};
const html = (p: { stars?: number; publishOk?: boolean; text?: string }) =>
  renderToStaticMarkup(<TestimonialForm stars={p.stars ?? 0} onStars={noop} text={p.text ?? ""} onText={noop} publishOk={p.publishOk ?? false} onPublishOk={noop} onSubmit={noop} />);

describe("Tarjeta de opinión del tercer entreno", () => {
  it("pregunta, 5 estrellas, texto de 200 y la casilla sin marcar por defecto", () => {
    const h = html({});
    expect(h).toContain("¿Cómo te ha ido con Banana Burn?");
    expect(h.match(/type="radio"/g)).toHaveLength(5);
    expect(h).toContain('aria-label="1 estrella"');
    expect(h).toContain('aria-label="5 estrellas"');
    expect(h).toContain('maxLength="200"');
    expect(h).toContain("Pueden publicar mi opinión con mi nombre de pila y país");
    expect(h).toMatch(/<input type="checkbox"(?![^>]*checked)[^>]*>/);
    expect(h).toContain('data-view="testimonial_view"');
  });

  it("no se envía sin estrellas", () => {
    expect(html({})).toMatch(/<button[^>]*disabled=""[^>]*>Enviar opinión/);
    expect(html({ stars: 4 })).not.toMatch(/<button[^>]*disabled=""/);
  });

  it("sin emojis ni exclamaciones", () => {
    const h = html({ stars: 5 });
    expect(h).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(h).not.toContain("!");
  });
});
