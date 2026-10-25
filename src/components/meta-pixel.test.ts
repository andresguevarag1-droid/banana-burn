import { describe, expect, it } from "vitest";
import { loadMetaPixel } from "./meta-pixel";

// Ventana falsa mínima: solo lo que usa loadMetaPixel.
function fakeWindow() {
  const head: { tag: string; src: string; async: boolean }[] = [];
  const w = {
    document: {
      createElement: (tag: string) => ({ tag, src: "", async: false }),
      head: { appendChild: (n: { tag: string; src: string; async: boolean }) => { head.push(n); return n; } },
    },
  } as unknown as Window & typeof globalThis & { fbq?: ((...a: unknown[]) => void) & { queue?: unknown[][] } };
  return { w, head };
}

describe("Meta Pixel después de hidratar (evita el error #418)", () => {
  it("agrega fbevents.js al FINAL de <head> (nunca antes de otro script) y encola init + PageView", () => {
    const { w, head } = fakeWindow();
    loadMetaPixel("123", w);
    expect(head).toHaveLength(1);
    expect(head[0].src).toBe("https://connect.facebook.net/en_US/fbevents.js");
    expect(head[0].async).toBe(true);
    expect((w.fbq as unknown as { queue: unknown[][] }).queue).toEqual([["init", "123"], ["track", "PageView"]]);
  });

  it("no lo carga dos veces", () => {
    const { w, head } = fakeWindow();
    loadMetaPixel("123", w);
    loadMetaPixel("123", w);
    expect(head).toHaveLength(1);
  });
});
