import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const doc = readFileSync(
  fileURLToPath(new URL("../../docs/ventas/whatsapp-activacion.md", import.meta.url)),
  "utf8",
);

function blocksUnder(heading: RegExp): string[][] {
  const start = doc.search(heading);
  const rest = doc.slice(start);
  const body = rest.slice(rest.indexOf("\n") + 1);
  const next = body.search(/^## /m);
  const section = next === -1 ? body : body.slice(0, next);
  return [...section.matchAll(/```text\n([\s\S]*?)```/g)].map((m) =>
    m[1].split("\n").filter((l) => l.trim() !== ""),
  );
}

describe("mensajes de WhatsApp de activación", () => {
  it("cada mensaje de los tres casos cabe en 3 líneas", () => {
    const blocks = [
      ...blocksUnder(/^## 1\. /m),
      ...blocksUnder(/^## 2\. /m),
      ...blocksUnder(/^## 3\. /m),
    ];
    expect(blocks).toHaveLength(3);
    for (const lines of blocks) expect(lines.length).toBeLessThanOrEqual(3);
  });

  it("cada respuesta a objeción tiene 5 bloques de 2 líneas como máximo", () => {
    const blocks = blocksUnder(/^## 4\. /m);
    expect(blocks).toHaveLength(5);
    for (const lines of blocks) expect(lines.length).toBeLessThanOrEqual(2);
  });

  it("el enlace al entreno en casa conserva ?casa=1", () => {
    const links = doc.match(/https:\/\/bananaburn\.app\/app\/entreno\?casa=1/g) ?? [];
    expect(links.length).toBeGreaterThanOrEqual(4);
  });

  it("el registro para la oficina tiene la tabla de seguimiento", () => {
    expect(doc).toMatch(/^\| Fecha \| Alias \| Estado al escribirle/m);
  });
});
