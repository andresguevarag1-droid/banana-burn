import "server-only";
// Comprobante electrónico de Hacienda (Costa Rica) por cada cobro exitoso (#334, 0074). Diseño y preguntas abiertas en
// docs/pagos/factura-electronica.md.
//   - Cola: notifyPaid (billing.ts) deja un billing_documents en 'pendiente', una sola vez por cobro (charge_id único).
//   - Emisión: solo con ALEGRA_ENABLED=1 y las credenciales de Alegra. Apagada (por defecto) no se llama a Alegra y las
//     filas se quedan en 'pendiente' hasta que Andrés la prenda. Nunca bloquea el cobro ni el recibo.
import type { SupabaseClient } from "@supabase/supabase-js";

export type DocKind = "tiquete" | "factura" | "exportacion";
export type DocStatus = "pendiente" | "emitido" | "error";
export type BillingDocument = {
  id: number; charge_id: string; user_id: string | null; provider: "onvo" | "tilopay"; kind: DocKind; status: DocStatus;
  amount_minor: number | null; currency: string | null; number: string | null; hacienda_key: string | null; pdf_url: string | null;
  provider_document_id: string | null; attempts: number;
};

export const ALEGRA_API = "https://api.alegra.com/api/v1";
/** IVA de Costa Rica para servicios digitales: el precio publicado ya lo incluye. */
export const IVA_CR = 0.13;

/** ¿Se emite con Alegra? Solo con ALEGRA_ENABLED=1 y las credenciales (ALEGRA_USER, ALEGRA_TOKEN). */
export function alegraEnabled(vars: NodeJS.ProcessEnv = process.env): boolean {
  if (vars.ALEGRA_ENABLED?.trim() !== "1") return false;
  return Boolean(vars.ALEGRA_USER?.trim() && vars.ALEGRA_TOKEN?.trim());
}

/** Un comprobante por cobro: la misma referencia que hace idempotente el recibo. */
export const chargeIdFor = (provider: "onvo" | "tilopay", reference: string) => `${provider}:${reference}`;

/** Base imponible e IVA (en centavos) de un total con IVA incluido. El IVA es lo que falta para llegar al total. */
export function splitIva(totalMinor: number, rate = IVA_CR): { netMinor: number; ivaMinor: number } {
  const netMinor = Math.round(totalMinor / (1 + rate));
  return { netMinor, ivaMinor: totalMinor - netMinor };
}

/** Deja el comprobante del cobro en 'pendiente'. Un segundo aviso del mismo cobro no crea otro. */
export async function enqueueBillingDocument(db: SupabaseClient, c: { userId: string; provider: "onvo" | "tilopay"; reference: string; amountMinor: number | null; currency: string | null }): Promise<"creado" | "duplicado"> {
  const { error } = await db.from("billing_documents").insert({
    charge_id: chargeIdFor(c.provider, c.reference), user_id: c.userId, provider: c.provider, kind: "tiquete", status: "pendiente", attempts: 0,
    amount_minor: c.amountMinor, currency: c.currency?.toUpperCase() ?? null,
  });
  if (!error) return "creado";
  if (error.code === "23505") return "duplicado";
  throw new Error(`billing_documents: ${error.message}`);
}

/**
 * Emite con Alegra el comprobante de un cobro. Con la bandera apagada no hace nada (ni una llamada a Alegra).
 * Sin la clave de Hacienda en la respuesta, la fila sigue en 'pendiente' con el id de Alegra para revisarla a mano.
 */
export async function issueBillingDocument(db: SupabaseClient, chargeId: string, vars: NodeJS.ProcessEnv = process.env): Promise<DocStatus | "apagado" | "no existe"> {
  if (!alegraEnabled(vars)) return "apagado";
  const { data } = await db.from("billing_documents").select("*").eq("charge_id", chargeId).maybeSingle();
  const doc = data as BillingDocument | null;
  if (!doc) return "no existe";
  if (doc.status === "emitido") return "emitido";
  const now = new Date().toISOString();
  try {
    const out = await createAlegraInvoice(doc, vars);
    const emitted = !!out.haciendaKey;
    await db.from("billing_documents").update({
      status: emitted ? "emitido" : "pendiente", provider_document_id: out.id, number: out.number, hacienda_key: out.haciendaKey, pdf_url: out.pdfUrl,
      issued_at: emitted ? now : null, attempts: doc.attempts + 1, last_error: emitted ? null : "Alegra no devolvió la clave de Hacienda", updated_at: now,
    }).eq("id", doc.id);
    return emitted ? "emitido" : "pendiente";
  } catch (e) {
    await db.from("billing_documents").update({ status: "error", attempts: doc.attempts + 1, last_error: String((e as Error)?.message ?? e).slice(0, 500), updated_at: now }).eq("id", doc.id);
    return "error";
  }
}

/**
 * POST /invoices de Alegra con el sello electrónico (stamp.generateStamp). El cliente (consumidor final), el producto y el
 * impuesto son ids que Andrés crea en Alegra: ALEGRA_CLIENT_ID, ALEGRA_ITEM_ID, ALEGRA_TAX_ID. Alegra recibe el precio sin
 * IVA y le suma el impuesto. Hay que validarlo en la empresa de prueba de Alegra antes de prender la bandera.
 */
async function createAlegraInvoice(doc: BillingDocument, vars: NodeJS.ProcessEnv): Promise<{ id: string | null; number: string | null; haciendaKey: string | null; pdfUrl: string | null }> {
  if (doc.amount_minor == null) throw new Error("cobro sin monto");
  const { netMinor } = splitIva(doc.amount_minor);
  const today = new Date().toISOString().slice(0, 10);
  const auth = Buffer.from(`${vars.ALEGRA_USER?.trim()}:${vars.ALEGRA_TOKEN?.trim()}`).toString("base64");
  const res = await fetch(`${ALEGRA_API}/invoices`, {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      date: today, dueDate: today,
      client: { id: Number(vars.ALEGRA_CLIENT_ID) },
      items: [{ id: Number(vars.ALEGRA_ITEM_ID), price: netMinor / 100, quantity: 1, tax: [{ id: Number(vars.ALEGRA_TAX_ID) }] }],
      observations: `Banana Burn, cobro ${doc.charge_id}`,
      stamp: { generateStamp: true },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) throw new Error(`Alegra ${res.status}: ${String(body?.message ?? "sin detalle").slice(0, 300)}`);
  const stamp = (body?.stamp ?? {}) as Record<string, unknown>;
  const key = [stamp.cufe, stamp.key, stamp.uuid].find((v) => typeof v === "string" && /^[0-9]{50}$/.test(v)) as string | undefined;
  const tpl = (body?.numberTemplate ?? {}) as Record<string, unknown>;
  const pdf = typeof body?.pdf === "string" && body.pdf.startsWith("https://") ? body.pdf : null;
  return { id: body?.id != null ? String(body.id) : null, number: typeof tpl.fullNumber === "string" ? tpl.fullNumber : null, haciendaKey: key ?? null, pdfUrl: pdf };
}
