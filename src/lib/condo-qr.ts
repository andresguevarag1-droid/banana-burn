import "server-only";
// QR del enlace de un condominio afiliado (0053), generado en el servidor con la librería local (sin servicios externos).
import QRCode from "qrcode";

export function condoQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#1B1505", light: "#FFFFFF" } }).catch(() => "");
}
