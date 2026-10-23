import { adminClient } from "@/lib/supabase/admin";
import { RESUB_MAX_AGE_MS, UNSUB_MAX_AGE_MS, unsubSecret, verifyUnsubToken, type UnsubScope } from "@/lib/email/token";
import { esc } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS: Record<UnsubScope, string[]> = {
  recordatorios: ["email_reminders"],
  semanal: ["weekly_summary"],
  marketing: ["marketing"],
  todo: ["email_reminders", "weekly_summary", "marketing"],
};
const LABEL: Record<UnsubScope, string> = {
  recordatorios: "los recordatorios de entreno por correo",
  semanal: "el resumen semanal",
  marketing: "las novedades y promociones",
  todo: "ningún correo de recordatorios, resúmenes ni promociones",
};

async function apply(userId: string, scope: UnsubScope, value: boolean) {
  const admin = adminClient();
  if (!admin) return false;
  const row: Record<string, unknown> = { user_id: userId };
  for (const f of FIELDS[scope]) row[f] = value;
  const { error } = await admin.from("notification_prefs").upsert(row, { onConflict: "user_id" });
  return !error;
}

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} | Banana Burn</title></head>
<body style="margin:0;background:#FFF8E3;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2E2818;">
<main style="max-width:480px;margin:0 auto;padding:40px 16px;">
<div style="background:#fff;border:1px solid #EDE3C6;border-radius:24px;overflow:hidden;box-shadow:0 1px 2px rgba(27,21,5,.04),0 8px 24px -8px rgba(27,21,5,.10);">
<div style="padding:18px 22px;"><a href="/" style="text-decoration:none;"><img src="/icons/icon-192.png" width="36" height="36" alt="" style="width:36px;height:36px;border-radius:10px;vertical-align:middle;"><span style="vertical-align:middle;margin-left:10px;font-size:20px;font-weight:800;color:#1B1505;letter-spacing:-0.02em;">Banana <span style="color:#8A5300;">Burn</span></span></a></div>
<div style="background:#FFD60A;padding:24px 22px;"><p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#1B1505;">Tus correos</p><h1 style="margin:0;font-size:28px;line-height:32px;font-weight:800;letter-spacing:-.02em;color:#1B1505;">${esc(title)}</h1></div>
<div style="padding:24px 22px;">${body}
<div style="margin-top:22px;padding:14px 16px;background:#FFFBF0;border:1px solid #EDE3C6;border-radius:18px;display:flex;gap:12px;align-items:center;"><img src="/email/coach.png" width="44" height="44" alt="Coach Banana" style="width:44px;height:44px;border-radius:22px;"><span style="font-size:14px;line-height:1.5;">Tu plan sigue igual. Aquí te espero cuando quieras entrenar.<br><b style="color:#8A6200;font-size:12px;letter-spacing:.14em;text-transform:uppercase;">Coach Banana</b></span></div></div></div>
<p style="text-align:center;font-size:13px;color:#8C8169;margin-top:18px;"><a href="/app/perfil#notificaciones" style="color:#6A604B;">Ajustar todos mis avisos</a></p>
</main></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

const invalid = () => page("Enlace no válido", `<p style="line-height:1.6;">Este enlace de baja no es válido o está incompleto. Puedes ajustar tus correos desde tu perfil en la app.</p>`, 400);

/** Baja con un clic desde el enlace del correo: ?token=… firmado con EMAIL_UNSUB_SECRET. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const t = verifyUnsubToken(token, unsubSecret(), { maxAgeMs: UNSUB_MAX_AGE_MS });
  if (!t) return invalid();
  const ok = await apply(t.userId, t.scope, false);
  if (!ok) return page("No pudimos guardar el cambio", `<p style="line-height:1.6;">Intenta de nuevo en un momento o escríbenos a hola@bananaburn.app y lo hacemos por ti.</p>`, 503);
  return page("Listo, te dimos de baja", `<p style="line-height:1.6;">Ya no recibirás ${LABEL[t.scope]}. Los correos de tu cuenta y pagos seguirán llegando.</p>
${t.issuedAt !== null && Date.now() - t.issuedAt <= RESUB_MAX_AGE_MS ? `<form method="post" action="/api/email/baja?token=${encodeURIComponent(token!)}" style="margin-top:18px;"><input type="hidden" name="accion" value="volver">
<button style="background:#1B1505;color:#fff;border:0;border-radius:999px;height:48px;padding:0 22px;font-size:15px;font-weight:600;cursor:pointer;">¿Fue un error? Volver a suscribirme</button></form>` : ""}`);
}

/** RFC 8058 (List-Unsubscribe-Post: One-Click) y botón "volver a suscribirme". */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const form = await req.formData().catch(() => null);
  const resubscribe = form?.get("accion") === "volver";
  // Volver a suscribirse (consentimiento) exige un enlace reciente y con fecha; darse de baja acepta enlaces viejos.
  const t = verifyUnsubToken(token, unsubSecret(), resubscribe ? { maxAgeMs: RESUB_MAX_AGE_MS, requireIssuedAt: true } : { maxAgeMs: UNSUB_MAX_AGE_MS });
  if (!t) return invalid();
  const ok = await apply(t.userId, t.scope, resubscribe);
  if (!ok) return page("No pudimos guardar el cambio", `<p>Intenta de nuevo en un momento.</p>`, 503);
  return resubscribe
    ? page("Listo, estás de vuelta", `<p style="line-height:1.6;">Volverás a recibir ${t.scope === "todo" ? "tus recordatorios, resúmenes y novedades" : LABEL[t.scope]}.</p>`)
    : page("Listo, te dimos de baja", `<p style="line-height:1.6;">Ya no recibirás ${LABEL[t.scope]}.</p>`);
}
