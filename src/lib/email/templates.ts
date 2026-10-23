// Plantillas de correo Banana Burn: HTML con estilos en línea (compatible con Gmail/Outlook/iOS Mail),
// tema claro con amarillo banana, en español neutro para LATAM, y versión de texto plano para cada una.
//
// Identidad: encabezado tinta con el logo (llama con banana) y la marca en amarillo, franja banana,
// botón banana con texto tinta y firma de Coach Banana (la mascota). Sin emojis: viñetas de color.
// Los correos no transaccionales llevan enlace de baja; los transaccionales (bienvenida, plan, pagos) no lo necesitan.
import { SITE_URL } from "../env";

export type Email = { subject: string; preheader: string; html: string; text: string };

const C = {
  paper: "#FFF8E3", card: "#FFFFFF", cream: "#FFFBF0", ink: "#1B1505", ink2: "#3A2E0C", body: "#2E2818", muted: "#6A604B", faint: "#8C8169",
  line: "#EDE3C6", banana: "#FFD60A", soft: "#FFF1A8", bananaInk: "#8A6200", peel: "#3F6B0E", ember: "#F2A100", onInk: "#E9DFC2",
};
const FONT = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SUPPORT = "hola@bananaburn.app";

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Absoluta: deja pasar URLs completas, mailto y variables de plantilla de Supabase ({{ .SiteURL }}). */
const abs = (path: string, site = SITE_URL) => (/^(https?:|mailto:|\{\{)/.test(path) ? path : `${site}${path}`);
const kg = (n: number, d = 1) => n.toLocaleString("es-419", { minimumFractionDigits: d, maximumFractionDigits: d });
const firstName = (n: string) => (n || "").trim().split(/\s+/)[0] || "crack";

export const money = (amount: number, currency = "USD") => {
  try { return new Intl.NumberFormat("es-419", { style: "currency", currency }).format(amount); } catch { return `${currency} ${amount.toFixed(2)}`; }
};
export const longDate = (iso: string) => {
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Costa_Rica" });
};

// ───────────── Meta de peso (personalización) ─────────────

/** Meta activa del usuario. `current` es el último pesaje; sin él se usa el peso inicial. */
export type Goal = { start?: number | null; current?: number | null; goal: number; date?: string | null };

/** Avance hacia la meta (sirve para bajar o para subir de peso). null si no hay datos para calcularlo. */
export function goalProgress(g: Goal | null | undefined) {
  if (!g || !Number.isFinite(g.goal)) return null;
  const start = g.start ?? g.current;
  const current = g.current ?? g.start;
  if (start == null || current == null) return null;
  const total = g.goal - start;
  const reached = total === 0 || (total < 0 ? current <= g.goal : current >= g.goal);
  const pct = reached ? 100 : Math.max(0, Math.min(99, Math.round(((current - start) / total) * 100)));
  const left = Math.round(Math.abs(g.goal - current) * 10) / 10;
  const moved = Math.round(Math.abs(current - start) * 10) / 10;
  return { pct, left, moved, reached, losing: total < 0 };
}

/** Una línea para texto plano y push: "Te faltan 6,2 kg para tus 85,0 kg". */
export function goalLine(g: Goal | null | undefined): string {
  const pr = goalProgress(g);
  if (!g || !pr) return "";
  if (pr.reached) return `Llegaste a tu meta de ${kg(g.goal)} kg`;
  return `Te faltan ${kg(pr.left)} kg para tus ${kg(g.goal)} kg${g.date ? ` (${longDate(g.date)})` : ""}`;
}

// ───────────── Bloques ─────────────
const p = (html: string) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${C.body};">${html}</p>`;
const small = (html: string) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${C.muted};">${html}</p>`;
const h1 = (html: string) => `<h1 style="margin:0 0 12px;font-family:${FONT};font-size:28px;line-height:1.15;font-weight:800;color:${C.ink};letter-spacing:-0.02em;">${html}</h1>`;
const h2 = (html: string) => `<p style="margin:20px 0 8px;font-size:13px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${C.bananaInk};">${html}</p>`;

/** Botón principal: banana con texto tinta (mismo estilo que la app). Tabla para que Outlook respete el fondo. */
const button = (label: string, href: string, site = SITE_URL) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px;"><tr><td style="border-radius:999px;background:${C.banana};border:2px solid ${C.ink};">` +
  `<a href="${esc(abs(href, site))}" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:16px;font-weight:800;color:${C.ink};text-decoration:none;border-radius:999px;">${esc(label)}</a></td></tr></table>`;

const stats = (items: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;"><tr>` +
  items.map(([v, l]) => `<td width="${Math.floor(100 / items.length)}%" style="padding:4px;"><div style="background:${C.soft};border-radius:16px;padding:14px 8px;text-align:center;">` +
    `<div style="font-size:20px;font-weight:800;color:${C.ink};white-space:nowrap;">${esc(v)}</div><div style="font-size:12px;color:${C.muted};margin-top:2px;">${esc(l)}</div></div></td>`).join("") +
  `</tr></table>`;

/** Viñeta de marca: punto de color (los correos no muestran íconos SVG de forma confiable y no usamos emojis). */
const dot = (color: string = C.banana) => `<span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${color};margin-right:10px;vertical-align:middle;"></span>`;

/** Etiqueta de color para destacar racha, récords o logros. */
const badge = (label: string, bg: string = C.soft, color: string = C.ink) =>
  `<p style="margin:0 0 12px;"><span style="display:inline-block;background:${bg};color:${color};border-radius:999px;padding:5px 12px;font-size:12px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;">${esc(label)}</span></p>`;

const list = (items: string[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;">` +
  items.map((i) => `<tr><td style="padding:9px 12px;border-bottom:1px solid ${C.line};font-size:15px;color:${C.body};">${i}</td></tr>`).join("") + `</table>`;

/** Pasos numerados (onboarding). */
const steps = (items: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px;">` +
  items.map(([t, d], i) => `<tr><td width="40" style="padding:8px 12px 8px 0;vertical-align:top;"><div style="width:30px;height:30px;line-height:30px;border-radius:15px;background:${C.ink};color:${C.banana};font-size:14px;font-weight:800;text-align:center;">${i + 1}</div></td>` +
    `<td style="padding:8px 0;vertical-align:top;"><div style="font-size:15px;font-weight:800;color:${C.ink};">${esc(t)}</div><div style="font-size:14px;line-height:1.5;color:${C.muted};">${esc(d)}</div></td></tr>`).join("") + `</table>`;

const rows = (items: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;border:1px solid ${C.line};border-radius:16px;border-collapse:separate;">` +
  items.map(([k, v], i) => `<tr><td style="padding:11px 14px;font-size:14px;color:${C.muted};${i ? `border-top:1px solid ${C.line};` : ""}">${esc(k)}</td><td align="right" style="padding:11px 14px;font-size:14px;font-weight:700;color:${C.ink};${i ? `border-top:1px solid ${C.line};` : ""}">${esc(v)}</td></tr>`).join("") + `</table>`;

/** Barra de avance (tabla de dos celdas: funciona en Outlook). */
const bar = (pct: number) => {
  const done = Math.max(0, Math.min(100, Math.round(pct)));
  const cell = (w: number, bg: string) => `<td width="${w}%" style="height:10px;line-height:10px;font-size:0;background:${bg};">&nbsp;</td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:999px;overflow:hidden;margin:12px 0 4px;"><tr>` +
    (done > 0 ? cell(done, C.banana) : "") + (done < 100 ? cell(100 - done, C.ink2) : "") + `</tr></table>`;
};

/** Tarjeta tinta con la meta de peso y su avance. Vacía si no hay meta. */
function goalCard(g: Goal | null | undefined) {
  const pr = goalProgress(g);
  if (!g || !pr) return "";
  const right = pr.reached ? "Meta cumplida" : `Te faltan <b style="color:${C.banana};">${kg(pr.left)} kg</b>`;
  const foot = pr.reached ? "Ahora toca sostenerla. Tu plan se ajusta a mantenimiento."
    : pr.moved > 0 ? `Ya llevas ${kg(pr.moved)} kg ${pr.losing ? "menos" : "más"} desde que empezaste.` : g.date ? `Fecha meta: ${longDate(g.date)}.` : "Cada sesión te acerca.";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;"><tr><td style="background:${C.ink};border-radius:18px;padding:16px 18px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td style="vertical-align:bottom;"><div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${C.banana};">Tu meta</div><div style="font-size:26px;font-weight:800;color:#FFFFFF;letter-spacing:-0.02em;">${kg(g.goal)} kg</div></td>` +
    `<td align="right" style="vertical-align:bottom;font-size:14px;color:${C.onInk};">${right}</td></tr></table>` +
    bar(pr.pct) + `<div style="font-size:13px;color:${C.onInk};margin-top:6px;">${esc(foot)}</div></td></tr></table>`;
}

/** Código de acceso grande sobre tinta (auth). */
const codeBox = (token: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 6px;"><tr><td align="center" style="background:${C.ink};border-radius:18px;padding:18px 12px;">` +
  `<div style="font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:${C.banana};">Tu código</div>` +
  `<div style="margin-top:6px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:36px;font-weight:800;letter-spacing:0.28em;color:#FFFFFF;">${token}</div></td></tr></table>`;

/** Firma de Coach Banana: la mascota habla en primera persona al final de cada correo. */
const coachNote = (line: string, site: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;"><tr><td style="background:${C.cream};border:1px solid ${C.line};border-radius:18px;padding:14px 16px;">` +
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
  `<td width="60" style="vertical-align:top;padding-right:12px;"><img src="${esc(site)}/email/coach.png" width="48" height="48" alt="Coach Banana" style="display:block;width:48px;height:48px;border:0;border-radius:24px;"></td>` +
  `<td style="vertical-align:top;"><div style="font-size:15px;line-height:1.5;color:${C.body};">${line}</div><div style="margin-top:4px;font-size:13px;font-weight:800;color:${C.bananaInk};">Coach Banana</div></td>` +
  `</tr></table></td></tr></table>`;

type LayoutOpts = { preheader: string; body: string; reason: string; tag?: string; coach?: string; unsubscribe?: string; site?: string };

function layout(o: LayoutOpts) {
  const site = o.site ?? SITE_URL;
  const a = (label: string, href: string) => `<a href="${esc(abs(href, site))}" style="color:${C.muted};text-decoration:underline;">${label}</a>`;
  const links = `${a("Abrir la app", "/app")} &nbsp;·&nbsp; ${a("Mi progreso", "/app/progreso")} &nbsp;·&nbsp; ${a("Ayuda", `mailto:${SUPPORT}`)}`;
  const reason = o.unsubscribe
    ? `${esc(o.reason)}<br>${a("Dejar de recibir estos correos", o.unsubscribe)} &nbsp;·&nbsp; ${a("Ajustar avisos", "/app/perfil#notificaciones")}`
    : esc(o.reason);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><meta name="x-apple-disable-message-reformatting"><title>Banana Burn</title></head>
<body style="margin:0;padding:0;background:${C.paper};font-family:${FONT};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(o.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};"><tr><td align="center" style="padding:24px 12px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="background:${C.ink};border-radius:24px 24px 0 0;padding:16px 22px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td><a href="${esc(abs("/app", site))}" style="text-decoration:none;"><img src="${esc(site)}/icons/icon-192.png" width="36" height="36" alt="" style="display:inline-block;width:36px;height:36px;border:0;border-radius:10px;vertical-align:middle;"><span style="vertical-align:middle;margin-left:10px;font-family:${FONT};font-size:20px;font-weight:800;color:${C.banana};letter-spacing:-0.02em;">Banana Burn</span></a></td>
${o.tag ? `<td align="right" style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${C.onInk};">${esc(o.tag)}</td>` : ""}
</tr></table></td></tr>
<tr><td style="height:6px;line-height:6px;font-size:0;background:${C.banana};">&nbsp;</td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.line};border-top:0;border-radius:0 0 24px 24px;padding:28px 24px 24px;">${o.body}${o.coach ? coachNote(o.coach, site) : ""}</td></tr>
<tr><td style="padding:22px 12px 0;font-size:12px;line-height:1.7;color:${C.faint};text-align:center;">${links}<br>${reason}<br><span style="color:${C.faint};">Banana Burn · Tu entrenador personal en el celular · Atlas Resources SRL</span></td></tr>
</table></td></tr></table></body></html>`;
}

function textLayout(lines: string[], unsubscribe?: string, reason?: string, coach?: string) {
  const out = [...lines];
  if (coach) out.push("", `"${coach.replace(/<[^>]+>/g, "")}"`, "-- Coach Banana");
  out.push("", "-- ", "Banana Burn · Tu entrenador personal en el celular", `Ayuda: ${SUPPORT}`);
  if (reason) out.push(reason);
  if (unsubscribe) out.push(`Dejar de recibir estos correos: ${unsubscribe}`);
  return out.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

// ───────────── Transaccionales ─────────────

export function bienvenida(d: { name: string }): Email {
  const n = firstName(d.name);
  const subject = `${n}, tu entrenador personal ya está listo`;
  const preheader = "Arma tu plan en 2 minutos y entrena hoy mismo con cargas calculadas para ti.";
  const coach = "Yo calculo las cargas y ajusto tu plan cada semana. Tú solo llega y dale con todo.";
  const body =
    `<div style="text-align:center;margin:0 0 6px;"><img src="${esc(SITE_URL)}/email/mascota.png" width="110" height="176" alt="Coach Banana" style="display:inline-block;width:110px;height:176px;border:0;"></div>` +
    h1(`¡Hola, ${esc(n)}! Ya eres parte de Banana Burn`) +
    p("Aquí no hay rutinas genéricas: cada sesión trae las cargas calculadas para ti y el plan se ajusta según cómo te va. Entrenar se vuelve un juego, y los resultados llegan.") +
    h2("Tus primeros 3 pasos") +
    steps([["Arma tu plan", "Meta, días y equipo. Te toma 2 minutos."], ["Haz tu primer entreno", "Te guiamos serie por serie, con descanso y técnica."], ["Registra tu peso", "Así medimos tu avance real cada semana."]]) +
    h2("Lo que ya tienes") +
    list([`${dot()}<b>Rutina del día</b> para el gym o la casa`, `${dot(C.ember)}<b>Racha y niveles</b> para no perder el ritmo`, `${dot(C.peel)}<b>Comida latina</b> con proteína y calorías claras, incluida en tu prueba gratis`, `${dot(C.ink)}<b>Coach Banana</b>, que conoce tus datos y responde tus dudas`]) +
    button("Armar mi plan", "/bienvenida");
  const reason = "Recibes este correo porque creaste una cuenta en Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, body, reason, tag: "Bienvenida", coach }),
    text: textLayout([`¡Hola, ${n}! Ya eres parte de Banana Burn.`, "", "Tus primeros 3 pasos:", "1. Arma tu plan (2 minutos)", "2. Haz tu primer entreno", "3. Registra tu peso", "", "Ya tienes: rutina del día con cargas calculadas, racha y niveles, Coach Banana, que conoce tus datos, y, en tu prueba gratis, comida latina con proteína y calorías claras.", "", `Arma tu plan: ${abs("/bienvenida")}`], undefined, reason, coach),
  };
}

/** `kcal` y `protein` solo llegan si la persona tiene nutrición (Entreno + Nutrición, prueba o beta); sin ellos se muestran los minutos. */
export function planListo(d: { name: string; trainDays: number; todayRoutine: string; kcal?: number; protein?: number; minutes?: number; startWeight?: number; goalWeight: number; goalDate: string }): Email {
  const n = firstName(d.name);
  const subject = `${n}, tu plan está listo: ${d.trainDays} días por semana`;
  const preheader = `Hoy arrancas con ${d.todayRoutine}. Meta: ${kg(d.goalWeight)} kg el ${longDate(d.goalDate)}.`;
  const coach = "En tu primera sesión calibramos las cargas juntos. Empieza cómodo: yo me encargo de subirlas cuando toque.";
  const goal: Goal = { start: d.startWeight, current: d.startWeight, goal: d.goalWeight, date: d.goalDate };
  const body = badge("Plan listo", C.banana) + h1(`${esc(n)}, tu plan está listo`) +
    p("Lo armamos con tus datos, tu meta y tus días disponibles. Esto es lo que viene:") +
    stats(d.kcal != null && d.protein != null ? [[`${d.trainDays}`, "días/semana"], [d.kcal.toLocaleString("es-419"), "kcal/día"], [`${d.protein} g`, "proteína"]] : [[`${d.trainDays}`, "días/semana"], ...(d.minutes ? [[`${d.minutes}`, "min/sesión"] as [string, string]] : []), [`${kg(d.goalWeight)} kg`, "meta"]]) +
    (d.startWeight ? goalCard(goal) : "") +
    rows([["Hoy te toca", d.todayRoutine], ...(d.startWeight ? [["Peso inicial", `${kg(d.startWeight)} kg`] as [string, string]] : []), ["Meta", `${kg(d.goalWeight)} kg`], ["Fecha meta", longDate(d.goalDate)]]) +
    p("Las cargas suben solas cuando dominas el rango de repeticiones. Tú solo llega y dale.") +
    button("Ver mi entreno de hoy", "/app/entreno");
  const reason = "Recibes este correo porque completaste tu perfil en Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, body, reason, tag: "Tu plan", coach }),
    text: textLayout([`Tu plan está listo, ${n}.`, "", `• ${d.trainDays} días por semana`, ...(d.kcal != null && d.protein != null ? [`• ${d.kcal.toLocaleString("es-419")} kcal/día y ${d.protein} g de proteína`] : d.minutes ? [`• ${d.minutes} min por sesión`] : []), `• Hoy te toca: ${d.todayRoutine}`, `• Meta: ${kg(d.goalWeight)} kg el ${longDate(d.goalDate)}`, "", `Ver mi entreno de hoy: ${abs("/app/entreno")}`], undefined, reason, coach),
  };
}

export type PaymentData = { name: string; plan: string; amount: number; currency?: string; date?: string; reference?: string; method?: string; nextCharge?: string | null };

export function reciboPago(d: PaymentData): Email {
  const n = firstName(d.name);
  const total = money(d.amount, d.currency);
  const subject = `Recibo de pago: ${d.plan} · ${total}`;
  const preheader = `Gracias, ${n}. Tu pago de ${total} se procesó correctamente.`;
  const coach = "Gracias por entrenar con nosotros. Ahora sí: a sacarle provecho a cada sesión.";
  const r: [string, string][] = [["Plan", d.plan], ["Total", total], ["Fecha", longDate(d.date ?? new Date().toISOString())]];
  if (d.method) r.push(["Método", d.method]);
  if (d.reference) r.push(["Referencia", d.reference]);
  if (d.nextCharge) r.push(["Próximo cobro", longDate(d.nextCharge)]);
  const body = badge("Pago confirmado", C.peel, "#FFFFFF") + h1("Pago recibido, gracias") + p(`Gracias, ${esc(n)}. Tu suscripción a <b>${esc(d.plan)}</b> está activa.`) + rows(r) +
    small("Guarda este correo como comprobante. ¿Necesitas factura? Responde a este correo con tus datos de facturación y te la enviamos.") + button("Ir a mi entreno", "/app");
  const reason = "Recibes este correo como comprobante de tu pago en Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, body, reason, tag: "Recibo", coach }),
    text: textLayout([`¡Pago recibido! Gracias, ${n}.`, "", ...r.map(([k, v]) => `${k}: ${v}`), "", "¿Necesitas factura? Responde a este correo con tus datos de facturación.", `Ir a la app: ${abs("/app")}`], undefined, "Comprobante de pago de Banana Burn.", coach),
  };
}

export function pagoFallido(d: PaymentData & { retryDate?: string | null; updateUrl?: string }): Email {
  const n = firstName(d.name);
  const total = money(d.amount, d.currency);
  const url = d.updateUrl ?? "/app/perfil";
  const subject = "No pudimos procesar tu pago. Se arregla en 1 minuto";
  const preheader = `Tu cobro de ${total} no pasó. Actualiza tu método de pago y sigues entrenando sin pausa.`;
  const coach = "Tranquilo: tu progreso y tus récords están a salvo. Lo arreglas en un minuto y seguimos.";
  const body = h1("Tu pago no pasó") +
    p(`Hola ${esc(n)}, intentamos cobrar <b>${total}</b> de tu plan <b>${esc(d.plan)}</b> y el banco no lo aprobó. Pasa seguido: tarjeta vencida, límite o bloqueo de compras en línea.`) +
    p(d.retryDate ? `Lo volveremos a intentar el <b>${esc(longDate(d.retryDate))}</b>. Mientras tanto mantienes tu acceso.` : "Mientras tanto mantienes tu acceso.") +
    button("Actualizar método de pago", url) + small("Puedes pagar con otra tarjeta de crédito o débito. ¿Dudas? Responde este correo.");
  const reason = "Recibes este correo porque hubo un problema con el pago de tu suscripción.";
  return {
    subject, preheader,
    html: layout({ preheader, body, reason, tag: "Pago", coach }),
    text: textLayout([`Hola ${n}, no pudimos cobrar ${total} de tu plan ${d.plan}.`, d.retryDate ? `Lo volveremos a intentar el ${longDate(d.retryDate)}. Mientras tanto mantienes tu acceso.` : "Mientras tanto mantienes tu acceso.", "", `Actualiza tu método de pago: ${abs(url)}`, "Aceptamos tarjetas de crédito y débito."], undefined, reason, coach),
  };
}

export function suscripcionCancelada(d: { name: string; plan: string; accessUntil?: string | null }): Email {
  const n = firstName(d.name);
  const subject = "Tu suscripción fue cancelada";
  const preheader = d.accessUntil ? `Mantienes acceso hasta el ${longDate(d.accessUntil)}. Tu progreso queda guardado.` : "Tu progreso queda guardado por si decides volver.";
  const coach = "Gracias por entrenar conmigo. La puerta queda abierta y tus récords te esperan.";
  const body = h1("Listo, cancelamos tu suscripción") +
    p(`${esc(n)}, confirmamos la cancelación de <b>${esc(d.plan)}</b>. No se harán más cobros.`) +
    (d.accessUntil ? p(`Sigues teniendo acceso completo hasta el <b>${esc(longDate(d.accessUntil))}</b>.`) : "") +
    p("Tus entrenos, récords y pesajes quedan guardados. Si vuelves, retomas exactamente donde ibas.") +
    p("¿Nos cuentas por qué te vas? Responde este correo; lo leemos todo y nos ayuda a mejorar.") + button("Reactivar mi plan", "/precios");
  const reason = "Recibes este correo como confirmación de un cambio en tu suscripción.";
  return {
    subject, preheader,
    html: layout({ preheader, body, reason, tag: "Suscripción", coach }),
    text: textLayout([`${n}, confirmamos la cancelación de ${d.plan}. No se harán más cobros.`, d.accessUntil ? `Mantienes acceso hasta el ${longDate(d.accessUntil)}.` : "", "Tus datos y progreso quedan guardados.", "", `Reactivar: ${abs("/precios")}`], undefined, reason, coach),
  };
}

/**
 * Regalo de meses (del equipo o por referidos). Transaccional: no lleva enlace de baja.
 * `message` es el mensaje personal que escribió el equipo (se escapa siempre).
 */
export function regalo(d: { name: string; months: number; plan: string; source: "regalo" | "referido"; startsAt: string; expiresAt: string; message?: string | null; startsNow: boolean }): Email {
  const n = firstName(d.name);
  const meses = `${d.months} ${d.months === 1 ? "mes" : "meses"}`;
  const subject = d.source === "referido" ? `Ganaste ${meses} gratis de ${d.plan}` : `${n}, te regalaron ${meses} de ${d.plan}`;
  const preheader = d.startsNow ? `Ya está activo hasta el ${longDate(d.expiresAt)}.` : `Empieza el ${longDate(d.startsAt)}, cuando termine el acceso que ya tienes.`;
  const intro = d.source === "referido"
    ? "Las personas que invitaste ya entrenan con Banana Burn. Gracias por compartir: este tiempo va por nuestra cuenta."
    : "El equipo de Banana Burn te hizo un regalo. No tienes que hacer nada: ya quedó en tu cuenta.";
  const coach = d.source === "referido" ? "Entrenar en grupo pega más fuerte. Gracias por traer a tu gente." : "Disfrútalo. Este tiempo lo entrenamos juntos.";
  const r: [string, string][] = [["Plan", d.plan], ["Tiempo", meses], ["Desde", longDate(d.startsAt)], ["Hasta", longDate(d.expiresAt)]];
  const body = badge(d.source === "referido" ? "Recompensa" : "Regalo", C.banana) + h1(esc(subject)) + p(esc(intro)) +
    (d.message ? `<blockquote style="margin:0 0 16px;padding:14px 16px;background:${C.soft};border-radius:16px;font-size:16px;line-height:1.6;color:${C.ink};">${esc(d.message)}</blockquote>` : "") +
    rows(r) + p(d.startsNow ? "Ya puedes usarlo. Sin cobros: al terminar, tu cuenta sigue como estaba." : "Se suma al final de tu acceso actual, así no pierdes ni un día. Sin cobros.") +
    button("Ver mi plan", "/app/suscripcion");
  const reason = "Recibes este correo porque se agregó tiempo gratis a tu cuenta de Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, body, reason, tag: d.source === "referido" ? "Recompensa" : "Regalo", coach }),
    text: textLayout([subject, "", intro, ...(d.message ? ["", `"${d.message}"`] : []), "", ...r.map(([k, v]) => `${k}: ${v}`), "", `Ver mi plan: ${abs("/app/suscripcion")}`], undefined, reason, coach),
  };
}

// ───────────── Ciclo de vida (llevan enlace de baja) ─────────────

export function recordatorio(d: { name: string; routine: string; mins?: number; exercises?: string[]; streak: number; goal?: Goal | null; unsubscribe: string }): Email {
  const n = firstName(d.name);
  const subject = `${n}, hoy te toca ${d.routine}: tus cargas ya están listas`;
  const gl = goalLine(d.goal);
  const preheader = d.streak >= 2 ? `Vas ${d.streak} días seguidos. Tus cargas de hoy ya están listas.` : gl ? `${gl}. Hoy sumas una sesión más.` : "Tus cargas de hoy ya están calculadas. Solo falta que llegues.";
  const ex = (d.exercises ?? []).slice(0, 5);
  const coach = d.streak >= 7 ? `${d.streak} días sin fallar. Eso ya no es motivación, es hábito.`
    : d.streak >= 2 ? `No rompas la cadena. Hoy vamos por el día ${d.streak + 1}.`
    : "Lo difícil es llegar. De lo demás me encargo yo.";
  const body = (d.streak >= 2 ? badge(`Racha de ${d.streak} días`, C.ember, "#FFFFFF") : "") +
    h1(`${esc(n)}, hoy te toca ${esc(d.routine)}`) +
    p(d.mins ? `Son unos <b>${d.mins} minutos</b>. Ya calculamos cuánto levantar en cada serie.` : "Ya calculamos cuánto levantar en cada serie.") +
    (ex.length ? h2("Tu sesión de hoy") + list(ex.map((e) => `${dot()}${esc(e)}`)) : "") +
    goalCard(d.goal) +
    button("Empezar entreno", "/app/entreno");
  const reason = "Recibes este recordatorio porque lo activaste en Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, body, unsubscribe: d.unsubscribe, reason, tag: "Entreno de hoy", coach }),
    text: textLayout([`${n}, hoy te toca ${d.routine}.`, d.mins ? `Unos ${d.mins} minutos. Tus cargas ya están calculadas.` : "Tus cargas ya están calculadas.", ...ex.map((e) => `• ${e}`), d.streak >= 2 ? `Racha: ${d.streak} días` : "", gl, "", `Empezar: ${abs("/app/entreno")}`], d.unsubscribe, reason, coach),
  };
}

export function rachaEnPeligro(d: { name: string; streak: number; unsubscribe: string }): Email {
  const n = firstName(d.name);
  const subject = `${n}, tu racha de ${d.streak} días sigue viva`;
  const preheader = "Con un check-in de 2 minutos la mantienes. Mañana vas por otro día.";
  const coach = "No dejes que la racha se enfríe. Dos minutos y la salvamos.";
  const body = badge(`Racha de ${d.streak} días`, C.ember, "#FFFFFF") + h1(`${d.streak} días seguidos, ${esc(n)}`) +
    p("Hoy todavía no registraste nada, y no hace falta un entreno para mantener la racha: un check-in cuenta.") +
    list([`${dot(C.ember)}Anota tus vasos de agua`, `${dot()}Registra tu peso`, `${dot(C.ink)}Cuéntanos cómo dormiste`]) +
    p(`Dos minutos y mañana vas por el día <b>${d.streak + 1}</b>.`) + button("Hacer mi check-in", "/app");
  const reason = "Recibes este aviso porque activaste los recordatorios de Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, body, unsubscribe: d.unsubscribe, reason, tag: "Racha", coach }),
    text: textLayout([`${d.streak} días seguidos, ${n}.`, "Un check-in rápido (agua, peso o sueño) mantiene tu racha.", `Mañana vas por el día ${d.streak + 1}.`, "", `Hacer mi check-in: ${abs("/app")}`], d.unsubscribe, reason, coach),
  };
}

export type WeeklyData = {
  name: string; workouts: number; planned: number; streak: number;
  kgStart?: number | null; kgEnd?: number | null; trendPerWeek?: number | null;
  prs: string[]; nextWeek: { day: string; name: string }[]; goal?: Goal | null; unsubscribe: string;
};

export function resumenSemanal(d: WeeklyData): Email {
  const n = firstName(d.name);
  const delta = d.kgStart != null && d.kgEnd != null ? Math.round((d.kgEnd - d.kgStart) * 10) / 10 : null;
  const kgLabel = delta == null ? "Sin pesaje" : delta === 0 ? "0.0 kg" : `${delta > 0 ? "+" : ""}${kg(delta)} kg`;
  const complete = d.workouts >= d.planned && d.planned > 0;
  const headline = complete ? `Semana completa: ${d.workouts}/${d.planned} entrenos` : d.workouts > 0 ? `${d.workouts} entrenos esta semana` : "Una semana nueva para arrancar";
  const subject = `${n}, tu semana: ${d.workouts} entrenos${delta != null ? ` · ${kgLabel}` : ""}`;
  const gl = goalLine(d.goal);
  const preheader = d.prs.length ? `${d.prs.length} récord${d.prs.length > 1 ? "s" : ""} personal${d.prs.length > 1 ? "es" : ""} y tu plan para esta semana.` : gl ? `${gl}. Mira lo que viene esta semana.` : "Tu progreso y lo que viene esta semana.";
  const coach = complete ? "Semana completa. Así se construyen los resultados: una sesión a la vez."
    : d.workouts > 0 ? "Buen trabajo. Esta semana vamos por una sesión más que la pasada."
    : "Semana nueva, página en blanco. Empezamos con la primera sesión y el resto llega solo.";
  const trend = d.trendPerWeek == null ? "" : d.trendPerWeek < 0 ? p(`Tu tendencia es <b>${kg(Math.abs(d.trendPerWeek), 2)} kg/semana</b> hacia abajo. Vas bien.`) : d.trendPerWeek > 0 ? p(`La báscula subió un poco (${kg(d.trendPerWeek, 2)} kg/semana). Es normal que fluctúe: lo que manda es la tendencia de varias semanas. Tu plan se ajusta solo.`) : p("Peso estable esta semana.");
  const body = (complete ? badge("Semana completa", C.banana) : "") + h1(esc(headline)) + p(`${esc(n)}, así te fue en los últimos 7 días:`) +
    stats([[d.planned ? `${d.workouts}/${d.planned}` : `${d.workouts}`, "entrenos"], [kgLabel, "peso"], [`${d.streak} días`, "racha"]]) + trend +
    goalCard(d.goal) +
    (d.prs.length ? h2("Récords personales") + list(d.prs.slice(0, 5).map((x) => `${dot(C.ember)}${esc(x)}`)) : "") +
    (d.nextWeek.length ? h2("Tu semana que viene") + list(d.nextWeek.map((x) => `${dot()}<b>${esc(x.day)}</b> · ${esc(x.name)}`)) : "") +
    button("Ver mi progreso", "/app/progreso");
  const reason = "Recibes el resumen semanal porque lo activaste en Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, body, unsubscribe: d.unsubscribe, reason, tag: "Resumen semanal", coach }),
    text: textLayout([headline, "", `Entrenos: ${d.planned ? `${d.workouts}/${d.planned}` : d.workouts}`, `Peso: ${kgLabel}`, `Racha: ${d.streak} días`, ...(gl ? [gl] : []), ...(d.prs.length ? ["", "Récords:", ...d.prs.slice(0, 5).map((x) => `• ${x}`)] : []), ...(d.nextWeek.length ? ["", "Esta semana:", ...d.nextWeek.map((x) => `• ${x.day}: ${x.name}`)] : []), "", `Ver mi progreso: ${abs("/app/progreso")}`], d.unsubscribe, reason, coach),
  };
}

export function reactivacion(d: { name: string; days: 3 | 7; routine: string; trainingDay: boolean; goal?: Goal | null; unsubscribe: string }): Email {
  const n = firstName(d.name);
  const three = d.days === 3;
  const subject = three ? `Te guardamos el lugar, ${n}` : `${n}, empezamos de nuevo, sin presión`;
  const gl = goalLine(d.goal);
  const preheader = three ? "Volver es más fácil con una sesión corta. Tu plan sigue igualito." : gl ? `Tu meta sigue en pie. ${gl}.` : "Tus datos y tu plan siguen aquí. 20 minutos hoy y arrancamos.";
  const today = d.trainingDay ? `Hoy te toca <b>${esc(d.routine)}</b>.` : "Hoy es día de descanso activo: una caminata y 10 minutos de estiramiento cuentan.";
  const coach = "Sin culpa. Haz solo los dos primeros ejercicios: casi siempre terminas la sesión.";
  const body = h1(three ? `Te guardamos el lugar, ${esc(n)}` : "Empezamos de nuevo, sin presión") +
    p(three ? "La vida pasa, y está bien. Lo que importa es la siguiente sesión, no las que quedaron atrás." : "Una semana fuera no borra nada: tus récords, tu historial y tu plan siguen aquí.") +
    p(today) + goalCard(d.goal) +
    button(d.trainingDay ? "Volver con una sesión corta" : "Hacer mi check-in", d.trainingDay ? "/app/entreno" : "/app");
  const reason = "Recibes este correo porque tienes activados los recordatorios de Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, body, unsubscribe: d.unsubscribe, reason, tag: "Tu plan te espera", coach }),
    text: textLayout([subject, "", three ? "La vida pasa, y está bien. Lo que importa es la siguiente sesión." : "Tus récords, tu historial y tu plan siguen aquí.", d.trainingDay ? `Hoy te toca ${d.routine}.` : "Hoy: caminata y 10 minutos de estiramiento.", gl, "", `Volver: ${abs(d.trainingDay ? "/app/entreno" : "/app")}`], d.unsubscribe, reason, coach),
  };
}

// ───────────── Supabase Auth (se pegan en el panel de Supabase) ─────────────
// Se generan con `npm run emails:auth` → supabase/templates/*.html. Usan las variables de Supabase
// ({{ .SiteURL }}, {{ .Token }}, {{ .TokenHash }}, {{ .NewEmail }}), no datos de la app.

export type AuthTemplate = { file: string; supabase: string; subject: string; html: string };

export function authTemplates(): AuthTemplate[] {
  const site = "{{ .SiteURL }}";
  const link = (type: string, next = "/app") => `${site}/auth/callback?token_hash={{ .TokenHash }}&type=${type}${next ? `&next=${next}` : ""}`;
  const safe = (what: string) => small(`El código vence en 1 hora. Si no ${what}, ignora este correo: nadie puede entrar a tu cuenta sin él.`);
  const make = (file: string, supabase: string, subject: string, tag: string, body: string, coach: string, reason: string): AuthTemplate =>
    ({ file, supabase, subject, html: layout({ preheader: subject, body, reason, tag, coach, site }) });
  return [
    make("magic-link.html", "Magic Link", "Tu código para entrar a Banana Burn", "Acceso",
      h1("Tu código para entrar") + p("Escríbelo en Banana Burn y sigues donde te quedaste.") + codeBox("{{ .Token }}") +
        button("O entra con un toque", link("email")) + safe("pediste entrar a Banana Burn"),
      "Te espero adentro. Tu entreno de hoy ya está listo.", "Recibes este correo porque pediste entrar a Banana Burn con esta dirección."),
    make("confirm-signup.html", "Confirm signup", "Tu código para crear tu cuenta en Banana Burn", "Bienvenida",
      `<div style="text-align:center;margin:0 0 6px;"><img src="${site}/email/mascota.png" width="100" height="160" alt="Coach Banana" style="display:inline-block;width:100px;height:160px;border:0;"></div>` +
        h1("Ya casi eres parte de Banana Burn") + p("Escribe este código para crear tu cuenta y armar tu plan en 2 minutos.") + codeBox("{{ .Token }}") +
        button("O confirma con un toque", link("signup")) + safe("creaste una cuenta en Banana Burn"),
      "Soy tu Coach Banana. Confirma y empezamos a entrenar hoy mismo.", "Recibes este correo porque alguien creó una cuenta en Banana Burn con esta dirección."),
    make("reset-password.html", "Reset Password", "Crea tu nueva contraseña de Banana Burn", "Seguridad",
      h1("Crea tu nueva contraseña") + p("Pediste cambiar tu contraseña de Banana Burn. Toca el botón para crear una nueva.") +
        button("Crear mi nueva contraseña", link("recovery", "")) + small("El enlace vence en 1 hora. Si no pediste el cambio, ignora este correo: tu contraseña actual sigue igual."),
      "Tus récords están a salvo. Cambias la clave y seguimos entrenando.", "Recibes este correo porque se pidió cambiar la contraseña de tu cuenta de Banana Burn."),
    make("change-email.html", "Change Email Address", "Confirma tu nuevo correo en Banana Burn", "Seguridad",
      h1("Confirma tu nuevo correo") + p("Pediste cambiar el correo de tu cuenta de <b>{{ .Email }}</b> a <b>{{ .NewEmail }}</b>.") + codeBox("{{ .Token }}") +
        button("Confirmar el cambio", link("email_change", "/app/perfil")) + small("Si no pediste este cambio, ignora este correo y escríbenos a " + SUPPORT + ". Tu cuenta sigue con el correo actual."),
      "Mismo progreso, nuevo correo. Nada de tu historial se pierde.", "Recibes este correo porque se pidió cambiar el correo de tu cuenta de Banana Burn."),
    make("reauthentication.html", "Reauthentication", "Tu código de seguridad de Banana Burn", "Seguridad",
      h1("Confirma que eres tú") + p("Escribe este código para terminar el cambio que estás haciendo en tu cuenta.") + codeBox("{{ .Token }}") +
        safe("estás haciendo cambios en tu cuenta"),
      "Es solo un paso de seguridad. Tu cuenta, tus reglas.", "Recibes este correo porque se pidió un código de seguridad para tu cuenta de Banana Burn."),
  ];
}
