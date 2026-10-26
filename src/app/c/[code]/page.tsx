// Enlace de un condominio afiliado (0053): https://www.bananaburn.app/c/<código>. Lo reciben los residentes por el afiche
// con QR del gimnasio o el mensaje del grupo de WhatsApp. Explica el regalo y activa el mes gratis:
//   - Sin sesión: "Activar mi mes gratis" lleva a /c/<código>/activar (cookie + registro); al crear la cuenta queda vinculada.
//   - Con sesión: un botón (POST, mismo sitio) la vincula. Un GET nunca vincula una cuenta.
// noindex. Texto con el libro de marca: tú, sin emojis, sin rayas largas, sin cadenas con "·".
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand";
import { ArrowRight, Barbell, Buildings, ChatCircle, Check, CheckCircle, ForkKnife, Gift, Lock, Sparkle, Warning, type PhosphorIcon } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/env";
import { condoOffer, joinMessage, normalizeCondoCode, type CondoRow, type JoinDecision } from "@/lib/condos";
import { condoByCode } from "@/lib/condos-server";
import { longDate } from "@/lib/email/templates";
import { TECHNIQUE_COUNT } from "@/lib/exercise-frames";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Tu mes gratis de Banana Burn" },
  description: "Tu condominio te regala el primer mes de Banana Burn: tu entrenador personal en el celular.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const PERKS: [PhosphorIcon, string, string][] = [
  [Barbell, "Tu plan de cada semana", "Series, repeticiones y el peso de cada serie, con el equipo del gimnasio del condominio o en casa."],
  [Sparkle, "Técnica animada", `${TECHNIQUE_COUNT} técnicas animadas por Coach Banana para que nunca entrenes a ciegas.`],
  [ChatCircle, "Coach Banana 24/7", "Resuelve tus dudas a cualquier hora, con tu plan y tus entrenos a la vista."],
  [ForkKnife, "Plan de comidas", "El mes gratis incluye nutrición: calorías, proteína y comidas para tu meta."],
];

const RESULTS = new Set<JoinDecision["kind"]>(["join", "inactivo", "ya_vinculado", "otro_condominio", "ya_usado", "plan_pagado"]);

export default async function CondoLink({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ estado?: string }> }) {
  const code = normalizeCondoCode((await params).code);
  if (!code) notFound();
  const estadoRaw = (await searchParams).estado;
  const estado = estadoRaw && RESULTS.has(estadoRaw as JoinDecision["kind"]) ? (estadoRaw as JoinDecision["kind"]) : null;
  const db = adminClient();
  const demo = !db && isDemoMode;
  const condo: CondoRow | null = db ? await condoByCode(db, code)
    : demo ? { id: 0, code, name: "Condominio de ejemplo", status: "mes_gratis", free_ends_at: null, paid_plan: null, paid_until: null } : null;
  const v = await getViewer().catch(() => null);
  let member = false, grantUntil: string | null = null;
  if (v && !v.demo && db && condo) {
    const { data } = await db.from("condo_members").select("condo_id,grant_id").eq("user_id", v.id).maybeSingle();
    const m = data as { condo_id: number; grant_id: number | null } | null;
    member = m?.condo_id === condo.id;
    if (member && m?.grant_id) {
      const { data: g } = await db.from("comp_grants").select("expires_at").eq("id", m.grant_id).maybeSingle();
      grantUntil = (g as { expires_at: string } | null)?.expires_at ?? null;
    }
  }
  if (v?.demo && estado === "join") { member = true; grantUntil = new Date(Date.now() + 30 * 864e5).toISOString(); }
  const offer = condo ? condoOffer(condo) : null;
  const name = condo?.name ?? "tu condominio";
  // Qué se muestra: vinculado (éxito), un resultado que no es éxito, la oferta o el enlace inactivo.
  const view: "member" | "result" | "offer" | "inactive" = member ? "member" : estado && estado !== "join" ? "result" : offer ? "offer" : "inactive";
  const msg = joinMessage(view === "member" ? "join" : view === "result" ? estado! : "inactivo", name);
  const cta = offer?.free === false ? "Activar mi acceso" : "Activar mi mes gratis";
  const live = grantUntil && Date.parse(grantUntil) > Date.now();

  return (
    <div className="min-h-dvh bg-paper text-body">
      <header className="border-b border-line/70 bg-paper">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo href={`/c/${code}`} compact />
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <section className="rounded-[2rem] bg-banana p-6 sm:p-10">
          <p className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[13px] font-bold text-banana"><Buildings weight="fill" className="size-4" />{name}</p>
          {view === "offer" && (
            <>
              <h1 className="mt-5 text-[2.1rem] font-extrabold leading-[1.06] tracking-tight text-ink text-balance sm:text-5xl">
                {offer?.free ? <>Tu condominio te regala el primer mes de Banana Burn.</> : <>Tu condominio te da Banana Burn.</>}
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-ink/85 text-pretty">
                {offer?.free
                  ? "Un entrenador personal en tu celular, con todo incluido durante 30 días. Sin tarjeta y sin pagar nada."
                  : `Un entrenador personal en tu celular, pagado por ${name}. Sin tarjeta y sin pagar nada.`}
              </p>
              {v ? (
                <form action={`/c/${code}/activar`} method="post" className="mt-7">
                  <button type="submit" className="btn-primary h-14! w-full px-7! text-base! sm:w-auto">{cta} <ArrowRight weight="bold" className="size-5" /></button>
                  <p className="mt-3 text-sm text-ink/75">Se activa en la cuenta con la que entraste: {v.email}.</p>
                </form>
              ) : (
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <a href={`/c/${code}/activar`} className="btn-primary h-14! px-7! text-base!">{cta} <ArrowRight weight="bold" className="size-5" /></a>
                  <a href={`/c/${code}/activar?cuenta=1`} className="tap inline-flex h-12 items-center justify-center px-2 font-bold text-ink underline decoration-ink/30 underline-offset-4">Ya tengo cuenta</a>
                </div>
              )}
            </>
          )}
          {view === "member" && (
            <div role="status">
              <span className="mt-5 grid size-14 place-items-center rounded-full bg-ink text-banana"><Gift weight="fill" className="size-8" /></span>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-ink text-balance sm:text-4xl">{msg.title}</h1>
              <p className="mt-3 text-lg text-ink/85 text-pretty">{live ? `Tienes Banana Burn hasta el ${longDate(grantUntil!)}.` : "Tu cuenta está vinculada a tu condominio."} {msg.body}</p>
              <Link href="/app" className="btn-primary mt-7 h-14! px-7! text-base!">{v?.onboarded === false ? "Armar mi plan" : "Ir a mi entreno"} <ArrowRight weight="bold" className="size-5" /></Link>
            </div>
          )}
          {(view === "result" || view === "inactive") && (
            <div role={view === "result" ? "status" : undefined}>
              <span className="mt-5 grid size-14 place-items-center rounded-full bg-ink text-banana">{estado === "plan_pagado" ? <CheckCircle weight="fill" className="size-8" /> : <Warning weight="fill" className="size-8" />}</span>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-ink text-balance sm:text-4xl">{msg.title}</h1>
              <p className="mt-3 text-lg text-ink/85 text-pretty">{msg.body}</p>
              <Link href={v ? "/app" : "/"} className="btn-primary mt-7 h-14! px-7! text-base!">{v ? "Ir a la app" : "Conocer Banana Burn"} <ArrowRight weight="bold" className="size-5" /></Link>
            </div>
          )}
        </section>

        {view === "offer" && (
          <>
            <section className="mt-10">
              <h2 className="text-2xl font-extrabold tracking-tight text-ink">{offer?.free ? "Lo que incluye tu mes gratis" : "Lo que incluye"}</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {PERKS.filter(([, t]) => offer?.plan === "completo" || t !== "Plan de comidas").map(([I, t, d]) => (
                  <li key={t} className="card flex gap-4 p-5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-banana-soft text-banana-ink"><I weight="duotone" className="size-6" /></span>
                    <div><h3 className="font-extrabold text-ink">{t}</h3><p className="mt-0.5 text-[15px] text-pretty">{d}</p></div>
                  </li>
                ))}
              </ul>
            </section>
            <section className="mt-10 rounded-[1.5rem] bg-white p-6 ring-1 ring-line">
              <h2 className="text-xl font-extrabold text-ink">Cómo funciona</h2>
              <ul className="mt-4 space-y-3 text-[15px]">
                {[
                  "Creas tu cuenta en 2 minutos desde el celular. No necesitas tarjeta.",
                  offer?.free ? "Tienes 30 días con todo incluido desde que lo activas." : "Tu acceso dura mientras el condominio mantenga su plan.",
                  "Al terminar, tú decides si sigues con un plan individual o dejas de usar la app. No te cobramos nada automáticamente.",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-banana"><Check weight="bold" className="size-3" /></span>{t}</li>
                ))}
              </ul>
            </section>
            <p className="mt-6 flex items-start gap-3 text-[15px] text-pretty"><Lock weight="duotone" className="mt-0.5 size-5 shrink-0 text-banana-ink" />Tus datos son privados. La administración del condominio solo ve cuántos residentes se unieron, nunca tu peso, tus entrenos ni tu comida.</p>
          </>
        )}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Banana Burn es un producto de Atlas Resources SRL, Costa Rica.</p>
          <p className="flex gap-4"><Link href="/privacidad" className="tap underline underline-offset-2">Privacidad</Link><Link href="/terminos" className="tap underline underline-offset-2">Términos</Link></p>
        </div>
      </footer>
    </div>
  );
}
