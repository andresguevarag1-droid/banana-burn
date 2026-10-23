// Plantillas de correo Banana Burn: HTML con estilos en línea (compatible con Gmail/Outlook/iOS Mail),
// en español latino neutro, con versión de texto plano para cada una.
//
// Sigue el libro de marca (Design System "Banana Burn"):
// - Encabezado blanco con el icono y el logotipo escrito: "Banana" en ink y "Burn" en ember-ink.
// - Héroe en banana de verdad (el amarillo es el fondo de los momentos importantes); encima, texto ink.
// - Botón principal ink con texto blanco; botón banana con texto ink solo para la acción de entreno.
// - Eyebrows de 12 px en mayúsculas con tracking .14em; chips activos ink con texto banana.
// - Tarjeta destacada en ink con barra (pista blanca al 14 %, relleno banana); celdas de números en cream.
// - Cifras es-419 de la marca ($9,99 · 2,5 kg · 1.200) con tabular-nums. Sin emojis, sin "·" en el texto, sin IA.
// - Coach Banana firma cada correo; nunca se repite la misma pose de la mascota en un correo.
// Los correos no transaccionales llevan enlace de baja; los transaccionales (bienvenida, plan, pagos) no lo necesitan.
import { SITE_URL } from "../env";

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

/** Cifras como pide la marca: coma decimal y punto de miles (1.200 · 2,5). */
const num = (n: number, max = 1, min = 0) => n.toLocaleString("es-CO", { minimumFractionDigits: min, maximumFractionDigits: max });
const kg = (n: number, max = 1) => num(n, max);

/** $9,99 para USD; otras monedas con su código delante. */
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

/** Una línea para texto plano y push: "Te faltan 6,2 kg para tus 85 kg". */
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

export type PaymentData = { name: string; plan: string; amount: number; currency?: string; date?: string; reference?: string; method?: string; nextCharge?: string | null };

export function reciboPago(d: PaymentData): Email {
  const n = firstName(d.name);
  const total = money(d.amount, d.currency);
  const subject = `Recibo de pago: ${d.plan}, ${total}`;
  const preheader = `Gracias, ${n}. Tu pago de ${total} se procesó correctamente.`;
  const coach = "Gracias por entrenar con nosotros. Ahora a sacarle provecho a cada sesión.";
  const r: [string, string][] = [["Plan", d.plan], ["Total", total], ["Fecha", longDate(d.date ?? new Date().toISOString())]];
  if (d.method) r.push(["Método", d.method]);
  if (d.reference) r.push(["Referencia", d.reference]);
  if (d.nextCharge) r.push(["Próximo cobro", longDate(d.nextCharge)]);
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

export function pagoFallido(d: PaymentData & { retryDate?: string | null; updateUrl?: string }): Email {
  const n = firstName(d.name);
  const total = money(d.amount, d.currency);
  const url = d.updateUrl ?? "/app/perfil";
  const subject = "No pudimos procesar tu pago. Se arregla en 1 minuto";
  const preheader = `Tu cobro de ${total} no pasó. Actualiza tu método de pago y sigues entrenando sin pausa.`;
  const coach = "Tu progreso y tus récords están a salvo. Lo arreglas en un minuto y seguimos.";
  const hero: Hero = { eyebrow: "Pago", title: "Tu pago no pasó", lead: `${esc(n)}, intentamos cobrar <b>${total}</b> de tu plan <b>${esc(d.plan)}</b> y el banco no lo aprobó.` };
  const body =
    p("Pasa seguido: tarjeta vencida, límite o bloqueo de compras en línea.") +
    p(d.retryDate ? `Lo volveremos a intentar el <b>${esc(longDate(d.retryDate))}</b>. Mientras tanto mantienes tu acceso.` : "Mientras tanto mantienes tu acceso.") +
    button("Actualizar método de pago", url) + small("Puedes pagar con otra tarjeta de crédito o débito. ¿Dudas? Responde este correo.");
  const reason = "Recibes este correo porque hubo un problema con el pago de tu suscripción.";
  return {
    subject, preheader,
    html: layout({ preheader, hero, body, reason, coach }),
    text: textLayout([`Hola ${n}, no pudimos cobrar ${total} de tu plan ${d.plan}.`, d.retryDate ? `Lo volveremos a intentar el ${longDate(d.retryDate)}. Mientras tanto mantienes tu acceso.` : "Mientras tanto mantienes tu acceso.", "", `Actualiza tu método de pago: ${abs(url)}`, "Aceptamos tarjetas de crédito y débito."], undefined, reason, coach),
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

// ───────────── Ciclo de vida (llevan enlace de baja) ─────────────

export function recordatorio(d: { name: string; routine: string; mins?: number; exercises?: string[]; streak: number; goal?: Goal | null; unsubscribe: string }): Email {
  const n = firstName(d.name);
  const subject = `${n}, hoy te toca ${d.routine}: tus cargas ya están listas`;
  const gl = goalLine(d.goal);
  const preheader = d.streak >= 2 ? `Vas ${d.streak} días seguidos. Tus cargas de hoy ya están listas.` : gl ? `${gl}. Hoy sumas una sesión más.` : "Tus cargas de hoy ya están calculadas. Solo falta que llegues.";
  const ex = (d.exercises ?? []).slice(0, 5);
  const coach = d.streak >= 7 ? `${d.streak} días sin fallar. Eso ya es un hábito.`
    : d.streak >= 2 ? `No rompas la racha. Hoy vamos por el día ${d.streak + 1}.`
    : "Lo difícil es llegar. De lo demás me encargo yo.";
  const hero: Hero = { eyebrow: "Entreno de hoy", chip: d.streak >= 2 ? `Racha de ${d.streak} días` : undefined, title: `${esc(n)}, hoy te toca ${esc(d.routine)}`, lead: d.mins ? `Son unos ${d.mins} minutos. Ya calculamos cuánto levantar en cada serie.` : "Ya calculamos cuánto levantar en cada serie." };
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
