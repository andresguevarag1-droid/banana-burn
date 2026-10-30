import { NextResponse } from "next/server";
import { hitLimit, tooMany } from "@/lib/security/limits";
import { dispatchAdminEvents } from "@/lib/admin-avisos-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Despierta al despachador de avisos al dueño (0059). Lo llama la base (pg_net) cuando entra un aviso nuevo.
 * No recibe datos ni devuelve contenido: solo vacía la bandeja con service_role, así que llamarla de más no expone nada
 * ni duplica avisos (cada uno se reclama una vez). Igual tiene un tope para que nadie la use de martillo.
 */
async function handle() {
  const lim = await hitLimit("avisos:despachar", "global");
  if (!lim.ok) return tooMany(lim);
  const r = await dispatchAdminEvents();
  return NextResponse.json({ ok: true, avisos: r.events });
}

export const POST = handle;
