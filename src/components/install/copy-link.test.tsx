import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CopyLink } from "./install-helper";

describe("enlace para continuar con Google fuera de otra app (#235)", () => {
  it.each([
    "/entrar",
    "/entrar?modo=registro&plan=completo&ref=ABC123&next=%2Fbienvenida",
  ])("ofrece la URL pública con la ruta y los parámetros intactos: %s", (path) => {
    const html = renderToStaticMarkup(<CopyLink path={path} where="registro" />);
    expect(html).toContain(`value="https://www.bananaburn.app${path.replaceAll("&", "&amp;")}"`);
    expect(html).toContain("readOnly");
    expect(html).toContain("Copiar");
    expect(html).toContain('aria-label="Enlace de Banana Burn"');
  });
});
