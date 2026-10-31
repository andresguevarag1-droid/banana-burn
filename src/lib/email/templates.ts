// Plantillas de correo Banana Burn: HTML con estilos en línea (compatible con Gmail/Outlook/iOS Mail),
// en español latino neutro, con versión de texto plano para cada una.
//
// Sigue el libro de marca (Design System "Banana Burn"):
// - Encabezado blanco con el icono y el logotipo escrito: "Banana" en ink y "Burn" en ember-ink.
// - Héroe en banana de verdad (el amarillo es el fondo de los momentos importantes); encima, texto ink.
// - Botón principal ink con texto blanco; botón banana con texto ink solo para la acción de entreno.
// - Eyebrows de 12 px en mayúsculas con tracking .14em; chips activos ink con texto banana.
// - Tarjeta destacada en ink con barra (pista blanca al 14 %, relleno banana); celdas de números en cream.
// - Cifras es-419 de la marca ($9.99 · 2.5 kg · 1,200) con tabular-nums. Sin emojis, sin "·" en el texto, sin IA.
// - Coach Banana firma cada correo; nunca se repite la misma pose de la mascota en un correo.
// Los correos no transaccionales llevan enlace de baja; los transaccionales (bienvenida, plan, pagos) no lo necesitan.
import { SITE_URL } from "../env";
import { nfmt, usd2 } from "../num";
import { ANNUAL_SEASON_NOTE, BETA_GRACE_UNTIL, PLANS, annualSaving } from "../plans";
import { PROMO_PCT, promoPrice } from "../trial";

export type Email = { subject: string; preheader: string; html: string; text: string };

/** Tokens del libro de marca (project/tokens.json). `track` = ink + blanco al 14 % (sin rgba: Outlook). */
const C = {
  paper: "#FFF8E3", cream: "#FFFBF0", card: "#FFFFFF", banana: "#FFD60A", soft: "#FFF1A8", ink: "#1B1505", body: "#2E2818",
  muted: "#6A604B", faint: "#766A52", line: "#EDE3C6", bananaInk: "#8A6200", ember: "#F2A100", emberInk: "#8A5300",
  peel: "#3F6B0E", onInk: "#FFFBF0", onInkSoft: "#E9E1C9", track: "#3B3628",
};
const FONT = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const NUMS = "font-variant-numeric:tabular-nums;";
const SUPPORT = "hola@bananaburn.app";

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Absoluta: deja pasar URLs completas, mailto y variables de plantilla de Supabase ({{ .SiteURL }}). */
const abs = (path: string, site = SITE_URL) => (/^(https?:|mailto:|\{\{)/.test(path) ? path : `${site}${path}`);
const firstName = (n: string) => (n || "").trim().split(/\s+/)[0] || "crack";

/** Cifras como pide la marca (es-419): punto decimal y coma de miles (1,200 · 2.5). */
const num = nfmt;
const kg = (n: number, max = 1) => num(n, max);

/** $9.99 para USD; otras monedas con su código delante. */
export const money = (amount: number, currency = "USD") => `${currency === "USD" ? "$" : `${currency} `}${num(amount, 2, 2)}`;
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

/** Una línea para texto plano y push: "Te faltan 6.2 kg para tus 85 kg". */
export function goalLine(g: Goal | null | undefined): string {
  const pr = goalProgress(g);
  if (!g || !pr) return "";
  if (pr.reached) return `Llegaste a tu meta de ${kg(g.goal)} kg`;
  return `Te faltan ${kg(pr.left)} kg para tus ${kg(g.goal)} kg${g.date ? ` (${longDate(g.date)})` : ""}`;
}

// ───────────── Bloques ─────────────
const p = (html: string) => `<p style="margin:0 0 14px;font-size:16px;line-height:24px;color:${C.body};">${html}</p>`;
const small = (html: string) => `<p style="margin:0 0 12px;font-size:14px;line-height:20px;color:${C.muted};">${html}</p>`;
/** Eyebrow de la marca: 12 px, bold, mayúsculas, tracking .14em. En banana-ink sobre claro; en ink sobre banana. */
const eyebrow = (label: string, color: string = C.bananaInk) =>
  `<p style="margin:22px 0 8px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${color};">${esc(label)}</p>`;

type BtnKind = "primary" | "banana";
/** Botón en píldora de 48 px. `primary`: ink con texto blanco. `banana`: solo para la acción de entreno, texto ink. */
const button = (label: string, href: string, kind: BtnKind = "primary", site = SITE_URL) => {
  const bg = kind === "banana" ? C.banana : C.ink, fg = kind === "banana" ? C.ink : "#FFFFFF";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px;"><tr><td style="border-radius:999px;background:${bg};">` +
    `<a href="${esc(abs(href, site))}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:600;color:${fg};text-decoration:none;border-radius:999px;">${esc(label)}</a></td></tr></table>`;
};

/** Celdas de números: cream con borde line, cifra 800 en ink. */
const stats = (items: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;"><tr>` +
  items.map(([v, l]) => `<td width="${Math.floor(100 / items.length)}%" style="padding:4px;"><div style="background:${C.cream};border:1px solid ${C.line};border-radius:16px;padding:14px 8px;text-align:center;">` +
    `<div style="font-size:22px;line-height:24px;font-weight:800;color:${C.ink};white-space:nowrap;${NUMS}">${esc(v)}</div><div style="font-size:12px;line-height:16px;color:${C.muted};margin-top:4px;">${esc(l)}</div></div></td>`).join("") +
  `</tr></table>`;

/** Viñeta de marca: punto de color (los correos no muestran íconos SVG de forma confiable y no usamos emojis). */
const dot = (color: string = C.banana) => `<span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${color};margin-right:10px;vertical-align:middle;"></span>`;

/** Chip activo de la marca: ink con texto banana (va sobre el héroe banana). */
const chip = (label: string) =>
  `<span style="display:inline-block;background:${C.ink};color:${C.banana};border-radius:999px;padding:6px 12px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.02em;">${esc(label)}</span>`;

const list = (items: string[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">` +
  items.map((i) => `<tr><td style="padding:10px 4px;border-bottom:1px solid ${C.line};font-size:15px;line-height:22px;color:${C.body};">${i}</td></tr>`).join("") + `</table>`;

/** Pasos numerados (un proceso real: onboarding). Número banana sobre ink. */
const steps = (items: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">` +
  items.map(([t, d], i) => `<tr><td width="42" style="padding:8px 12px 8px 0;vertical-align:top;"><div style="width:30px;height:30px;line-height:30px;border-radius:15px;background:${C.ink};color:${C.banana};font-size:14px;font-weight:800;text-align:center;${NUMS}">${i + 1}</div></td>` +
    `<td style="padding:8px 0;vertical-align:top;"><div style="font-size:15px;line-height:20px;font-weight:800;color:${C.ink};">${esc(t)}</div><div style="font-size:14px;line-height:20px;color:${C.muted};">${esc(d)}</div></td></tr>`).join("") + `</table>`;

/** Tabla de datos (recibos, regalos): tarjeta card con borde line. */
const rows = (items: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;border:1px solid ${C.line};border-radius:16px;border-collapse:separate;">` +
  items.map(([k, v], i) => `<tr><td style="padding:12px 14px;font-size:14px;line-height:20px;color:${C.muted};${i ? `border-top:1px solid ${C.line};` : ""}">${esc(k)}</td><td align="right" style="padding:12px 14px;font-size:14px;line-height:20px;font-weight:700;color:${C.ink};${NUMS}${i ? `border-top:1px solid ${C.line};` : ""}">${esc(v)}</td></tr>`).join("") + `</table>`;

/** Barra de la marca sobre ink: pista blanca al 14 %, relleno banana (tabla de dos celdas: funciona en Outlook). */
const bar = (pct: number) => {
  const done = Math.max(0, Math.min(100, Math.round(pct)));
  const cell = (w: number, bg: string) => `<td width="${w}%" style="height:8px;line-height:8px;font-size:0;background:${bg};">&nbsp;</td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:999px;overflow:hidden;margin:14px 0 4px;"><tr>` +
    (done > 0 ? cell(done, C.banana) : "") + (done < 100 ? cell(100 - done, C.track) : "") + `</tr></table>`;
};

/** Tarjeta destacada en ink con la meta de peso y su avance (como "Tus números de hoy"). Vacía si no hay meta. */
function goalCard(g: Goal | null | undefined) {
  const pr = goalProgress(g);
  if (!g || !pr) return "";
  const right = pr.reached ? `<b style="color:${C.banana};">Meta cumplida</b>` : `te faltan <b style="color:${C.banana};${NUMS}">${kg(pr.left)} kg</b>`;
  const foot = pr.reached ? "Ahora toca sostenerla. Tu plan se ajusta a mantenimiento."
    : pr.moved > 0 ? `Ya llevas ${kg(pr.moved)} kg ${pr.losing ? "menos" : "más"} desde que empezaste.` : g.date ? `Fecha meta: ${longDate(g.date)}.` : "Cada sesión te acerca.";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;"><tr><td style="background:${C.ink};border-radius:24px;padding:20px 22px;">` +
    `<div style="font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${C.banana};">Tu meta</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;"><tr>` +
    `<td style="vertical-align:bottom;font-size:32px;line-height:36px;font-weight:800;color:#FFFFFF;letter-spacing:-0.02em;${NUMS}">${kg(g.goal)} kg</td>` +
    `<td align="right" style="vertical-align:bottom;font-size:14px;line-height:20px;color:${C.onInkSoft};">${right}</td></tr></table>` +
    bar(pr.pct) + `<div style="font-size:14px;line-height:20px;color:${C.onInkSoft};margin-top:8px;">${esc(foot)}</div></td></tr></table>`;
}

/** Código de acceso: tarjeta ink, eyebrow banana, cifras blancas. */
const codeBox = (token: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 6px;"><tr><td align="center" style="background:${C.ink};border-radius:24px;padding:20px 12px;">` +
  `<div style="font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${C.banana};">Tu código</div>` +
  `<div style="margin-top:8px;font-family:${FONT};font-size:36px;line-height:40px;font-weight:800;letter-spacing:0.24em;color:#FFFFFF;${NUMS}">${token}</div></td></tr></table>`;

/** Firma de Coach Banana. `avatar=false` cuando la mascota ya aparece en el héroe (nunca la misma pose dos veces). */
const coachNote = (line: string, site: string, avatar = true) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;"><tr><td style="background:${C.cream};border:1px solid ${C.line};border-radius:24px;padding:14px 16px;">` +
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
  (avatar ? `<td width="60" style="vertical-align:top;padding-right:12px;"><img src="${esc(site)}/email/coach.png" width="48" height="48" alt="Coach Banana" style="display:block;width:48px;height:48px;border:0;border-radius:24px;"></td>` : "") +
  `<td style="vertical-align:top;"><div style="font-size:15px;line-height:22px;color:${C.body};">${line}</div><div style="margin-top:4px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${C.bananaInk};">Coach Banana</div></td>` +
  `</tr></table></td></tr></table>`;

/** Héroe banana: eyebrow ink, chip opcional, título 800 y bajada en body. `mascot` pone a Coach Banana a la derecha. */
type Hero = { eyebrow: string; title: string; lead?: string; chip?: string; mascot?: boolean };

function heroBlock(h: Hero, site: string) {
  const text = `<p style="margin:0 0 10px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${C.ink};">${esc(h.eyebrow)}</p>` +
    (h.chip ? `<p style="margin:0 0 12px;">${chip(h.chip)}</p>` : "") +
    `<h1 style="margin:0;font-family:${FONT};font-size:30px;line-height:34px;font-weight:800;color:${C.ink};letter-spacing:-0.02em;">${h.title}</h1>` +
    (h.lead ? `<p style="margin:12px 0 0;font-size:16px;line-height:24px;color:${C.body};">${h.lead}</p>` : "");
  const art = h.mascot ? `<td width="112" align="right" style="vertical-align:bottom;padding-left:8px;"><img src="${esc(site)}/email/mascota.png" width="104" height="166" alt="Coach Banana" style="display:block;width:104px;height:166px;border:0;"></td>` : "";
  return `<tr><td style="background:${C.banana};padding:26px 24px ${h.mascot ? "0" : "26px"};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:${h.mascot ? "middle" : "top"};padding-bottom:${h.mascot ? "22px" : "0"};">${text}</td>${art}</tr></table></td></tr>`;
}

type LayoutOpts = { preheader: string; hero: Hero; body: string; reason: string; coach?: string; unsubscribe?: string; site?: string };

function layout(o: LayoutOpts) {
  const site = o.site ?? SITE_URL;
  const a = (label: string, href: string) => `<a href="${esc(abs(href, site))}" style="color:${C.muted};text-decoration:underline;">${label}</a>`;
  const gap = "&nbsp;&nbsp;&nbsp;";
  const links = `${a("Abrir la app", "/app")}${gap}${a("Mi progreso", "/app/progreso")}${gap}${a("Ayuda", `mailto:${SUPPORT}`)}`;
  const reason = o.unsubscribe
    ? `${esc(o.reason)}<br>${a("Dejar de recibir estos correos", o.unsubscribe)}${gap}${a("Ajustar avisos", "/app/perfil#notificaciones")}`
    : esc(o.reason);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><meta name="x-apple-disable-message-reformatting"><title>Banana Burn</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${C.paper};font-family:${FONT};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(o.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};"><tr><td align="center" style="padding:24px 12px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${C.card};border:1px solid ${C.line};border-radius:24px;border-collapse:separate;overflow:hidden;box-shadow:0 1px 2px rgba(27,21,5,0.04),0 8px 24px -8px rgba(27,21,5,0.10);">
<tr><td style="padding:18px 24px;"><a href="${esc(abs("/", site))}" style="text-decoration:none;"><img src="${esc(site)}/icons/icon-192.png" width="36" height="36" alt="" style="display:inline-block;width:36px;height:36px;border:0;border-radius:10px;vertical-align:middle;"><span style="vertical-align:middle;margin-left:10px;font-family:${FONT};font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${C.ink};">Banana <span style="color:${C.emberInk};">Burn</span></span></a></td></tr>
${heroBlock(o.hero, site)}
<tr><td style="padding:26px 24px 24px;">${o.body}${o.coach ? coachNote(o.coach, site, !o.hero.mascot) : ""}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;"><tr><td style="padding:20px 12px 0;font-size:12px;line-height:20px;color:${C.faint};text-align:center;">${links}<br>${reason}<br>Banana Burn, tu entrenador personal en el celular. Atlas Resources SRL.</td></tr></table>
</td></tr></table></body></html>`;
}

function textLayout(lines: string[], unsubscribe?: string, reason?: string, coach?: string) {
  const out = [...lines];
  if (coach) out.push("", `"${coach.replace(/<[^>]+>/g, "")}"`, "Coach Banana");
  out.push("", "-- ", "Banana Burn, tu entrenador personal en el celular", `Ayuda: ${SUPPORT}`);
  if (reason) out.push(reason);
  if (unsubscribe) out.push(`Dejar de recibir estos correos: ${unsubscribe}`);
  return out.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

// ───────────── Transaccionales ─────────────

export function bienvenida(d: { name: string }): Email {
  const n = firstName(d.name);
  const subject = `${n}, tu entrenador personal ya está listo`;
  const preheader = "Arma tu plan en 2 minutos y entrena hoy mismo con cargas calculadas para ti.";
  const coach = "Yo calculo las cargas y ajusto tu plan cada semana. Tú solo llega y dale.";
  const hero: Hero = { eyebrow: "Bienvenida", title: `Hola, ${esc(n)}. Ya eres parte de Banana Burn`, lead: "Tu entrenador personal en el celular: qué entrenar hoy, con cuánto peso y cómo hacer cada movimiento.", mascot: true };
  const body =
    eyebrow("Tus primeros 3 pasos").replace("margin:22px", "margin:0") +
    steps([["Arma tu plan", "Meta, días y equipo. Te toma 2 minutos."], ["Haz tu primer entreno", "Te guiamos serie por serie, con descanso y técnica."], ["Registra tu peso", "Así medimos tu avance real cada semana."]]) +
    eyebrow("Lo que ya tienes") +
    list([`${dot()}<b>Rutina del día</b> para el gym o la casa`, `${dot(C.ember)}<b>Racha y niveles</b> para no perder el ritmo`, `${dot(C.peel)}<b>Comida latina</b> con proteína y calorías claras, incluida en tu prueba gratis`, `${dot(C.ink)}<b>Coach Banana</b>, que conoce tus datos y responde tus dudas de entreno`]) +
    button("Armar mi plan", "/bienvenida");
  const reason = "Recibes este correo porque creaste una cuenta en Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, hero, body, reason, coach }),
    text: textLayout([`Hola, ${n}. Ya eres parte de Banana Burn.`, "", "Tus primeros 3 pasos:", "1. Arma tu plan (2 minutos)", "2. Haz tu primer entreno", "3. Registra tu peso", "", "Ya tienes: rutina del día con cargas calculadas, racha y niveles, Coach Banana, que conoce tus datos, y, en tu prueba gratis, comida latina con proteína y calorías claras.", "", `Arma tu plan: ${abs("/bienvenida")}`], undefined, reason, coach),
  };
}

/** `kcal` y `protein` solo llegan si la persona tiene nutrición (Entreno + Nutrición, prueba o beta); sin ellos se muestran los minutos. */
export function planListo(d: { name: string; trainDays: number; todayRoutine: string; kcal?: number; protein?: number; minutes?: number; startWeight?: number; goalWeight: number; goalDate: string }): Email {
  const n = firstName(d.name);
  const subject = `${n}, tu plan está listo: ${d.trainDays} días por semana`;
  const preheader = `Hoy arrancas con ${d.todayRoutine}. Meta: ${kg(d.goalWeight)} kg el ${longDate(d.goalDate)}.`;
  const coach = "En tu primera sesión calibramos las cargas. Empieza cómodo: si completas tus repeticiones, la próxima vez sube.";
  const goal: Goal = { start: d.startWeight, current: d.startWeight, goal: d.goalWeight, date: d.goalDate };
  const hero: Hero = { eyebrow: "Tu plan", chip: "Plan listo", title: `${esc(n)}, tu plan está listo`, lead: `Lo armamos con tus datos, tu meta y tus días. Hoy te toca <b>${esc(d.todayRoutine)}</b>.` };
  const body =
    stats(d.kcal != null && d.protein != null ? [[`${d.trainDays}`, "días por semana"], [num(d.kcal, 0), "kcal al día"], [`${d.protein} g`, "proteína"]] : [[`${d.trainDays}`, "días por semana"], ...(d.minutes ? [[`${d.minutes} min`, "por sesión"] as [string, string]] : []), [`${kg(d.goalWeight)} kg`, "meta"]]) +
    (d.startWeight ? goalCard(goal) : "") +
    rows([["Hoy te toca", d.todayRoutine], ...(d.startWeight ? [["Peso inicial", `${kg(d.startWeight)} kg`] as [string, string]] : []), ["Meta", `${kg(d.goalWeight)} kg`], ["Fecha meta", longDate(d.goalDate)]]) +
    p("Las cargas suben solas cuando dominas el rango de repeticiones. Tú solo llega y entrena.") +
    button("Empezar entreno", "/app/entreno", "banana");
  const reason = "Recibes este correo porque completaste tu perfil en Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, hero, body, reason, coach }),
    text: textLayout([`Tu plan está listo, ${n}.`, "", `• ${d.trainDays} días por semana`, ...(d.kcal != null && d.protein != null ? [`• ${num(d.kcal, 0)} kcal al día y ${d.protein} g de proteína`] : d.minutes ? [`• ${d.minutes} min por sesión`] : []), `• Hoy te toca: ${d.todayRoutine}`, `• Meta: ${kg(d.goalWeight)} kg el ${longDate(d.goalDate)}`, "", `Empezar entreno: ${abs("/app/entreno")}`], undefined, reason, coach),
  };
}

export type PaymentData = { name: string; plan: string; amount: number; currency?: string; date?: string; reference?: string; method?: string; nextCharge?: string | null;
  /** 0043: primer mes con 50 %. Precio normal (USD) que se cobra desde el siguiente mes. */
  promoFull?: number | null };

export function reciboPago(d: PaymentData): Email {
  const n = firstName(d.name);
  const total = money(d.amount, d.currency);
  const subject = `Recibo de pago: ${d.plan}, ${total}`;
  const preheader = `Gracias, ${n}. Tu pago de ${total} se procesó correctamente.`;
  const coach = "Gracias por entrenar con nosotros. Ahora a sacarle provecho a cada sesión.";
  const r: [string, string][] = [["Plan", d.plan], ["Total", total], ["Fecha", longDate(d.date ?? new Date().toISOString())]];
  if (d.method) r.push(["Método", d.method]);
  if (d.reference) r.push(["Referencia", d.reference]);
  if (d.promoFull) r.push(["Descuento", "Primer mes con 50 % de descuento"]);
  if (d.nextCharge) r.push(["Próximo cobro", d.promoFull ? `${longDate(d.nextCharge)}, ${money(d.promoFull, d.currency)} (precio normal)` : longDate(d.nextCharge)]);
  const hero: Hero = { eyebrow: "Recibo", chip: "Pago confirmado", title: "Pago recibido, gracias", lead: `${esc(n)}, tu suscripción a <b>${esc(d.plan)}</b> está activa.` };
  const body = rows(r) +
    small("Guarda este correo como comprobante. ¿Necesitas factura? Responde a este correo con tus datos de facturación y te la enviamos.") + button("Ir a mi entreno", "/app/entreno", "banana");
  const reason = "Recibes este correo como comprobante de tu pago en Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, hero, body, reason, coach }),
    text: textLayout([`Pago recibido. Gracias, ${n}.`, "", ...r.map(([k, v]) => `${k}: ${v}`), "", "¿Necesitas factura? Responde a este correo con tus datos de facturación.", `Ir a la app: ${abs("/app")}`], undefined, "Comprobante de pago de Banana Burn.", coach),
  };
}

/** `paused`: el acceso queda en pausa mientras tanto (primer cobro después de la prueba). Si no, se mantiene (renovación). */
export function pagoFallido(d: PaymentData & { retryDate?: string | null; updateUrl?: string; paused?: boolean }): Email {
  const n = firstName(d.name);
  const total = money(d.amount, d.currency);
  const url = d.updateUrl ?? "/app/perfil";
  const subject = d.paused ? "No pudimos cobrar tu plan. Cambia tu tarjeta para seguir" : "No pudimos procesar tu pago. Se arregla en 1 minuto";
  const preheader = d.paused ? `Tu cobro de ${total} no pasó. Tu acceso queda en pausa hasta que se pague; tu progreso sigue guardado.` : `Tu cobro de ${total} no pasó. Actualiza tu método de pago y sigues entrenando sin pausa.`;
  const meanwhile = d.paused ? "Mientras tanto tu acceso queda en pausa. No se borra nada: tu plan y tu progreso siguen guardados." : "Mientras tanto mantienes tu acceso.";
  const retry = d.retryDate ? `Lo volveremos a intentar una vez el ${longDate(d.retryDate)}.` : d.paused ? "No haremos más intentos automáticos." : "";
  const coach = "Tu progreso y tus récords están a salvo. Lo arreglas en un minuto y seguimos.";
  const hero: Hero = { eyebrow: "Pago", title: d.paused ? "No pudimos cobrar tu plan" : "Tu pago no pasó", lead: `${esc(n)}, intentamos cobrar <b>${total}</b> de tu plan <b>${esc(d.plan)}</b> y el banco no lo aprobó.` };
  const body =
    p("Pasa seguido: tarjeta vencida, límite o bloqueo de compras en línea.") +
    p(`${retry ? `<b>${esc(retry)}</b> ` : ""}${esc(meanwhile)}`) +
    button(d.paused ? "Cambiar mi tarjeta" : "Actualizar método de pago", url) + small("Puedes pagar con otra tarjeta de crédito o débito. ¿Dudas? Responde este correo.");
  const reason = "Recibes este correo porque hubo un problema con el pago de tu suscripción.";
  return {
    subject, preheader,
    html: layout({ preheader, hero, body, reason, coach }),
    text: textLayout([`Hola ${n}, no pudimos cobrar ${total} de tu plan ${d.plan}.`, [retry, meanwhile].filter(Boolean).join(" "), "", `${d.paused ? "Cambia tu tarjeta" : "Actualiza tu método de pago"}: ${abs(url)}`, "Aceptamos tarjetas de crédito y débito."], undefined, reason, coach),
  };
}

/** Datos del primer cobro programado (prueba de 7 días o fin de la beta). */
export type ChargeMailData = { name: string; plan: string; amount: number; currency?: string; chargeAt: string; kind: "prueba" | "beta" | "inmediato"; card?: string | null;
  /** 0043: el primer cobro lleva el 50 % del primer mes (plan mensual). */
  promo?: boolean;
  /** El cobro se movió: "tester" (al final del mes de tester) o "ajustado" (ya no está en su fecha original). */
  moved?: "tester" | "ajustado" | null };

/** Al guardar la tarjeta: confirma que hoy no se cobra, cuánto y cuándo se cobra, y cómo cancelar. Transaccional. */
export function pruebaIniciada(d: ChargeMailData): Email {
  const n = firstName(d.name);
  const total = money(d.amount, d.currency);
  const when = longDate(d.chargeAt);
  const beta = d.kind === "beta";
  const what = d.promo ? `tu primer mes con 50 % de descuento (${total})` : `tu plan (${total})`;
  const subject = d.promo ? `Tarjeta lista: tu primer mes con 50 % se cobra el ${when}` : `Tarjeta lista: tu plan se cobra el ${when}`;
  const preheader = `Hoy no te cobramos. El ${when} se cobra ${what}, salvo que canceles antes.`;
  const r: [string, string][] = [["Plan", d.plan], ["Hoy", money(0, d.currency)], ["Se cobra el", when], ["Monto", d.promo ? `${total}, primer mes con 50 % de descuento` : total]];
  if (d.card) r.push(["Tarjeta", d.card]);
  const hero: Hero = { eyebrow: "Tarjeta lista", ...(d.promo ? { chip: "50 % el primer mes" } : {}), title: `${esc(n)}, tu tarjeta quedó lista`, lead: `Hoy no te cobramos. ${beta ? "Sigues con todo incluido hasta el día del cobro." : "Sigues con todo incluido hasta que termine tu prueba gratis."} El <b>${esc(when)}</b> se cobra ${esc(what)}, salvo que canceles antes.` };
  const body = rows(r) + p("Te avisaremos 2 días antes del cobro. Para cancelar sin costo entra a Mi plan antes de esa fecha: no se cobra nada y conservas el acceso hasta el final de la prueba.") +
    button("Ver mi plan", "/app/suscripcion");
  const reason = "Recibes este correo porque guardaste una tarjeta en Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, hero, body, reason }),
    text: textLayout([subject, "", `Hoy no te cobramos. El ${when} se cobra ${what}, salvo que canceles antes.`, "", ...r.map(([k, v]) => `${k}: ${v}`), "", "Te avisaremos 2 días antes. Cancela sin costo desde Mi plan antes de esa fecha.", `Ver mi plan: ${abs("/app/suscripcion")}`], undefined, reason),
  };
}

/** Día 5: aviso de que en 2 días se cobra el plan. Transaccional (importa para la honestidad y para evitar contracargos). */
export function recordatorioCobro(d: ChargeMailData): Email {
  const n = firstName(d.name);
  const total = money(d.amount, d.currency);
  const when = longDate(d.chargeAt);
  const beta = d.kind === "beta" || !!d.moved;
  const line = d.promo ? `En 2 días se cobra tu primer mes con 50 % de descuento: ${total}, el ${when}. Puedes cancelar sin costo antes de esa fecha.`
    : d.moved === "tester" ? `Tu mes de tester termina en 2 días. El ${when} se cobra tu plan de ${total}. Puedes cancelar sin costo antes de esa fecha.`
    : beta ? `En 2 días se cobra tu plan de ${total}, el ${when}. Puedes cancelar sin costo antes de esa fecha.` : `En 2 días se cobra tu plan de ${total}. Puedes cancelar sin costo hasta el día 7.`;
  const subject = `En 2 días se cobra tu plan de ${total}`;
  const r: [string, string][] = [["Plan", d.plan], ["Se cobra el", when], ["Monto", total]];
  if (d.card) r.push(["Tarjeta", d.card]);
  const hero: Hero = { eyebrow: "Aviso de cobro", title: `${esc(n)}, en 2 días se cobra tu plan`, lead: esc(line) };
  const body = rows(r) +
    p("Si quieres seguir, no tienes que hacer nada. Si no, cancela desde Mi plan: no se cobra nada y tu progreso queda guardado.") +
    button("Ver o cancelar mi plan", "/app/suscripcion");
  const reason = "Recibes este aviso porque tienes un cobro programado en Banana Burn.";
  return {
    subject, preheader: line,
    html: layout({ preheader: line, hero, body, reason }),
    text: textLayout([`${n}, ${line}`, "", ...r.map(([k, v]) => `${k}: ${v}`), "", `Ver o cancelar: ${abs("/app/suscripcion")}`], undefined, reason),
  };
}

/** Canceló el cobro programado antes de que llegara: no se cobra y conserva el acceso hasta el final de la prueba. */
export function cobroCancelado(d: { name: string; plan: string; accessUntil?: string | null; cardKept: boolean }): Email {
  const n = firstName(d.name);
  const subject = "Cancelaste tu plan: no se te cobrará";
  const preheader = d.accessUntil ? `Sigues con acceso hasta el ${longDate(d.accessUntil)}. No se hará ningún cobro.` : "No se hará ningún cobro.";
  const hero: Hero = { eyebrow: "Plan", title: "Listo, no se te cobrará", lead: `${esc(n)}, cancelaste <b>${esc(d.plan)}</b> antes del cobro. No se hará ningún cargo a tu tarjeta.` };
  const body =
    (d.accessUntil ? p(`Sigues con todo incluido hasta el <b>${esc(longDate(d.accessUntil))}</b>.`) : "") +
    p(d.cardKept ? "Tu tarjeta sigue guardada por si decides volver; puedes quitarla desde Mi plan." : "Quitamos tu tarjeta guardada.") +
    p("Tus entrenos y tu progreso quedan guardados. Si vuelves, retomas donde ibas.") + button("Ver mi plan", "/app/suscripcion");
  const reason = "Recibes este correo como confirmación de un cambio en tu plan.";
  return {
    subject, preheader,
    html: layout({ preheader, hero, body, reason }),
    text: textLayout([`${n}, cancelaste ${d.plan} antes del cobro. No se hará ningún cargo.`, d.accessUntil ? `Sigues con acceso hasta el ${longDate(d.accessUntil)}.` : "", d.cardKept ? "Tu tarjeta sigue guardada; puedes quitarla desde Mi plan." : "Quitamos tu tarjeta guardada.", "", `Ver mi plan: ${abs("/app/suscripcion")}`], undefined, reason),
  };
}

/** El correo de la cuenta cambió desde soporte (0056). `pending`: el cambio se completa al abrir `link` (vence en 1 hora). */
export function correoCambiado(d: { name: string; email: string; pending: boolean; link?: string }): Email {
  const n = (d.name || "").trim().split(/\s+/)[0];
  const hi = n ? `${esc(n)}, ` : "";
  const subject = d.pending ? "Confirma tu nuevo correo en Banana Burn" : "Tu cuenta de Banana Burn ahora usa este correo";
  const preheader = d.pending ? "Toca el botón para terminar el cambio de correo. El enlace vence en 1 hora." : "Desde ahora entras a Banana Burn con este correo.";
  const hero: Hero = d.pending
    ? { eyebrow: "Seguridad", title: "Confirma tu nuevo correo", lead: `${hi}soporte de Banana Burn preparó el cambio de tu cuenta a <b>${esc(d.email)}</b>.` }
    : { eyebrow: "Seguridad", title: "Tu correo cambió", lead: `${hi}desde ahora entras a Banana Burn con <b>${esc(d.email)}</b>.` };
  const body = d.pending && d.link
    ? button("Confirmar mi nuevo correo", d.link) + small(`El enlace vence en 1 hora. Si no pediste este cambio, ignora este correo y escríbenos a ${SUPPORT}.`)
    : p("Tu progreso, tus entrenos y tu plan siguen igual.") + small(`Si no pediste este cambio, escríbenos de inmediato a ${SUPPORT}.`) + button("Entrar a Banana Burn", "/entrar");
  const reason = "Recibes este correo porque se cambió el correo de tu cuenta de Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, hero, body, reason }),
    text: textLayout(d.pending && d.link
      ? [`${n ? `${n}, s` : "S"}oporte preparó el cambio de tu cuenta a ${d.email}.`, "", `Confírmalo aquí (vence en 1 hora): ${d.link}`, "", `Si no lo pediste, ignora este correo y escríbenos a ${SUPPORT}.`]
      : [`${n ? `${n}, d` : "D"}esde ahora entras a Banana Burn con ${d.email}.`, "Tu progreso sigue igual.", "", `Si no pediste este cambio, escríbenos a ${SUPPORT}.`], undefined, reason),
  };
}

export function suscripcionCancelada(d: { name: string; plan: string; accessUntil?: string | null }): Email {
  const n = firstName(d.name);
  const subject = "Tu suscripción fue cancelada";
  const preheader = d.accessUntil ? `Mantienes acceso hasta el ${longDate(d.accessUntil)}. Tu progreso queda guardado.` : "Tu progreso queda guardado por si decides volver.";
  const coach = "Gracias por entrenar conmigo. Tus récords te esperan cuando quieras volver.";
  const hero: Hero = { eyebrow: "Suscripción", title: "Listo, cancelamos tu suscripción", lead: `${esc(n)}, confirmamos la cancelación de <b>${esc(d.plan)}</b>. No se harán más cobros.` };
  const body =
    (d.accessUntil ? p(`Sigues teniendo acceso completo hasta el <b>${esc(longDate(d.accessUntil))}</b>.`) : "") +
    p("Tus entrenos, récords y pesajes quedan guardados. Si vuelves, retomas exactamente donde ibas.") +
    p("¿Nos cuentas por qué te vas? Responde este correo; lo leemos todo y nos ayuda a mejorar.") + button("Reactivar mi plan", "/precios");
  const reason = "Recibes este correo como confirmación de un cambio en tu suscripción.";
  return {
    subject, preheader,
    html: layout({ preheader, hero, body, reason, coach }),
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
  const coach = d.source === "referido" ? "Entrenar acompañado rinde más. Gracias por traer a tu gente." : "Disfrútalo. Este tiempo lo entrenamos juntos.";
  const r: [string, string][] = [["Plan", d.plan], ["Tiempo", meses], ["Desde", longDate(d.startsAt)], ["Hasta", longDate(d.expiresAt)]];
  const hero: Hero = { eyebrow: d.source === "referido" ? "Recompensa" : "Regalo", chip: meses + " gratis", title: esc(subject), lead: esc(intro) };
  const body =
    (d.message ? `<blockquote style="margin:0 0 16px;padding:14px 16px;background:${C.soft};border-radius:16px;font-size:16px;line-height:24px;color:${C.ink};">${esc(d.message)}</blockquote>` : "") +
    rows(r) + p(d.startsNow ? "Ya puedes usarlo. Sin cobros: al terminar, tu cuenta sigue como estaba." : "Se suma al final de tu acceso actual, así no pierdes ni un día. Sin cobros.") +
    button("Ver mi plan", "/app/suscripcion");
  const reason = "Recibes este correo porque se agregó tiempo gratis a tu cuenta de Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, hero, body, reason, coach }),
    text: textLayout([subject, "", intro, ...(d.message ? ["", `"${d.message}"`] : []), "", ...r.map(([k, v]) => `${k}: ${v}`), "", `Ver mi plan: ${abs("/app/suscripcion")}`], undefined, reason, coach),
  };
}

/**
 * Te hicieron tester de la beta: un mes de Entreno + Nutrición como cortesía. Transaccional: no lleva enlace de baja.
 * `renewal`: ya era tester y se renovó por otros 30 días desde hoy.
 */
export function testerAsignado(d: { name: string; expiresAt: string; days?: number; renewal?: boolean; charge?: { amount: number; chargeAt: string } | null }): Email {
  const n = firstName(d.name);
  const days = d.days ?? 30;
  const until = longDate(d.expiresAt);
  const subject = d.renewal ? `${n}, renovamos tu mes de tester` : `${n}, eres tester de Banana Burn`;
  const preheader = `Tienes Entreno + Nutrición gratis hasta el ${until}, como agradecimiento por probar la beta.`;
  const intro = d.renewal
    ? `Gracias por seguir probando la beta con nosotros. Tu mes de tester empieza de nuevo hoy: ${days} días más con todo incluido.`
    : "Te elegimos para probar Banana Burn durante la beta. Como agradecimiento, tienes la app completa por un mes, sin cobros.";
  const hero: Hero = { eyebrow: "Tester de la beta", chip: `${days} días gratis`, title: d.renewal ? "Seguimos contigo, tester" : "Eres tester de Banana Burn", lead: esc(intro) };
  const r: [string, string][] = [["Plan", "Entreno + Nutrición"], ["Tiempo", `${days} días`], ["Hasta", until], ["Costo", "Gratis"]];
  const body =
    eyebrow("Lo que tienes este mes") +
    list([
      `${dot()}<b>Entrenos con pesos que se ajustan solos</b>, coach y todos los programas.`,
      `${dot()}<b>Nutrición completa</b>: calorías, macros, comidas, recetas y Banana Shield.`,
      `${dot()}<b>Insignia de tester</b> en tu perfil y en la comunidad.`,
    ]) +
    rows(r) +
    (d.charge ? p(`<b>Tu cobro programado pasa al final de tu mes de tester.</b> Mientras seas tester no se te cobra nada. El ${esc(longDate(d.charge.chargeAt))} se cobra tu plan de ${esc(money(d.charge.amount))}, salvo que canceles antes desde Mi plan. Te avisamos 2 días antes.`) : "") +
    eyebrow("Cómo nos ayudas") +
    p("Usa la app como lo harías normalmente. Si algo falla, se ve raro o se te ocurre una idea, toca <b>Reportar algo</b> en Hoy y escríbenos en una frase. Cada reporte nos llega directo y lo revisamos.") +
    button("Abrir la app", "/app") +
    small(`Al terminar, tu cuenta sigue con todos tus datos y vuelves a las reglas normales: eliges un plan cuando quieras. No se te cobrará nada por este mes. También puedes escribirnos a ${SUPPORT}.`);
  const coach = "Gracias por entrenar con nosotros desde el principio. Lo que nos cuentes hace mejor la app para todos.";
  const reason = "Recibes este correo porque el equipo de Banana Burn te hizo tester de la beta.";
  return {
    subject, preheader,
    html: layout({ preheader, hero, body, reason, coach }),
    text: textLayout([subject, "", intro, ...(d.charge ? ["", `Tu cobro programado pasa al final de tu mes de tester: el ${longDate(d.charge.chargeAt)} se cobra tu plan de ${money(d.charge.amount)}, salvo que canceles antes. Mientras seas tester no se te cobra nada.`] : []), "", "Lo que tienes este mes:", "- Entrenos con pesos que se ajustan solos, coach y todos los programas.", "- Nutrición completa: calorías, macros, comidas, recetas y Banana Shield.", "- Insignia de tester en tu perfil y en la comunidad.", "", ...r.map(([k, v]) => `${k}: ${v}`), "",
      "Cómo nos ayudas: si algo falla o se te ocurre una idea, toca Reportar algo en Hoy y escríbenos en una frase.", "", `Abrir la app: ${abs("/app")}`], undefined, reason, coach),
  };
}

/** Terminó el mes de tester: agradecimiento y qué pasa ahora. Transaccional. */
export function testerTerminado(d: { name: string; endedAt: string }): Email {
  const n = firstName(d.name);
  const subject = `Gracias por probar Banana Burn, ${n}`;
  const preheader = "Terminó tu mes de tester. Tus datos siguen guardados.";
  const intro = `Tu mes de tester terminó el ${longDate(d.endedAt)}. Gracias por cada entreno y cada reporte: nos ayudaron a mejorar la app.`;
  const hero: Hero = { eyebrow: "Tester de la beta", title: "Gracias por ayudarnos a probar la app", lead: esc(intro), mascot: true };
  const body =
    eyebrow("Qué pasa ahora") +
    list([
      `${dot()}Tu historial, tus récords y tu plan siguen guardados. No se borra nada.`,
      `${dot()}Vuelves a las reglas normales: para seguir registrando, elige un plan en Mi plan.`,
      `${dot()}No se te cobró nada por este mes y no hay cobros automáticos por haber sido tester.`,
      `${dot()}Tu insignia de Tester beta se queda en tus logros.`,
    ]) +
    button("Ver planes", "/app/suscripcion") +
    small(`Si quieres seguir probando funciones nuevas, escríbenos a ${SUPPORT}.`);
  const reason = "Recibes este correo porque fuiste tester de la beta de Banana Burn.";
  const coach = "Fue un gusto entrenar contigo este mes. Aquí sigo cuando quieras volver.";
  return {
    subject, preheader,
    html: layout({ preheader, hero, body, reason, coach }),
    text: textLayout([subject, "", intro, "", "Qué pasa ahora:", "- Tu historial, tus récords y tu plan siguen guardados.", "- Para seguir registrando, elige un plan en Mi plan.", "- No se te cobró nada por este mes.", "- Tu insignia de Tester beta se queda en tus logros.", "", `Ver planes: ${abs("/app/suscripcion")}`], undefined, reason, coach),
  };
}

/** Aviso interno al equipo: llegó un reporte desde la app. Transaccional, solo para el equipo. */
export function reporteEquipo(d: { name: string; email?: string | null; kind: string; body: string; page?: string | null; tester: boolean; adminUrl: string; title?: string | null; number?: string | null }): Email {
  const subject = `${d.tester ? "Reporte de tester" : "Reporte de la app"}: ${d.kind}${d.number ? ` (${d.number})` : ""}${d.title ? `, ${d.title}` : ""}`;
  const preheader = d.body.slice(0, 90);
  const hero: Hero = { eyebrow: d.tester ? "Tester de la beta" : "Reporte", title: esc(subject), lead: `De <b>${esc(d.name)}</b>${d.email ? ` (${esc(d.email)})` : ""}.` };
  const r: [string, string][] = [["Tipo", d.kind], ["Pantalla", d.page || "Sin dato"], ["Tester", d.tester ? "Sí" : "No"]];
  const body = `<blockquote style="margin:0 0 16px;padding:14px 16px;background:${C.soft};border-radius:16px;font-size:16px;line-height:24px;color:${C.ink};white-space:pre-wrap;">${esc(d.body)}</blockquote>` + rows(r) + button("Ver en el panel", d.adminUrl);
  const reason = "Aviso interno del panel de Banana Burn.";
  return { subject, preheader, html: layout({ preheader, hero, body, reason }), text: textLayout([subject, "", `De: ${d.name}${d.email ? ` (${d.email})` : ""}`, "", d.body, "", ...r.map(([k, v]) => `${k}: ${v}`), "", `Ver en el panel: ${abs(d.adminUrl)}`], undefined, reason) };
}

/** Aviso interno al dueño (0059): alguien nuevo o dinero nuevo, o el resumen del día. Solo para el equipo. */
export function avisoAdmin(d: { title: string; body: string; url: string; eyebrow?: string; lines?: string[] }): Email {
  const subject = `${d.title}${d.body ? `: ${d.body}` : ""}`.slice(0, 140);
  const preheader = d.body.slice(0, 90);
  const hero: Hero = { eyebrow: d.eyebrow ?? "Aviso del panel", title: esc(d.title), lead: esc(d.body) };
  const list = (d.lines ?? []).length ? `<ul style="margin:0 0 16px;padding-left:20px;font-size:16px;line-height:26px;color:${C.ink};">${d.lines!.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : "";
  const body = list + button("Abrir en el panel", d.url);
  const reason = "Aviso interno del panel de Banana Burn. Lo cambias en Admin, Avisos.";
  return { subject, preheader, html: layout({ preheader, hero, body, reason }), text: textLayout([d.title, d.body, ...(d.lines ?? []).map((l) => `- ${l}`), "", `Abrir en el panel: ${abs(d.url)}`], undefined, reason) };
}

export type SupportMailKind = "recibido" | "en_proceso" | "respuesta" | "necesita_info" | "resuelto" | "cerrado";

/**
 * Avisos de "Reportar un problema" (0034): recibido con su número, en proceso, respuesta del equipo, necesitamos más
 * información, resuelto con el resumen y cerrado. Transaccionales: no llevan enlace de baja. `message` es lo que
 * escribió el equipo (se escapa siempre); `url` lleva al caso en la app.
 */
export function soporteAviso(d: { name: string; kind: SupportMailKind; number: string; title: string; message?: string | null; url: string }): Email {
  const n = firstName(d.name);
  const copy: Record<SupportMailKind, { subject: string; hero: string; lead: string; eyebrow: string }> = {
    recibido: { subject: `Recibimos tu reporte ${d.number}`, hero: "Recibimos tu reporte", eyebrow: "Soporte", lead: `${n}, ya está con el equipo. Te avisamos aquí y en la app cuando lo estemos trabajando y cuando quede resuelto.` },
    en_proceso: { subject: `Estamos trabajando en tu reporte ${d.number}`, hero: "Estamos trabajando en tu reporte", eyebrow: "Soporte", lead: `${n}, alguien del equipo ya lo está revisando.` },
    respuesta: { subject: `El equipo respondió tu reporte ${d.number}`, hero: "Te respondimos", eyebrow: "Soporte", lead: `${n}, hay una respuesta del equipo en tu reporte.` },
    necesita_info: { subject: `Necesitamos más información sobre ${d.number}`, hero: "Necesitamos un dato más", eyebrow: "Soporte", lead: `${n}, para seguir con tu reporte nos falta un detalle. Respóndenos desde la app.` },
    resuelto: { subject: `Resolvimos tu reporte ${d.number}`, hero: "Tu reporte quedó resuelto", eyebrow: "Soporte", lead: `${n}, esto es lo que hicimos. Si algo sigue igual, puedes reabrirlo desde la app durante 7 días.` },
    cerrado: { subject: `Cerramos tu reporte ${d.number}`, hero: "Cerramos tu reporte", eyebrow: "Soporte", lead: `${n}, el caso quedó cerrado. Si vuelve a pasar, puedes reabrirlo durante 7 días o crear uno nuevo.` },
  };
  const c = copy[d.kind];
  const r: [string, string][] = [["Reporte", d.number], ["Asunto", d.title]];
  const quote = d.message ? `<blockquote style="margin:0 0 16px;padding:14px 16px;background:${C.soft};border-radius:16px;font-size:16px;line-height:24px;color:${C.ink};white-space:pre-wrap;">${esc(d.message)}</blockquote>` : "";
  const body = (d.message ? eyebrow(d.kind === "resuelto" ? "Resumen" : "Mensaje del equipo") + quote : "") + rows(r) + button(d.kind === "necesita_info" || d.kind === "respuesta" ? "Responder en la app" : "Ver mi reporte", d.url) +
    small(`Puedes seguir todo en Mis reportes, dentro de tu perfil. Si prefieres, escríbenos a ${SUPPORT} con el número ${esc(d.number)}.`);
  const reason = "Recibes este correo porque enviaste un reporte a Banana Burn.";
  const coach = d.kind === "resuelto" ? "Gracias por avisarnos. Así la app mejora para todos." : undefined;
  const hero: Hero = { eyebrow: c.eyebrow, chip: d.number, title: esc(c.hero), lead: esc(c.lead) };
  return {
    subject: c.subject, preheader: c.lead,
    html: layout({ preheader: c.lead, hero, body, reason, coach }),
    text: textLayout([c.subject, "", c.lead, ...(d.message ? ["", `"${d.message}"`] : []), "", ...r.map(([k, v]) => `${k}: ${v}`), "", `Ver mi reporte: ${abs(d.url)}`], undefined, reason, coach),
  };
}

// ───────────── Ciclo de vida (llevan enlace de baja) ─────────────

export function recordatorio(d: { name: string; routine: string; mins?: number; exercises?: string[]; streak: number; goal?: Goal | null; unsubscribe: string; /** Línea de Coach Banana del entreno ("Hoy armas una espalda ancha..."). */ hook?: string; /** Dato real de la última sesión, ya en el registro de la persona. */ fact?: string | null; /** Aún no hace su primer entreno. */ first?: boolean }): Email {
  if (d.first) return primerEntreno(d);
  const n = firstName(d.name);
  const subject = `${n}, hoy te toca ${d.routine.replace(/:.*$/, "")}: tus cargas ya están listas`;
  const gl = goalLine(d.goal);
  const preheader = d.streak >= 2 ? `Vas ${d.streak} días seguidos. Tus cargas de hoy ya están listas.` : gl ? `${gl}. Hoy sumas una sesión más.` : "Tus cargas de hoy ya están calculadas. Solo falta que llegues.";
  const ex = (d.exercises ?? []).slice(0, 5);
  const coach = d.fact ? d.fact : d.streak >= 7 ? `${d.streak} días sin fallar. Eso ya es un hábito.`
    : d.streak >= 2 ? `No rompas la racha. Hoy vamos por el día ${d.streak + 1}.`
    : "Lo difícil es llegar. De lo demás me encargo yo.";
  const hero: Hero = { eyebrow: "Entreno de hoy", chip: d.streak >= 2 ? `Racha de ${d.streak} días` : undefined, title: `${esc(n)}, hoy te toca ${esc(d.routine)}`, lead: `${d.hook ? `${esc(d.hook)}. ` : ""}${d.mins ? `Son unos ${d.mins} minutos. Ya calculamos cuánto levantar en cada serie.` : "Ya calculamos cuánto levantar en cada serie."}` };
  const body =
    (ex.length ? eyebrow("Tu sesión").replace("margin:22px", "margin:0") + list(ex.map((e) => `${dot()}${esc(e)}`)) : "") +
    goalCard(d.goal) +
    button("Empezar entreno", "/app/entreno", "banana");
  const reason = "Recibes este recordatorio porque lo activaste en Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, hero, body, unsubscribe: d.unsubscribe, reason, coach }),
    text: textLayout([`${n}, hoy te toca ${d.routine}.`, d.mins ? `Unos ${d.mins} minutos. Tus cargas ya están calculadas.` : "Tus cargas ya están calculadas.", ...ex.map((e) => `• ${e}`), d.streak >= 2 ? `Racha: ${d.streak} días` : "", gl, "", `Empezar: ${abs("/app/entreno")}`], d.unsubscribe, reason, coach),
  };
}

/** Recordatorio de la primera semana para quien aún no entrena: su primer entreno, sin cargas ni rachas. */
function primerEntreno(d: { name: string; routine: string; mins?: number; exercises?: string[]; goal?: Goal | null; unsubscribe: string }): Email {
  const n = firstName(d.name);
  const subject = `${n}, tu primer entreno está listo${d.mins ? ` (${d.mins} min)` : ""}`;
  const preheader = "Te guío paso a paso. ¿Poco tiempo? Hay uno de 10 minutos, sin equipo.";
  const ex = (d.exercises ?? []).slice(0, 5);
  const coach = "Lo difícil es empezar. De lo demás me encargo yo.";
  const hero: Hero = { eyebrow: "Tu primer entreno", title: `${esc(n)}, tu primer entreno está listo`, lead: `${esc(d.routine)}${d.mins ? `, unos ${d.mins} minutos` : ""}. Te digo qué hacer, cuántas veces y cuándo descansar. Tú solo toca Empezar.` };
  const body =
    (ex.length ? eyebrow("Lo que vas a hacer").replace("margin:22px", "margin:0") + list(ex.map((e) => `${dot()}${esc(e)}`)) : "") +
    goalCard(d.goal ?? null) +
    button("Empezar mi primer entreno", "/app/entreno", "banana") +
    p("¿Poco tiempo hoy? En la app hay uno de 10 minutos, sin equipo. Cuenta igual.");
  const reason = "Recibes este recordatorio porque lo activaste en Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, hero, body, unsubscribe: d.unsubscribe, reason, coach }),
    text: textLayout([`${n}, tu primer entreno está listo: ${d.routine}${d.mins ? `, unos ${d.mins} minutos` : ""}.`, ...ex.map((e) => `• ${e}`), "", `Empezar: ${abs("/app/entreno")}`, "¿Poco tiempo? Hay uno de 10 minutos, sin equipo."], d.unsubscribe, reason, coach),
  };
}

export function rachaEnPeligro(d: { name: string; streak: number; unsubscribe: string }): Email {
  const n = firstName(d.name);
  const subject = `${n}, tu racha de ${d.streak} días sigue viva`;
  const preheader = "Con un check-in de 2 minutos la mantienes. Mañana vas por otro día.";
  const coach = "No dejes que la racha se enfríe. Dos minutos y la salvamos.";
  const hero: Hero = { eyebrow: "Racha", chip: `Racha de ${d.streak} días`, title: `${d.streak} días seguidos, ${esc(n)}`, lead: "Hoy todavía no registraste nada, y no hace falta un entreno para mantener la racha: un check-in cuenta." };
  const body =
    list([`${dot(C.ember)}Anota tus vasos de agua`, `${dot()}Registra tu peso`, `${dot(C.ink)}Cuéntanos cómo dormiste`]) +
    p(`Dos minutos y mañana vas por el día <b>${d.streak + 1}</b>.`) + button("Hacer mi check-in", "/app");
  const reason = "Recibes este aviso porque activaste los recordatorios de Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, hero, body, unsubscribe: d.unsubscribe, reason, coach }),
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
  const kgLabel = delta == null ? "Sin pesaje" : delta === 0 ? "0 kg" : `${delta > 0 ? "+" : ""}${kg(delta)} kg`;
  const complete = d.workouts >= d.planned && d.planned > 0;
  const headline = complete ? `Semana completa: ${d.workouts} de ${d.planned} entrenos` : d.workouts > 0 ? `${d.workouts} entrenos esta semana` : "Una semana nueva para arrancar";
  const subject = `${n}, tu semana: ${d.workouts} entrenos${delta != null ? ` y ${kgLabel}` : ""}`;
  const gl = goalLine(d.goal);
  const preheader = d.prs.length ? `${d.prs.length} récord${d.prs.length > 1 ? "s" : ""} personal${d.prs.length > 1 ? "es" : ""} y tu plan para esta semana.` : gl ? `${gl}. Mira lo que viene esta semana.` : "Tu progreso y lo que viene esta semana.";
  const coach = complete ? "Semana completa. Así se construyen los resultados: una sesión a la vez."
    : d.workouts > 0 ? "Buen trabajo. Esta semana vamos por una sesión más que la pasada."
    : "Semana nueva. Empezamos con la primera sesión y el resto llega solo.";
  const trend = d.trendPerWeek == null ? "" : d.trendPerWeek < 0 ? p(`Tu tendencia es <b>${kg(Math.abs(d.trendPerWeek), 2)} kg por semana</b> hacia abajo. Vas bien.`) : d.trendPerWeek > 0 ? p(`La báscula subió un poco (${kg(d.trendPerWeek, 2)} kg por semana). Es normal que fluctúe: lo que manda es la tendencia de varias semanas. Tu plan se ajusta solo.`) : p("Peso estable esta semana.");
  const hero: Hero = { eyebrow: "Resumen semanal", chip: complete ? "Semana completa" : undefined, title: esc(headline), lead: `${esc(n)}, así te fue en los últimos 7 días.` };
  const body =
    stats([[d.planned ? `${d.workouts} de ${d.planned}` : `${d.workouts}`, "entrenos"], [kgLabel, "peso"], [`${d.streak} días`, "racha"]]) + trend +
    goalCard(d.goal) +
    (d.prs.length ? eyebrow("Récords personales") + list(d.prs.slice(0, 5).map((x) => `${dot(C.ember)}<span style="color:${C.peel};font-weight:700;">${esc(x)}</span>`)) : "") +
    (d.nextWeek.length ? eyebrow("Tu semana que viene") + list(d.nextWeek.map((x) => `${dot()}<b>${esc(x.day)}:</b> ${esc(x.name)}`)) : "") +
    button("Ver mi progreso", "/app/progreso");
  const reason = "Recibes el resumen semanal porque lo activaste en Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, hero, body, unsubscribe: d.unsubscribe, reason, coach }),
    text: textLayout([headline, "", `Entrenos: ${d.planned ? `${d.workouts} de ${d.planned}` : d.workouts}`, `Peso: ${kgLabel}`, `Racha: ${d.streak} días`, ...(gl ? [gl] : []), ...(d.prs.length ? ["", "Récords:", ...d.prs.slice(0, 5).map((x) => `• ${x}`)] : []), ...(d.nextWeek.length ? ["", "Esta semana:", ...d.nextWeek.map((x) => `• ${x.day}: ${x.name}`)] : []), "", `Ver mi progreso: ${abs("/app/progreso")}`], d.unsubscribe, reason, coach),
  };
}

export function reactivacion(d: { name: string; days: 3 | 7; routine: string; trainingDay: boolean; goal?: Goal | null; unsubscribe: string }): Email {
  const n = firstName(d.name);
  const three = d.days === 3;
  const subject = three ? `Te guardamos el lugar, ${n}` : `${n}, empezamos de nuevo, sin presión`;
  const gl = goalLine(d.goal);
  const preheader = three ? "Volver es más fácil con una sesión corta. Tu plan sigue igualito." : gl ? `Tu meta sigue en pie. ${gl}.` : "Tus datos y tu plan siguen aquí. 20 minutos hoy y arrancamos.";
  const today = d.trainingDay ? `Hoy te toca <b>${esc(d.routine)}</b>.` : "Hoy es día de descanso activo: una caminata y 10 minutos de estiramiento cuentan.";
  const coach = "Sin presión. Haz solo los dos primeros ejercicios: casi siempre terminas la sesión.";
  const hero: Hero = { eyebrow: "Tu plan te espera", title: three ? `Te guardamos el lugar, ${esc(n)}` : "Empezamos de nuevo, sin presión", lead: three ? "La vida pasa, y está bien. Lo que importa es la siguiente sesión, no las que quedaron atrás." : "Una semana fuera no borra nada: tus récords, tu historial y tu plan siguen aquí." };
  const body = p(today) + goalCard(d.goal) +
    button(d.trainingDay ? "Volver con una sesión corta" : "Hacer mi check-in", d.trainingDay ? "/app/entreno" : "/app", d.trainingDay ? "banana" : "primary");
  const reason = "Recibes este correo porque tienes activados los recordatorios de Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, hero, body, unsubscribe: d.unsubscribe, reason, coach }),
    text: textLayout([subject, "", three ? "La vida pasa, y está bien. Lo que importa es la siguiente sesión." : "Tus récords, tu historial y tu plan siguen aquí.", d.trainingDay ? `Hoy te toca ${d.routine}.` : "Hoy: caminata y 10 minutos de estiramiento.", gl, "", `Volver: ${abs(d.trainingDay ? "/app/entreno" : "/app")}`], d.unsubscribe, reason, coach),
  };
}

// ───────────── Secuencia de la prueba de 7 días (docs/emails/secuencia-prueba.md) ─────────────
// Días 2, 4 y 6 desde el registro. La envía runReminders (notify-run.ts) en lugar del recordatorio de ese día.

export type TrialStepDay = 2 | 4 | 6;

const [ENTRENO, COMPLETO] = PLANS;
/** "Cada año pagado incluye una temporada deportiva gratis", dicho desde ANNUAL_SEASON_NOTE. */
const seasonLine = ANNUAL_SEASON_NOTE.replace(/^Incluye 1 /, "incluye una ");

/** Copy de cada pieza. El último párrafo lo firma Coach Banana. */
export const TRIAL_SEQUENCE: Record<TrialStepDay, { subject: string; preheader: string; paragraphs: string[]; cta: string; path: string; kind: BtnKind }> = {
  2: {
    subject: "Tu primer resultado empieza por registrar",
    preheader: "Mira lo que ya guardaste y abre el entreno de hoy.",
    paragraphs: [
      "Tu primer resultado puede ser una sesión registrada, no un cambio en la báscula. Si ya entrenaste, revisa en Progreso lo que guardaste: ese es tu punto de partida para comparar más adelante.",
      "Si todavía no empezaste, hoy puedes dar ese primer paso. Abre tu rutina, sigue la técnica de cada ejercicio y registra el peso y las repeticiones que hagas.",
      "Consulta lo que te toca hoy y respeta los días de descanso de tu plan. No necesitas demostrar nada en dos días: necesitas un comienzo que puedas repetir.",
    ],
    cta: "Ver mi entreno", path: "/app/entrenar", kind: "banana",
  },
  4: {
    subject: "Más que completar el entreno de hoy",
    preheader: "Progreso, comida y carrera: elige qué quieres sostener.",
    paragraphs: [
      "Seguir te permite comparar tu fuerza, peso, medidas y fotos en Progreso. No todo el avance se ve en la báscula.",
      `Con ${COMPLETO.name} también puedes registrar tus comidas y consultar tus calorías y macros. La nutrición está incluida durante tu prueba; después depende del plan que elijas.`,
      `¿También corres? Banana Run registra tus carreras con GPS. Para un plan de carrera guiado, explora la Temporada Running. Las temporadas se adquieren aparte; cada año pagado de un plan anual ${seasonLine}.`,
      "Revisa qué quieres mantener en tu rutina y qué plan lo incluye.",
    ],
    cta: "Ver qué incluye mi plan", path: "/app/incluye", kind: "primary",
  },
  6: {
    subject: "Elige cómo quieres seguir",
    preheader: "Compara el ahorro anual y las opciones mensuales en Mi plan.",
    paragraphs: [
      "Revisa qué opción se adapta a ti.",
      `Anual: ${ENTRENO.name} cuesta ${usd2(ENTRENO.price.anual)} al año; ahorras ${usd2(annualSaving(ENTRENO))} frente a 12 mensualidades. ${COMPLETO.name} cuesta ${usd2(COMPLETO.price.anual)} al año; ahorras ${usd2(annualSaving(COMPLETO))}. Cada año pagado ${seasonLine}.`,
      `Mensual: ${ENTRENO.name} cuesta ${usd2(ENTRENO.price.mes)} al mes y ${COMPLETO.name}, ${usd2(COMPLETO.price.mes)} al mes. Nutrición está incluida solo en ${COMPLETO.name}.`,
      "Estos son precios regulares en USD, con IVA incluido. El ahorro anual compara 12 meses a precio regular, sin promociones.",
      "En Mi plan puedes revisar tu elección y las condiciones que aplican a tu cuenta antes de confirmar cualquier cambio.",
    ],
    cta: "Revisar mi plan", path: "/app/suscripcion", kind: "primary",
  },
};

/** Una pieza de la secuencia de la prueba. Lleva enlace de baja (scope "recordatorios": reemplaza al recordatorio del día). */
export function secuenciaPrueba(d: { day: TrialStepDay; unsubscribe: string }): Email {
  const c = TRIAL_SEQUENCE[d.day];
  const body = c.paragraphs.slice(0, -1);
  const coach = esc(c.paragraphs.at(-1));
  const hero: Hero = { eyebrow: "Tu prueba de 7 días", title: esc(c.subject), lead: esc(c.preheader) };
  const html = body.map((x) => p(esc(x))).join("") + button(c.cta, c.path, c.kind);
  const reason = "Recibes este correo porque estás en tu prueba de 7 días y tienes activados los recordatorios de Banana Burn.";
  return {
    subject: c.subject, preheader: c.preheader,
    html: layout({ preheader: c.preheader, hero, body: html, unsubscribe: d.unsubscribe, reason, coach }),
    text: textLayout([c.subject, "", ...body.flatMap((x) => [x, ""]), `${c.cta}: ${abs(c.path)}`], d.unsubscribe, reason, coach),
  };
}

// ───────────── Fin de la beta (#109): cuentas de la beta sin tarjeta ni plan ─────────────

/** Día corto en Costa Rica (la hora de las fechas de la beta): "7 de noviembre". */
const dayCR = (t: number) => new Date(t).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: "America/Costa_Rica" });

/**
 * 1: fin de la beta (1 nov). 2: lo que conservas (5 nov). 3: último día (7 nov). `promo`: el 50 % del primer mes solo
 * cuando el servidor se lo daría a esta persona (promoFor en trial.ts: cobro "beta" y nunca pagó un plan).
 */
export type BetaEndMailData = { name: string; step: 1 | 2 | 3; promo: boolean; unsubscribe: string; graceUntil?: string };

export function finBeta(d: BetaEndMailData): Email {
  const n = firstName(d.name);
  const end = Date.parse(d.graceUntil ?? BETA_GRACE_UNTIL);
  // El acceso gratis llega hasta la medianoche que abre BETA_GRACE_UNTIL: el último día es el anterior.
  const last = dayCR(end - 1), chargeDay = dayCR(end);
  const pct = `${PROMO_PCT}\u00a0%`;

  const annual: [string, string][] = PLANS.map((pl) => [pl.name, `${money(pl.price.anual)} al año`]);
  const monthly: [string, string][] = PLANS.map((pl) => [pl.name, d.promo ? `${money(pl.price.mes)} al mes; primer mes ${money(promoPrice(pl.id))}` : `${money(pl.price.mes)} al mes`]);
  const saving = `Ahorras ${PLANS.map((pl) => money(annualSaving(pl))).join(" o ")} al año frente a pagar mes a mes. ${ANNUAL_SEASON_NOTE}.`;
  const promoLine = d.promo ? `Si eliges el mensual y dejas tu tarjeta lista antes del final del ${last}, tu primer mes cuesta ${pct} menos. Aplica una vez por cuenta; desde el segundo mes, precio normal.` : "";
  const noCharge = `Hoy no se cobra nada. Si dejas tu tarjeta lista, el primer cobro es el ${chargeDay} y cancelas sin costo antes desde Mi plan.`;

  const copy = {
    1: {
      subject: `Terminó la beta: sigues con todo incluido hasta el ${last}`,
      hero: { eyebrow: "Fin de la beta", title: `${esc(n)}, gracias por estar en la beta`, lead: `La beta terminó. Tu cuenta sigue con todo incluido y sin costo hasta el final del <b>${esc(last)}</b>.` },
      lines: [`Desde el ${chargeDay}, para seguir con tu plan eliges uno en Mi plan.`, "No tienes tarjeta guardada, así que no te cobramos nada de forma automática."],
      coach: "Gracias por entrenar conmigo en la beta. Sigo aquí para lo que viene.",
    },
    2: {
      subject: `${n}, lo que conservas si eliges tu plan`,
      hero: { eyebrow: "Tu plan", title: "Lo que conservas si eliges tu plan", lead: `Sigues con todo incluido hasta el final del <b>${esc(last)}</b>. Si eliges un plan, sigues sin cortes.` },
      lines: ["Tu progreso: entrenos, récords, pesajes y medidas, con tus gráficas al día.", "Tu plan: la rutina hecha a tu nivel, tiempo y equipo, con la progresión de cargas.", "Tu racha: si no cortas, sigue contando.", `Si no eliges plan, tus datos quedan guardados, pero desde el ${chargeDay} la app te pide un plan para seguir.`],
      coach: "Lo que ya construiste no se pierde. La idea es no cortar el ritmo.",
    },
    3: {
      subject: "Hoy es tu último día con todo incluido",
      hero: { eyebrow: "Último día", title: `${esc(n)}, hoy es el último día`, lead: `Tu acceso con todo incluido termina hoy, <b>${esc(last)}</b>, a la medianoche (hora de Costa Rica).` },
      lines: ["Desde mañana la app te pide elegir un plan para seguir.", "Tu progreso queda guardado, elijas o no."],
      coach: "Hoy entrenamos igual. Mañana seguimos juntos si eliges tu plan.",
    },
  }[d.step];

  const preheader = d.step === 3 ? `Tu acceso con todo incluido termina hoy, ${last}.` : d.step === 2 ? `Tu progreso, tu plan y tu racha siguen si eliges un plan antes del final del ${last}.` : `Sigues con todo incluido hasta el final del ${last}. No te cobramos nada.`;
  const body =
    (d.step === 2 ? list(copy.lines.slice(0, 3).map((l) => `${dot()}${esc(l)}`)) + p(esc(copy.lines[3])) : copy.lines.map((l) => p(esc(l))).join("")) +
    eyebrow("Plan anual") + rows(annual) + small(esc(saving)) +
    eyebrow("Plan mensual") + rows(monthly) + (promoLine ? small(esc(promoLine)) : "") +
    small(esc(noCharge)) + button("Elegir mi plan", "/app/suscripcion");
  const reason = "Recibes este correo porque tu cuenta es de la beta de Banana Burn y todavía no tiene un plan.";
  return {
    subject: copy.subject, preheader,
    html: layout({ preheader, hero: copy.hero, body, reason, coach: copy.coach, unsubscribe: d.unsubscribe }),
    text: textLayout([
      copy.subject, "", copy.hero.lead.replace(/<[^>]+>/g, ""), "", ...copy.lines, "",
      "Plan anual:", ...annual.map(([k, v]) => `- ${k}: ${v}`), saving, "",
      "Plan mensual:", ...monthly.map(([k, v]) => `- ${k}: ${v}`), ...(promoLine ? [promoLine] : []), "",
      noCharge, "", `Elegir mi plan: ${abs("/app/suscripcion")}`,
    ], d.unsubscribe, reason, copy.coach),
  };
}

// ───────────── Recuperación al terminar la prueba sin plan (docs/emails/recuperacion-prueba.md) ─────────────
// Días 8 y 14 desde el registro. La envía runReminders (notify-run.ts) en lugar de los demás correos de ese día.

export type RecoveryDay = 8 | 14;

/** Copy de cada pieza, con los precios de PLANS. Sin descuentos: después de la prueba el alta va a precio normal (promoFor). */
export const RECOVERY_MAILS: Record<RecoveryDay, { subject: string; preheader: string; paragraphs: string[]; cta: string; path: string }> = {
  8: {
    subject: "Tu historial sigue guardado",
    preheader: "Conservas lo que registraste. Elige un plan para retomar.",
    paragraphs: [
      "Tu prueba terminó, pero no tienes que empezar desde cero.",
      "En tu cuenta siguen los entrenos, pesos y repeticiones que registraste, junto con tus registros de peso, medidas y fotos de progreso. Vuelve con la misma cuenta para conservar ese historial.",
      `Para retomar el entrenamiento, elige ${ENTRENO.name} por ${usd2(ENTRENO.price.mes)} al mes o ${COMPLETO.name} por ${usd2(COMPLETO.price.mes)} al mes. Solo el segundo incluye el registro de comidas y tus calorías y macros. También puedes comparar las opciones anuales en Mi plan.`,
      "Revisa el plan y el total antes de confirmar el pago. Precios en USD, con IVA incluido.",
    ],
    cta: "Elegir mi plan", path: "/app/suscripcion",
  },
  14: {
    subject: "Vuelve con un año de entreno",
    preheader: "Compara el anual primero y retoma con tu historial guardado.",
    paragraphs: [
      "Tu historial sigue en tu cuenta: los entrenos, pesos, repeticiones, medidas y fotos que guardaste.",
      `Si quieres volver, compara primero el anual: ${ENTRENO.name} cuesta ${usd2(ENTRENO.price.anual)} al año y ${COMPLETO.name}, ${usd2(COMPLETO.price.anual)} al año. Cada año pagado ${seasonLine}. Solo ${COMPLETO.name} incluye comidas, calorías y macros.`,
      `¿Prefieres pagar mes a mes? ${ENTRENO.name} cuesta ${usd2(ENTRENO.price.mes)} al mes y ${COMPLETO.name}, ${usd2(COMPLETO.price.mes)} al mes.`,
      "Entra con la misma cuenta y elige cómo seguir. Precios en USD, con IVA incluido; el anual se paga completo, no en cuotas mensuales.",
    ],
    cta: "Comparar mi plan anual", path: "/app/suscripcion",
  },
};

/** Un correo de recuperación. Lleva enlace de baja (scope "recordatorios": reemplaza a los avisos del día). */
export function recuperacionPrueba(d: { day: RecoveryDay; unsubscribe: string }): Email {
  const c = RECOVERY_MAILS[d.day];
  const hero: Hero = { eyebrow: "Tu prueba terminó", title: esc(c.subject), lead: esc(c.preheader) };
  const html = c.paragraphs.map((x) => p(esc(x))).join("") + small("<b>Coach Banana</b>") + button(c.cta, c.path);
  const reason = "Recibes este correo porque tu prueba de 7 días terminó sin elegir un plan y tienes activados los recordatorios de Banana Burn.";
  return {
    subject: c.subject, preheader: c.preheader,
    html: layout({ preheader: c.preheader, hero, body: html, unsubscribe: d.unsubscribe, reason }),
    text: textLayout([c.subject, "", ...c.paragraphs.flatMap((x) => [x, ""]), "Coach Banana", "", `${c.cta}: ${abs(c.path)}`], d.unsubscribe, reason),
  };
}

// ───────────── Supabase Auth (se pegan en el panel de Supabase) ─────────────
// Se generan con `npm run emails:auth` → supabase/templates/*.html. Usan las variables de Supabase
// ({{ .SiteURL }}, {{ .Token }}, {{ .TokenHash }}, {{ .NewEmail }}), no datos de la app.

export type AuthTemplate = { file: string; supabase: string; subject: string; html: string };

export function authTemplates(): AuthTemplate[] {
  const site = "{{ .SiteURL }}";
  const link = (type: string, next = "/app") => `${site}/auth/callback?token_hash={{ .TokenHash }}&type=${type}${next ? `&next=${next}` : ""}`;
  const btn = (label: string, href: string) => button(label, href, "primary", site);
  const safe = (what: string) => small(`El código vence en 1 hora. Si no ${what}, ignora este correo: nadie puede entrar a tu cuenta sin él.`);
  const make = (file: string, supabase: string, subject: string, hero: Hero, body: string, coach: string, reason: string): AuthTemplate =>
    ({ file, supabase, subject, html: layout({ preheader: subject, hero, body, reason, coach, site }) });
  return [
    make("invite.html", "Invite user", "Te invitaron a entrenar con Banana Burn",
      { eyebrow: "Invitación", title: "Te invitaron a Banana Burn", lead: "Tu entrenador personal en el celular: qué entrenar hoy, con cuánto peso y cómo hacer cada movimiento." },
      btn("Aceptar la invitación", link("invite", "/bienvenida")) + small("El enlace vence en 24 horas. Si no esperabas esta invitación, ignora este correo."),
      "Acepta y armamos tu plan en 2 minutos.", "Recibes este correo porque alguien te invitó a Banana Burn con esta dirección."),
    make("magic-link.html", "Magic link or OTP", "Tu código para entrar a Banana Burn",
      { eyebrow: "Acceso", title: "Tu código para entrar", lead: "Escríbelo en Banana Burn y sigues donde te quedaste." },
      codeBox("{{ .Token }}") + btn("O entra con un toque", link("email")) + safe("pediste entrar a Banana Burn"),
      "Te espero adentro. Tu entreno de hoy ya está listo.", "Recibes este correo porque pediste entrar a Banana Burn con esta dirección."),
    make("confirm-signup.html", "Confirm sign up", "Tu código para crear tu cuenta en Banana Burn",
      { eyebrow: "Bienvenida", title: "Ya casi eres parte de Banana Burn", lead: "Escribe este código para crear tu cuenta y armar tu plan en 2 minutos.", mascot: true },
      codeBox("{{ .Token }}") + btn("O confirma con un toque", link("signup")) + safe("creaste una cuenta en Banana Burn"),
      "Confirma y empezamos a entrenar hoy mismo.", "Recibes este correo porque alguien creó una cuenta en Banana Burn con esta dirección."),
    make("reset-password.html", "Reset password", "Crea tu nueva contraseña de Banana Burn",
      { eyebrow: "Seguridad", title: "Crea tu nueva contraseña", lead: "Pediste cambiar tu contraseña de Banana Burn. Toca el botón para crear una nueva." },
      btn("Crear mi nueva contraseña", link("recovery", "")) + small("El enlace vence en 1 hora. Si no pediste el cambio, ignora este correo: tu contraseña actual sigue igual."),
      "Tus récords están a salvo. Cambias la clave y seguimos entrenando.", "Recibes este correo porque se pidió cambiar la contraseña de tu cuenta de Banana Burn."),
    make("change-email.html", "Change email address", "Confirma tu nuevo correo en Banana Burn",
      { eyebrow: "Seguridad", title: "Confirma tu nuevo correo", lead: "Pediste cambiar el correo de tu cuenta de <b>{{ .Email }}</b> a <b>{{ .NewEmail }}</b>." },
      codeBox("{{ .Token }}") + btn("Confirmar el cambio", link("email_change", "/app/perfil")) + small("Si no pediste este cambio, ignora este correo y escríbenos a " + SUPPORT + ". Tu cuenta sigue con el correo actual."),
      "Mismo progreso, nuevo correo. Nada de tu historial se pierde.", "Recibes este correo porque se pidió cambiar el correo de tu cuenta de Banana Burn."),
    make("reauthentication.html", "Reauthentication", "Tu código de seguridad de Banana Burn",
      { eyebrow: "Seguridad", title: "Confirma que eres tú", lead: "Escribe este código para terminar el cambio que estás haciendo en tu cuenta." },
      codeBox("{{ .Token }}") + safe("estás haciendo cambios en tu cuenta"),
      "Es solo un paso de seguridad. Tu cuenta sigue protegida.", "Recibes este correo porque se pidió un código de seguridad para tu cuenta de Banana Burn."),
  ];
}

export type AffiliateMailKind = "bienvenida" | "nivel_maximo" | "nivel_baja";

/** Programa de referidores (0051): bienvenida al programa, llegada al nivel máximo y aviso de que el acceso gratis vence. */
export function referidor(d: { name: string; kind: AffiliateMailKind; code?: string | null; until?: string | null; min?: number }): Email {
  const n = firstName(d.name);
  const c: Record<AffiliateMailKind, { subject: string; title: string; lead: string; lines: string[]; cta: [string, string] }> = {
    bienvenida: {
      subject: "Bienvenido al programa de referidores de Banana Burn",
      title: "Ya eres referidor de Banana Burn",
      lead: `${esc(n)}, desde hoy ganas una parte de lo que pagan las personas que lleguen con tu enlace.`,
      lines: ["De 1 a 10 referidos pagando: 10 %.", "De 11 a 20: 20 %.", "De 21 a 30: 30 %.", "31 o más: 40 % y Banana Burn no te cobra."],
      cta: ["Ver mi enlace", "/app/afiliados"],
    },
    nivel_maximo: {
      subject: "Llegaste al nivel máximo: 40 % y la app gratis",
      title: "Llegaste al nivel máximo",
      lead: `${esc(n)}, tienes ${d.min ?? 31} o más referidos pagando. Ahora ganas el 40 % y Banana Burn ya no te cobra.`,
      lines: ["Si tenías un plan pagado, ya no se renueva: no se te cobrará más.", "Tu acceso gratis se mantiene mientras sigas en el nivel máximo.", "Tus ganancias se pagan cada mes por SINPE Móvil o transferencia."],
      cta: ["Ver mis referidos", "/app/afiliados"],
    },
    nivel_baja: {
      subject: "Tu acceso gratis de referidor vence pronto",
      title: "Tu acceso gratis vence pronto",
      lead: `${esc(n)}, ahora tienes menos de ${d.min ?? 31} referidos pagando.${d.until ? ` Si no vuelves al nivel máximo, tu acceso gratis termina el ${esc(longDate(d.until))}.` : ""}`,
      lines: ["Tus ganancias siguen: solo cambia el porcentaje según tu nivel.", "Para no perder el acceso, puedes elegir un plan en Mi plan.", "Si vuelves a llegar al nivel máximo, el acceso gratis sigue solo."],
      cta: ["Ver mi plan", "/app/suscripcion"],
    },
  };
  const x = c[d.kind];
  const hero: Hero = { eyebrow: "Programa de referidores", title: esc(x.title), lead: x.lead };
  const body = list(x.lines.map((l) => `${dot()}${esc(l)}`)) + button(x.cta[0], x.cta[1]) + small("Cuando promociones Banana Burn, di que recibes una comisión por las personas que se suscriban con tu enlace.");
  const reason = "Recibes este correo porque eres parte del programa de referidores de Banana Burn.";
  return { subject: x.subject, preheader: x.lines[0], html: layout({ preheader: x.lines[0], hero, body, reason }), text: textLayout([x.subject, "", x.lead.replace(/<[^>]+>/g, ""), "", ...x.lines.map((l) => `- ${l}`), "", `${x.cta[0]}: ${abs(x.cta[1])}`], undefined, reason) };
}

/** Aviso interno: el pago mensual de referidores está listo para pagar. */
export function pagosReferidoresEquipo(d: { period: string; count: number; total: string }): Email {
  const subject = `Pagos de referidores listos: ${d.period}`;
  const hero: Hero = { eyebrow: "Referidores", title: esc(subject), lead: `${d.count} pago${d.count === 1 ? "" : "s"} por un total de <b>${esc(d.total)}</b>.` };
  const body = p("Revisa cada método de pago, paga por SINPE Móvil o transferencia y márcalo como pagado con la referencia.") + button("Abrir pagos", "/admin/referidores#pagos");
  const reason = "Aviso interno del panel de Banana Burn.";
  return { subject, preheader: `${d.count} pagos, ${d.total}`, html: layout({ preheader: `${d.count} pagos, ${d.total}`, hero, body, reason }), text: textLayout([subject, "", `${d.count} pagos por ${d.total}.`, "", `Abrir pagos: ${abs("/admin/referidores#pagos")}`], undefined, reason) };
}

// ───────────── Condominios afiliados (0053): fin del mes gratis del residente ─────────────

/** El mes gratis que regaló el condominio termina pronto: el residente decide si sigue con un plan individual. Transaccional. */
export function condominioMesTermina(d: { name: string; condo: string; until: string }): Email {
  const n = firstName(d.name);
  const day = longDate(d.until);
  const subject = "Tu mes gratis del condominio termina pronto";
  const lead = `${n}, el mes gratis que te regaló ${d.condo} termina el ${day}.`;
  const hero: Hero = { eyebrow: "Banana Burn para condominios", title: esc(subject), lead: esc(lead) };
  const lines = [
    "Si quieres seguir, elige tu plan individual desde Mi plan. Si no, puedes dejar de usar la app.",
    "No te cobramos nada automáticamente.",
    "Tu historial, tus récords y tu plan se quedan guardados.",
  ];
  const body = list(lines.map((l) => `${dot()}${esc(l)}`)) + button("Ver mi plan", "/app/suscripcion");
  const reason = "Recibes este correo porque te uniste a Banana Burn con el enlace de tu condominio.";
  return {
    subject, preheader: lead,
    html: layout({ preheader: lead, hero, body, reason }),
    text: textLayout([subject, "", lead, "", ...lines.map((l) => `- ${l}`), "", `Ver mi plan: ${abs("/app/suscripcion")}`], undefined, reason),
  };
}

// ───────────── Condominios (0052): solicitudes de reunión desde /condominios ─────────────

export type CondoLeadMail = { name: string; role: string; org: string; units?: string | null; location?: string | null; email: string; phone?: string | null; times?: string | null; days?: string | null; portfolio?: string | null; comment?: string | null; id: number };

/** Aviso interno: llegó una solicitud de reunión de un condominio. Transaccional, solo para el equipo. */
export function condominioEquipo(d: CondoLeadMail): Email {
  const subject = `Condominio quiere reunión virtual: ${d.org}`;
  const lead = `De <b>${esc(d.name)}</b> (${esc(d.role)}).`;
  const hero: Hero = { eyebrow: "Condominios", title: esc(subject), lead };
  const r: [string, string][] = [
    ["Condominio", d.org], ["Contacto", d.name], ["Cargo", d.role], ["Correo", d.email], ["Teléfono o WhatsApp", d.phone || "Sin dato"],
    ["Unidades o residentes", d.units || "Sin dato"], ["¿Varios condominios?", d.portfolio || "Sin dato"], ["Ubicación", d.location || "Sin dato"],
    ["Hora preferida para la reunión virtual", d.times || "Sin dato"], ["Día preferido para la reunión virtual", d.days || "Sin dato"],
  ];
  const quote = d.comment ? `<blockquote style="margin:0 0 16px;padding:14px 16px;background:${C.soft};border-radius:16px;font-size:16px;line-height:24px;color:${C.ink};white-space:pre-wrap;">${esc(d.comment)}</blockquote>` : "";
  const body = quote + rows(r) + p("Respóndele en menos de 24 horas hábiles con la fecha, la hora y el enlace de la videollamada (unos 30 minutos).") + button("Ver en el panel", "/admin/condominios");
  const reason = "Aviso interno del panel de Banana Burn.";
  return {
    subject, preheader: `${d.name}, ${d.role}. ${d.org}`,
    html: layout({ preheader: `${d.name}, ${d.role}. ${d.org}`, hero, body, reason }),
    text: textLayout([subject, "", ...(d.comment ? [`"${d.comment}"`, ""] : []), ...r.map(([k, v]) => `${k}: ${v}`), "", `Ver en el panel: ${abs("/admin/condominios")}`], undefined, reason),
  };
}

/** Confirmación a la persona que pidió la reunión desde /condominios. Transaccional. */
export function condominioRecibido(d: { name: string; org: string }): Email {
  const n = firstName(d.name);
  const subject = "Recibimos tu solicitud de reunión";
  const lead = `${n}, gracias por escribirnos. En menos de 24 horas hábiles te confirmamos la reunión virtual sobre ${d.org} y te enviamos el enlace de la videollamada.`;
  const hero: Hero = { eyebrow: "Banana Burn para condominios", title: "Recibimos tu solicitud", lead: esc(lead), mascot: true };
  const body = eyebrow("Qué pasa ahora") + steps([
    ["Te enviamos el enlace", "Te confirmamos el día y la hora y te enviamos el enlace de la videollamada."],
    ["Reunión virtual de 30 minutos", "Te mostramos el sistema por dentro, cómo se implementa en el condominio y resolvemos las dudas."],
    ["Primer mes gratis para todos", "Si deciden sumarse, te damos el enlace y el afiche con QR del condominio, y cada residente tiene el primer mes gratis con todo incluido."],
    ["Cada residente decide", "Al terminar el mes, cada residente decide si sigue con su plan individual. La administración y el condominio no pagan nada."],
  ]) + small(`¿Necesitas algo antes? Escríbenos a ${SUPPORT}.`);
  const reason = "Recibes este correo porque pediste una reunión desde la página de Banana Burn para condominios.";
  return {
    subject, preheader: lead,
    html: layout({ preheader: lead, hero, body, reason }),
    text: textLayout([subject, "", lead, "", "Qué pasa ahora:", "1. Te confirmamos el día y la hora y te enviamos el enlace de la videollamada.", "2. Reunión virtual de 30 minutos: te mostramos el sistema y cómo se implementa.", "3. Si deciden sumarse, el primer mes es gratis para todos los residentes.", "4. Al terminar el mes, cada residente decide si sigue con su plan individual. La administración y el condominio no pagan nada.", "", `¿Necesitas algo antes? ${SUPPORT}`], undefined, reason),
  };
}
