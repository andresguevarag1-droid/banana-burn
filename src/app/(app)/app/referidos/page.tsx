import Image from "next/image";
import Link from "next/link";
import { Gift, Info } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { getReferralPage } from "@/lib/referrals-server";
import { monthsEarned, referralLabel, referralProgress, REF_ANNUAL_MONTHS, REF_GROUP_SIZE, REF_MAX_REWARDS_YEAR, REF_WINDOW_DAYS, type RefTone } from "@/lib/referrals";
import { monthsLabel, planLabel } from "@/lib/gifts";
import { ShareLink } from "./share";

export const metadata = { title: "Invita y gana", robots: { index: false } };

const TONE: Record<RefTone, string> = {
  good: "bg-peel/10 text-peel",
  banana: "bg-banana text-ink",
  warn: "bg-ember/15 text-ember-ink",
  muted: "bg-line text-muted",
};
const fmt = (iso: string, tz: string) => new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: tz });

const RULES: [string, string][] = [
  ["Comparte tu enlace", `Tu amigo crea su cuenta con él y tiene ${REF_WINDOW_DAYS} días gratis con todo incluido.`],
  ["Cuenta cuando se activa", `Termina su bienvenida y, en sus primeros ${REF_WINDOW_DAYS} días, completa un entreno o registra su agua, pasos o sueño.`],
  [`Cada ${REF_GROUP_SIZE} amigos activos: 1 mes gratis`, "Se suma al final de tu acceso actual. No pagas nada y no pierdes ni un día."],
  [`Si uno de esos ${REF_GROUP_SIZE} compra el plan anual`, `Ese mes se convierte en ${REF_ANNUAL_MONTHS} meses gratis.`],
];

export default async function Referidos() {
  const v = (await getViewer())!;
  const d = await getReferralPage(v);
  const prog = referralProgress(d.referrals);
  const earned = monthsEarned(d.rewards);
  const active = d.referrals.filter((r) => r.status === "calificado").length;

  return (
    <div className="max-w-2xl space-y-5 animate-enter">
      <header className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Invita y gana</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink text-balance">Entrena con tus amigos y gana meses gratis</h1>
        </div>
        <Image src="/brand/mascota-sola.webp" alt="" width={96} height={96} className="size-20 shrink-0 object-contain sm:size-24" />
      </header>

      {d.demo && (
        <p className="flex items-start gap-2.5 rounded-2xl bg-ink p-4 text-sm text-white/90">
          <Info weight="duotone" className="size-5 shrink-0 text-banana" />
          <span><b>Modo demo:</b> el enlace, las personas y las recompensas de esta página son de ejemplo.</span>
        </p>
      )}

      {d.unavailable ? (
        <p className="rounded-2xl bg-banana-soft p-4 text-sm font-semibold text-banana-ink">Invita y gana todavía no está disponible. Vuelve pronto.</p>
      ) : (<>
        <section aria-labelledby="ref-progreso" className="rounded-[1.5rem] bg-banana p-5 text-ink sm:p-6">
          <h2 id="ref-progreso" className="text-lg font-extrabold">{prog.text}</h2>
          <ol className="mt-4 grid grid-cols-3 gap-2" aria-label={`${prog.have} de ${prog.need} amigos activos para tu próximo mes gratis`}>
            {Array.from({ length: prog.need }, (_, i) => (
              <li key={i} className={`grid h-14 place-items-center rounded-2xl text-sm font-extrabold transition-colors duration-200 ease-out ${i < prog.have ? "bg-ink text-banana" : "border-2 border-dashed border-ink/25 text-body"}`}>
                {i < prog.have ? "Activo" : `Amigo ${i + 1}`}
              </li>
            ))}
          </ol>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-2xl bg-white/70 p-3"><dt className="font-semibold text-ink/70">Amigos activos</dt><dd className="text-2xl font-extrabold tabular-nums">{active.toLocaleString("es-CO")}</dd></div>
            <div className="rounded-2xl bg-white/70 p-3"><dt className="font-semibold text-ink/70">Meses ganados</dt><dd className="text-2xl font-extrabold tabular-nums">{earned.toLocaleString("es-CO")}</dd></div>
          </dl>
        </section>

        {d.link && (
          <section aria-label="Tu enlace para invitar" className="card p-5 sm:p-6">
            <ShareLink link={d.link} demo={d.demo} />
          </section>
        )}

        <section aria-labelledby="ref-reglas" className="card p-5 sm:p-6">
          <h2 id="ref-reglas" className="font-extrabold text-ink">Cómo funciona</h2>
          <ol className="mt-3 space-y-3">
            {RULES.map(([t, b], i) => (
              <li key={t} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-banana-soft text-sm font-extrabold text-banana-ink" aria-hidden>{i + 1}</span>
                <div className="min-w-0"><p className="font-bold text-ink">{t}</p><p className="text-sm text-muted">{b}</p></div>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-2xl bg-paper p-3 text-xs text-muted text-pretty">
            Cada persona cuenta una sola vez y solo con una cuenta nueva. No cuentan cuentas propias ni repetidas; si algo se ve raro, el equipo lo revisa antes de contarlo.
            La compra anual cuenta cuando se confirma el pago. Máximo {REF_MAX_REWARDS_YEAR} premios por año.
          </p>
        </section>

        <section aria-labelledby="ref-lista" className="card p-5 sm:p-6">
          <h2 id="ref-lista" className="font-extrabold text-ink">Tus invitados</h2>
          {d.referrals.length ? (
            <ul className="mt-3 divide-y divide-line">
              {d.referrals.map((r, i) => {
                const st = referralLabel(r);
                return (
                  <li key={i} className="flex items-center gap-3 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-banana-soft font-extrabold text-banana-ink" aria-hidden>{r.initial}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink"><span className="sr-only">Persona con inicial </span>{r.initial}.</p>
                      <p className="text-xs text-muted">Se unió el {fmt(r.created_at, v.tz)}</p>
                    </div>
                    <span className={`chip shrink-0 ${TONE[st.tone]}`}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Todavía no hay invitados. Comparte tu enlace con alguien que quiera empezar a entrenar.</p>
          )}
        </section>

        <section aria-labelledby="ref-premios" className="card p-5 sm:p-6">
          <h2 id="ref-premios" className="flex items-center gap-2 font-extrabold text-ink"><Gift weight="duotone" className="size-5 text-banana-ink" />Tus recompensas</h2>
          {d.rewards.length ? (
            <ul className="mt-3 divide-y divide-line">
              {d.rewards.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className={`font-bold ${w.revoked_at ? "text-muted line-through" : "text-ink"}`}>{monthsLabel(w.months)} de {planLabel(w.plan)}</p>
                    <p className="text-xs text-muted">{w.revoked_at ? "Anulada por el equipo" : w.upgraded_at ? "Subió a 3 meses por una compra anual" : `Ganada el ${fmt(w.created_at, v.tz)}`}</p>
                  </div>
                  <span className={`chip shrink-0 ${w.revoked_at ? TONE.muted : TONE.good}`}>{w.revoked_at ? "Anulada" : "Ganada"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Con tus primeros {REF_GROUP_SIZE} amigos activos ganas tu primer mes gratis.</p>
          )}
          <Link href="/app/suscripcion" className="tap mt-3 inline-flex text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">Ver mis regalos en Mi plan</Link>
        </section>
      </>)}
    </div>
  );
}
