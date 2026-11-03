import { describe, expect, it } from "vitest";
import { FIRST_PARTIAL_KEY, clearFirstPartial, markFirstPartial, readFirstPartial } from "./first-partial";

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const p = { title: "Primer entreno", done: 2, total: 9, mins: 6, at: 1_000_000 };

describe("primer entreno a medias en Hoy (#246)", () => {
  it("Hoy lee lo que dejó el reproductor y lo olvida al cerrarlo", () => {
    const s = mem();
    markFirstPartial(s, p);
    expect(readFirstPartial(s, p.at + 60_000)).toEqual(p);
    clearFirstPartial(s);
    expect(readFirstPartial(s, p.at + 60_000)).toBeNull();
  });
  it("pasados 3 días, sin series o con datos rotos no se muestra", () => {
    const s = mem();
    markFirstPartial(s, p);
    expect(readFirstPartial(s, p.at + 3 * 86_400_000)).toBeNull();
    markFirstPartial(s, { ...p, done: 0 });
    expect(readFirstPartial(s, p.at)).toBeNull();
    s.setItem(FIRST_PARTIAL_KEY, "{roto");
    expect(readFirstPartial(s, p.at)).toBeNull();
  });
  it("sin almacenamiento no rompe", () => {
    const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } };
    expect(() => markFirstPartial(broken, p)).not.toThrow();
    expect(readFirstPartial(broken, p.at)).toBeNull();
    expect(() => clearFirstPartial(broken)).not.toThrow();
  });
});
