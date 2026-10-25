"use server";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";
import { redeemInvite } from "@/lib/affiliates-server";

export async function acceptInvite(fd: FormData) {
  const t = String(fd.get("t") ?? "");
  const v = await getViewer();
  if (!v) redirect(`/entrar?next=${encodeURIComponent(`/referidor/invitacion?t=${t}`)}`);
  if (v.demo) redirect("/app/afiliados");
  const r = await redeemInvite(v.id, v.email, t);
  if (!r.ok) redirect(`/referidor/invitacion?t=${encodeURIComponent(t)}&e=${r.reason}`);
  const { sendAffiliateEmail } = await import("@/lib/email");
  await sendAffiliateEmail({ userId: v.id, key: `bienvenida/${v.id}`, kind: "bienvenida", code: r.code }).catch(() => null);
  redirect(v.onboarded ? "/app/afiliados" : "/bienvenida");
}
