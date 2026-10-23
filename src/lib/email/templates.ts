// Plantillas de correo Banana Burn: HTML con estilos en línea (compatible con Gmail/Outlook/iOS Mail),
// tema claro con amarillo banana, en español, y versión de texto plano para cada una.
// Los correos no transaccionales llevan enlace de baja; los transaccionales (bienvenida, plan, pagos) no lo necesitan.
import { SITE_URL } from "../env";

export type Email = { subject: string; preheader: string; html: string; text: string };

const C = { paper: "#FFF8E3", card: "#FFFFFF", ink: "#1B1505", body: "#2E2818", muted: "#6A604B", faint: "#A0957C", line: "#EDE3C6", banana: "#FFD60A", soft: "#FFF1A8", peel: "#3F6B0E", ember: "#F2A100" };
const FONT = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path}`);
const kg = (n: number, d = 1) => n.toLocaleString("es-419", { minimumFractionDigits: d, maximumFractionDigits: d });
const firstName = (n: string) => (n || "").trim().split(/\s+/)[0] || "crack";

export const money = (amount: number, currency = "USD") => {
  try { return new Intl.NumberFormat("es-419", { style: "currency", currency }).format(amount); } catch { return `${currency} ${amount.toFixed(2)}`; }
};
export const longDate = (iso: string) => {
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Costa_Rica" });
};

// ───────────── Bloques ─────────────
const p = (html: string) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${C.body};">${html}</p>`;
const h1 = (html: string) => `<h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;font-weight:800;color:${C.ink};letter-spacing:-0.02em;">${html}</h1>`;
const button = (label: string, href: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 8px;"><tr><td style="border-radius:999px;background:${C.ink};">` +
  `<a href="${esc(abs(href))}" style="display:inline-block;padding:15px 28px;font-family:${FONT};font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px;">${esc(label)}</a></td></tr></table>`;
const stats = (items: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;"><tr>` +
  items.map(([v, l]) => `<td width="${Math.floor(100 / items.length)}%" style="padding:4px;"><div style="background:${C.soft};border-radius:16px;padding:14px 8px;text-align:center;">` +
    `<div style="font-size:22px;font-weight:800;color:${C.ink};">${esc(v)}</div><div style="font-size:12px;color:${C.muted};margin-top:2px;">${esc(l)}</div></div></td>`).join("") +
  `</tr></table>`;
/** Viñeta de marca: punto de color (los correos no muestran íconos SVG de forma confiable y no usamos emojis). */
const dot = (color: string = C.banana) => `<span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${color};margin-right:10px;vertical-align:middle;"></span>`;
/** Etiqueta de color para destacar racha, récords o logros. */
const badge = (label: string, bg: string = C.soft, color: string = C.ink) =>
  `<p style="margin:0 0 12px;"><span style="display:inline-block;background:${bg};color:${color};border-radius:999px;padding:5px 12px;font-size:12px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;">${esc(label)}</span></p>`;
const list = (items: string[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;">` +
  items.map((i) => `<tr><td style="padding:9px 12px;border-bottom:1px solid ${C.line};font-size:15px;color:${C.body};">${i}</td></tr>`).join("") + `</table>`;
const rows = (items: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;border:1px solid ${C.line};border-radius:16px;">` +
  items.map(([k, v], i) => `<tr><td style="padding:11px 14px;font-size:14px;color:${C.muted};${i ? `border-top:1px solid ${C.line};` : ""}">${esc(k)}</td><td align="right" style="padding:11px 14px;font-size:14px;font-weight:700;color:${C.ink};${i ? `border-top:1px solid ${C.line};` : ""}">${esc(v)}</td></tr>`).join("") + `</table>`;

function layout(o: { preheader: string; body: string; unsubscribe?: string; reason: string }) {
  const foot = o.unsubscribe
    ? `${esc(o.reason)} <a href="${esc(o.unsubscribe)}" style="color:${C.muted};text-decoration:underline;">Dejar de recibir estos correos</a> · <a href="${esc(abs("/app/perfil#notificaciones"))}" style="color:${C.muted};text-decoration:underline;">Ajustar avisos</a>`
    : esc(o.reason);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>Banana Burn</title></head>
<body style="margin:0;padding:0;background:${C.paper};font-family:${FONT};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(o.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 6px 14px;"><a href="${esc(abs("/app"))}" style="text-decoration:none;font-size:20px;font-weight:800;color:${C.ink};letter-spacing:-0.02em;"><img src="${esc(abs("/icons/icon-192.png"))}" width="32" height="32" alt="" style="display:inline-block;width:32px;height:32px;border:0;border-radius:10px;vertical-align:middle;margin-right:8px;"><span style="vertical-align:middle;">Banana Burn</span></a></td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:24px;overflow:hidden;">
<div style="height:6px;background:${C.banana};border-radius:24px 24px 0 0;"></div>
<div style="padding:28px 24px 22px;">${o.body}</div></td></tr>
<tr><td style="padding:18px 10px 0;font-size:12px;line-height:1.6;color:${C.faint};text-align:center;">${foot}<br>Banana Burn, hecho en Costa Rica · <a href="mailto:hola@bananaburn.app" style="color:${C.faint};">hola@bananaburn.app</a></td></tr>
</table></td></tr></table></body></html>`;
}

function textLayout(lines: string[], unsubscribe?: string, reason?: string) {
  const out = [...lines, "", "-- ", "Banana Burn, hecho en Costa Rica"];
  if (reason) out.push(reason);
  if (unsubscribe) out.push(`Dejar de recibir estos correos: ${unsubscribe}`);
  return out.join("\n");
}

// ───────────── Transaccionales ─────────────

export function bienvenida(d: { name: string }): Email {
  const n = firstName(d.name);
  const subject = `Bienvenido a Banana Burn, ${n}. Tu plan te espera`;
  const preheader = "Tu entrenador con IA ya está listo. Te toma 2 minutos armar tu plan.";
  const body = h1(`¡Pura vida, ${esc(n)}!`) +
    p("Ya tienes tu entrenador personal con IA. Aquí no hay rutinas genéricas: cada sesión trae las cargas calculadas para ti y se ajusta según cómo te va.") +
    list([`${dot()}<b>Rutina del día</b> lista para el gym o la casa`, `${dot(C.ember)}<b>Racha y niveles</b> para que entrenar sea un juego`, `${dot(C.peel)}<b>Comida tica</b> con proteína y calorías claras`, `${dot(C.ink)}<b>Coach IA</b> que conoce tus datos`]) +
    p("Termina tu perfil en 2 minutos y te armamos el plan.") + button("Armar mi plan", "/bienvenida");
  return {
    subject, preheader,
    html: layout({ preheader, body, reason: "Recibes este correo porque creaste una cuenta en Banana Burn." }),
    text: textLayout([`¡Pura vida, ${n}!`, "", "Ya tienes tu entrenador personal con IA: rutina del día con cargas calculadas, racha y niveles, comida tica y un Coach IA que conoce tus datos.", "", `Arma tu plan en 2 minutos: ${abs("/bienvenida")}`], undefined, "Recibes este correo porque creaste una cuenta en Banana Burn."),
  };
}

export function planListo(d: { name: string; trainDays: number; todayRoutine: string; kcal: number; protein: number; startWeight?: number; goalWeight: number; goalDate: string }): Email {
  const n = firstName(d.name);
  const subject = `${n}, tu plan está listo: ${d.trainDays} días por semana`;
  const preheader = `Hoy arrancas con ${d.todayRoutine}. Meta: ${kg(d.goalWeight)} kg el ${longDate(d.goalDate)}.`;
  const body = badge("Plan listo", C.banana) + h1("Tu plan está listo") +
    p(`${esc(n)}, armamos tu programa con base en tus datos. Esto es lo que viene:`) +
    stats([[`${d.trainDays}`, "días/semana"], [d.kcal.toLocaleString("es-419"), "kcal/día"], [`${d.protein} g`, "proteína"]]) +
    rows([["Hoy te toca", d.todayRoutine], ...(d.startWeight ? [["Peso inicial", `${kg(d.startWeight)} kg`] as [string, string]] : []), ["Meta", `${kg(d.goalWeight)} kg`], ["Fecha meta", longDate(d.goalDate)]]) +
    p("Las cargas se calibran en tu primera sesión y suben solas cuando dominas el rango. Tú solo llega y dale.") +
    button("Ver mi entreno de hoy", "/app/entreno");
  return {
    subject, preheader,
    html: layout({ preheader, body, reason: "Recibes este correo porque completaste tu perfil en Banana Burn." }),
    text: textLayout([`Tu plan está listo, ${n}.`, "", `• ${d.trainDays} días por semana`, `• ${d.kcal.toLocaleString("es-419")} kcal/día y ${d.protein} g de proteína`, `• Hoy te toca: ${d.todayRoutine}`, `• Meta: ${kg(d.goalWeight)} kg el ${longDate(d.goalDate)}`, "", `Ver mi entreno de hoy: ${abs("/app/entreno")}`]),
  };
}

export type PaymentData = { name: string; plan: string; amount: number; currency?: string; date?: string; reference?: string; method?: string; nextCharge?: string | null };

export function reciboPago(d: PaymentData): Email {
  const n = firstName(d.name);
  const total = money(d.amount, d.currency);
  const subject = `Recibo de pago: ${d.plan} · ${total}`;
  const preheader = `Gracias, ${n}. Tu pago de ${total} se procesó correctamente.`;
  const r: [string, string][] = [["Plan", d.plan], ["Total", total], ["Fecha", longDate(d.date ?? new Date().toISOString())]];
  if (d.method) r.push(["Método", d.method]);
  if (d.reference) r.push(["Referencia", d.reference]);
  if (d.nextCharge) r.push(["Próximo cobro", longDate(d.nextCharge)]);
  const body = badge("Pago confirmado", C.peel, "#FFFFFF") + h1("Pago recibido, gracias") + p(`Gracias, ${esc(n)}. Tu suscripción a <b>${esc(d.plan)}</b> está activa.`) + rows(r) +
    p(`Guarda este correo como comprobante. ¿Necesitas factura electrónica? Responde a este correo con tu cédula y te la enviamos.`) + button("Ir a mi entreno", "/app");
  return {
    subject, preheader,
    html: layout({ preheader, body, reason: "Recibes este correo como comprobante de tu pago en Banana Burn." }),
    text: textLayout([`¡Pago recibido! Gracias, ${n}.`, "", ...r.map(([k, v]) => `${k}: ${v}`), "", "¿Necesitas factura electrónica? Responde a este correo con tu cédula.", `Ir a la app: ${abs("/app")}`], undefined, "Comprobante de pago de Banana Burn."),
  };
}

export function pagoFallido(d: PaymentData & { retryDate?: string | null; updateUrl?: string }): Email {
  const n = firstName(d.name);
  const total = money(d.amount, d.currency);
  const url = d.updateUrl ?? "/app/perfil";
  const subject = "No pudimos procesar tu pago. Se arregla en 1 minuto";
  const preheader = `Tu cobro de ${total} no pasó. Actualiza tu método de pago y sigues entrenando sin pausa.`;
  const body = h1("Tu pago no pasó") +
    p(`Hola ${esc(n)}, intentamos cobrar <b>${total}</b> de tu plan <b>${esc(d.plan)}</b> y el banco no lo aprobó. Pasa seguido: tarjeta vencida, límite o bloqueo de compras en línea.`) +
    p(d.retryDate ? `Lo volveremos a intentar el <b>${esc(longDate(d.retryDate))}</b>. Mientras tanto mantienes tu acceso.` : "Mientras tanto mantienes tu acceso.") +
    button("Actualizar método de pago", url) + p(`<span style="font-size:14px;color:${C.muted};">Puedes pagar con otra tarjeta de crédito o débito. ¿Dudas? Responde este correo.</span>`);
  return {
    subject, preheader,
    html: layout({ preheader, body, reason: "Recibes este correo porque hubo un problema con el pago de tu suscripción." }),
    text: textLayout([`Hola ${n}, no pudimos cobrar ${total} de tu plan ${d.plan}.`, d.retryDate ? `Lo volveremos a intentar el ${longDate(d.retryDate)}. Mientras tanto mantienes tu acceso.` : "Mientras tanto mantienes tu acceso.", "", `Actualiza tu método de pago: ${abs(url)}`, "Aceptamos tarjetas de crédito y débito."]),
  };
}

export function suscripcionCancelada(d: { name: string; plan: string; accessUntil?: string | null }): Email {
  const n = firstName(d.name);
  const subject = "Tu suscripción fue cancelada";
  const preheader = d.accessUntil ? `Mantienes acceso hasta el ${longDate(d.accessUntil)}. Tu progreso queda guardado.` : "Tu progreso queda guardado por si decides volver.";
  const body = h1("Listo, cancelamos tu suscripción") +
    p(`${esc(n)}, confirmamos la cancelación de <b>${esc(d.plan)}</b>. No se harán más cobros.`) +
    (d.accessUntil ? p(`Sigues teniendo acceso completo hasta el <b>${esc(longDate(d.accessUntil))}</b>.`) : "") +
    p("Tus entrenos, récords y pesajes quedan guardados. Si vuelves, retomas exactamente donde ibas.") +
    p("¿Nos cuentas por qué te vas? Responde este correo; lo leemos todo y nos ayuda a mejorar.") + button("Reactivar mi plan", "/precios");
  return {
    subject, preheader,
    html: layout({ preheader, body, reason: "Recibes este correo como confirmación de un cambio en tu suscripción." }),
    text: textLayout([`${n}, confirmamos la cancelación de ${d.plan}. No se harán más cobros.`, d.accessUntil ? `Mantienes acceso hasta el ${longDate(d.accessUntil)}.` : "", "Tus datos y progreso quedan guardados.", "", `Reactivar: ${abs("/precios")}`]),
  };
}

// ───────────── Ciclo de vida (llevan enlace de baja) ─────────────

export function recordatorio(d: { name: string; routine: string; mins?: number; exercises?: string[]; streak: number; unsubscribe: string }): Email {
  const n = firstName(d.name);
  const subject = `Hoy te toca ${d.routine}: tus cargas ya están listas`;
  const preheader = d.streak >= 2 ? `Vas ${d.streak} días seguidos. Tus cargas de hoy ya están listas.` : "Tus cargas de hoy ya están calculadas. Solo falta que llegues.";
  const ex = (d.exercises ?? []).slice(0, 5);
  const body = h1(`${esc(n)}, hoy te toca ${esc(d.routine)}`) +
    p(d.mins ? `Son unos <b>${d.mins} minutos</b>. Ya calculamos cuánto levantar en cada serie.` : "Ya calculamos cuánto levantar en cada serie.") +
    (ex.length ? list(ex.map((e) => `${dot()}${esc(e)}`)) : "") +
    (d.streak >= 2 ? badge(`Racha de ${d.streak} días`, C.ember, "#FFFFFF") + p("Hoy la haces crecer.") : "") +
    button("Empezar entreno", "/app/entreno");
  const reason = "Recibes este recordatorio porque lo activaste en Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, body, unsubscribe: d.unsubscribe, reason }),
    text: textLayout([`${n}, hoy te toca ${d.routine}.`, d.mins ? `Unos ${d.mins} minutos. Tus cargas ya están calculadas.` : "Tus cargas ya están calculadas.", ...ex.map((e) => `• ${e}`), d.streak >= 2 ? `Racha: ${d.streak} días` : "", "", `Empezar: ${abs("/app/entreno")}`], d.unsubscribe, reason),
  };
}

export function rachaEnPeligro(d: { name: string; streak: number; unsubscribe: string }): Email {
  const n = firstName(d.name);
  const subject = `Tu racha de ${d.streak} días sigue viva`;
  const preheader = "Con un check-in de 2 minutos la mantienes. Mañana vas por otro día.";
  const body = badge(`Racha de ${d.streak} días`, C.ember, "#FFFFFF") + h1(`${d.streak} días seguidos, ${esc(n)}`) +
    p("Hoy todavía no registraste nada, y no hace falta un entreno para mantener la racha: un check-in cuenta.") +
    list([`${dot("#3B9EFF")}Anota tus vasos de agua`, `${dot()}Registra tu peso`, `${dot(C.ink)}Cuéntanos cómo dormiste`]) +
    p(`Dos minutos y mañana vas por el día <b>${d.streak + 1}</b>.`) + button("Hacer mi check-in", "/app");
  const reason = "Recibes este aviso porque activaste los recordatorios de Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, body, unsubscribe: d.unsubscribe, reason }),
    text: textLayout([`${d.streak} días seguidos, ${n}.`, "Un check-in rápido (agua, peso o sueño) mantiene tu racha.", `Mañana vas por el día ${d.streak + 1}.`, "", `Hacer mi check-in: ${abs("/app")}`], d.unsubscribe, reason),
  };
}

export type WeeklyData = {
  name: string; workouts: number; planned: number; streak: number;
  kgStart?: number | null; kgEnd?: number | null; trendPerWeek?: number | null;
  prs: string[]; nextWeek: { day: string; name: string }[]; unsubscribe: string;
};

export function resumenSemanal(d: WeeklyData): Email {
  const n = firstName(d.name);
  const delta = d.kgStart != null && d.kgEnd != null ? Math.round((d.kgEnd - d.kgStart) * 10) / 10 : null;
  const kgLabel = delta == null ? "Sin pesaje" : delta === 0 ? "0.0 kg" : `${delta > 0 ? "+" : ""}${kg(delta)} kg`;
  const headline = d.workouts >= d.planned && d.planned > 0 ? `Semana completa: ${d.workouts}/${d.planned} entrenos` : d.workouts > 0 ? `${d.workouts} entrenos esta semana` : "Una semana nueva para arrancar";
  const subject = `Tu semana: ${d.workouts} entrenos${delta != null ? ` · ${kgLabel}` : ""}`;
  const preheader = d.prs.length ? `${d.prs.length} récord${d.prs.length > 1 ? "s" : ""} personal${d.prs.length > 1 ? "es" : ""} y tu plan para esta semana.` : "Tu progreso y lo que viene esta semana.";
  const trend = d.trendPerWeek == null ? "" : d.trendPerWeek < 0 ? p(`Tu tendencia es <b>${kg(Math.abs(d.trendPerWeek), 2)} kg/semana</b> hacia abajo. Vas bien.`) : d.trendPerWeek > 0 ? p(`La báscula subió un poco (${kg(d.trendPerWeek, 2)} kg/semana). Es normal que fluctúe: lo que manda es la tendencia de varias semanas. Tu plan se ajusta solo.`) : p("Peso estable esta semana.");
  const body = (d.workouts >= d.planned && d.planned > 0 ? badge("Semana completa", C.banana) : "") + h1(esc(headline)) + p(`${esc(n)}, así te fue en los últimos 7 días:`) +
    stats([[d.planned ? `${d.workouts}/${d.planned}` : `${d.workouts}`, "entrenos"], [kgLabel, "peso"], [`${d.streak} días`, "racha"]]) + trend +
    (d.prs.length ? badge("Récords personales", C.banana) + list(d.prs.slice(0, 5).map((x) => `${dot(C.ember)}${esc(x)}`)) : "") +
    (d.nextWeek.length ? `<p style="margin:8px 0 6px;font-size:14px;font-weight:800;color:${C.ink};">Esta semana</p>` + list(d.nextWeek.map((x) => `${dot()}<b>${esc(x.day)}</b> · ${esc(x.name)}`)) : "") +
    button("Ver mi progreso", "/app/progreso");
  const reason = "Recibes el resumen semanal porque lo activaste en Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, body, unsubscribe: d.unsubscribe, reason }),
    text: textLayout([headline, "", `Entrenos: ${d.planned ? `${d.workouts}/${d.planned}` : d.workouts}`, `Peso: ${kgLabel}`, `Racha: ${d.streak} días`, ...(d.prs.length ? ["", "Récords:", ...d.prs.slice(0, 5).map((x) => `• ${x}`)] : []), ...(d.nextWeek.length ? ["", "Esta semana:", ...d.nextWeek.map((x) => `• ${x.day}: ${x.name}`)] : []), "", `Ver mi progreso: ${abs("/app/progreso")}`], d.unsubscribe, reason),
  };
}

export function reactivacion(d: { name: string; days: 3 | 7; routine: string; trainingDay: boolean; unsubscribe: string }): Email {
  const n = firstName(d.name);
  const three = d.days === 3;
  const subject = three ? `Te guardamos el lugar, ${n}` : "Empezamos de nuevo, sin presión";
  const preheader = three ? "Volver es más fácil con una sesión corta. Tu plan sigue igualito." : "Tus datos y tu plan siguen aquí. 20 minutos hoy y arrancamos.";
  const today = d.trainingDay ? `Hoy te toca <b>${esc(d.routine)}</b>.` : "Hoy es día de descanso activo: una caminata y 10 minutos de estiramiento cuentan.";
  const body = h1(three ? `Te guardamos el lugar, ${esc(n)}` : "Empezamos de nuevo, sin presión") +
    p(three ? "La vida pasa, y está bien. Lo que importa es la siguiente sesión, no las que quedaron atrás." : "Una semana fuera no borra nada: tus récords, tu historial y tu plan siguen aquí.") +
    p(today) + p("Si te cuesta arrancar, haz solo los dos primeros ejercicios. Casi siempre terminas la sesión.") +
    button(d.trainingDay ? "Volver con una sesión corta" : "Hacer mi check-in", d.trainingDay ? "/app/entreno" : "/app");
  const reason = "Recibes este correo porque tienes activados los recordatorios de Banana Burn.";
  return {
    subject, preheader,
    html: layout({ preheader, body, unsubscribe: d.unsubscribe, reason }),
    text: textLayout([subject, "", three ? "La vida pasa, y está bien. Lo que importa es la siguiente sesión." : "Tus récords, tu historial y tu plan siguen aquí.", d.trainingDay ? `Hoy te toca ${d.routine}.` : "Hoy: caminata y 10 minutos de estiramiento.", "Tip: haz solo los dos primeros ejercicios. Casi siempre terminas la sesión.", "", `Volver: ${abs(d.trainingDay ? "/app/entreno" : "/app")}`], d.unsubscribe, reason),
  };
}
