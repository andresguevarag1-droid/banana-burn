import "server-only";
// Código QR de bananaburn.app generado en el servidor (sin servicios externos). Se cachea en memoria: es siempre igual.
import QRCode from "qrcode";

const cache = new Map<string, Promise<string>>();

/** SVG del QR (tinta sobre blanco, con margen) para abrir la app en el celular desde la computadora. */
export function installQrSvg(url = "https://www.bananaburn.app/?utm_source=qr&utm_medium=desktop") {
  let p = cache.get(url);
  if (!p) {
    p = QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#1B1505", light: "#FFFFFF" } }).catch(() => "");
    cache.set(url, p);
  }
  return p;
}
