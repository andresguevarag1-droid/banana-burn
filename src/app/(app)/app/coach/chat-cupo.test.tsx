import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { quotaFrom } from "@/lib/coach-quota";
import { COACH_PROMPTS } from "@/lib/coach-prompt";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {} }) }));
const { Chat } = await import("./chat");

const ask = COACH_PROMPTS.bien.message;
const base = { initial: [], opener: "Hola", suggest: [], name: "Tomás", ask };

describe("burbuja del coach sin preguntas (#198, QA 1)", () => {
  it("la respuesta tocada se ve en el chat aunque no haya campo de texto", () => {
    const html = renderToStaticMarkup(<Chat {...base} quota={quotaFrom("prueba", 10, 10)} />);
    expect(html).toContain("data-held");
    expect(html).toContain(ask);
    expect(html).toContain("Sin enviar");
    expect(html).not.toContain('aria-label="Mensaje"');
  });

  it("con cupo no se muestra como guardada (se envía al abrir)", () => {
    const html = renderToStaticMarkup(<Chat {...base} quota={quotaFrom("prueba", 0, 0)} />);
    expect(html).not.toContain("data-held");
  });

  it("sin cupo no se quita ?pregunta= de la dirección, así recargar no la pierde", () => {
    const src = readFileSync("src/app/(app)/app/coach/chat.tsx", "utf8");
    const effect = src.slice(src.indexOf("asked.current = true"), src.indexOf("setPending(ask)"));
    expect(effect.indexOf('!== "send") return')).toBeGreaterThan(-1);
    expect(effect.indexOf('!== "send") return')).toBeLessThan(effect.indexOf("router.replace"));
  });
});
