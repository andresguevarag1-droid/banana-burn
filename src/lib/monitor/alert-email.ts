// Correo interno al dueño cuando los errores de la app se disparan (lo manda el cron, una vez por día como máximo).
// Solo conteos por ruta: nunca datos de usuarios.
import { SITE_URL } from "@/lib/env";
import { esc } from "@/lib/email/templates";

const n = (x: number) => x.toLocaleString("es-419");

export function opsAlertEmail(total: number, top: { route: string; hits: number }[], release: string | null) {
  const subject = `Banana Burn: ${n(total)} errores en las últimas 24 h`;
  const url = `${SITE_URL}/admin/salud`;
  const rows = top.map((r) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #EDE3C6;font-family:ui-monospace,monospace;font-size:13px;">${esc(r.route)}</td><td style="padding:6px 10px;border-bottom:1px solid #EDE3C6;text-align:right;font-weight:700;">${n(r.hits)}</td></tr>`).join("");
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#FFF8E3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2E2818;">
<div style="max-width:520px;margin:0 auto;padding:24px 16px;"><div style="background:#fff;border:1px solid #EDE3C6;border-radius:18px;padding:20px;">
<h1 style="margin:0 0 8px;font-size:20px;">Los errores se dispararon</h1>
<p style="margin:0 0 14px;line-height:1.5;">En las últimas 24 horas la app registró <b>${n(total)}</b> errores${release ? ` (versión ${esc(release)})` : ""}. Las rutas con más fallas:</p>
<table style="width:100%;border-collapse:collapse;">${rows}</table>
<p style="margin:16px 0 0;"><a href="${esc(url)}" style="display:inline-block;background:#1B1505;color:#fff;text-decoration:none;border-radius:999px;padding:10px 18px;font-weight:700;">Abrir Salud en el panel</a></p>
<p style="margin:14px 0 0;font-size:12px;color:#6A604B;line-height:1.5;">Si empezó con un deploy, en Vercel puedes volver a la versión anterior con Instant Rollback. Este aviso llega como máximo una vez por día.</p>
</div></div></body></html>`;
  const text = `${subject}\n\n${top.map((r) => `${r.route}: ${n(r.hits)}`).join("\n")}\n\nPanel: ${url}`;
  return { subject, html, text };
}
