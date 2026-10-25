import "server-only";
// Atribución de una cuenta recién creada (registro, enlace de confirmación o Google). Primero el programa de referidores
// (0051, cookie de ?ref=); si la cuenta queda de un referidor, NO se atribuye a "Invita y gana" (0025): una misma persona
// nunca genera comisión y meses gratis a la vez. Nunca lanza ni bloquea el registro.
// Aparte, el enlace de un condominio afiliado (0053, cookie de /c/<código>/activar) vincula la cuenta y le da su mes gratis.
import { attributeAffiliate } from "@/lib/affiliates-server";
import { joinCondoFromCookie } from "@/lib/condos-server";
import { attributeReferral } from "@/lib/referrals-server";

export async function attributeNewAccount(userId: string, email: string | null | undefined): Promise<void> {
  await joinCondoFromCookie(userId).catch(() => null);
  const aff = await attributeAffiliate(userId).catch(() => "error");
  if (aff === "atribuida") return;
  await attributeReferral(userId, email).catch(() => null);
}
