import Link from "next/link";
import { notFound } from "next/navigation";
import { Flask, Gift, Lock, ArrowCounterClockwise as RotateCcw, Trash, UserGear as UserCog, ShieldWarning } from "@/components/icons";
import { requireSection } from "@/lib/admin-auth";
import { CATEGORY_LABEL, STATUS_LABEL, type SupportCategory, type SupportStatus } from "@/lib/support";
import { ACTIVITY_LABEL, getUserDetail, PLAN_LABEL, statusOf } from "@/lib/admin";
import { assignableRoles, can, PRIVILEGED, ROLE_LABEL, canSee } from "@/lib/admin-perms";
import { isUuid } from "@/lib/admin-validate";
import { addDays } from "@/lib/admin-kpis";
import { crToday } from "@/lib/today";
import { actionLabel } from "@/lib/admin-format";
import { ActivityStrip, Sparkline } from "@/components/admin/charts";
import { ActionForm, ConfirmAction, Submit } from "@/components/admin/action-form";
import { Badge, DemoNotice, MetaList, Nil, Notice, PageHeader, PlanText, RoleBadge, SubStatus, Table, Td, Th, ago, fmtDate, fmtDateTime, fmtNum, inputSm, link, money, panel, rowAction, rowActionDanger, textareaSm, tr } from "@/components/admin/ui";
import { changeRole, deleteUserAccount, grantComp, resetOnboarding, revokeComp, setSuspended } from "../../actions";
import { giftMonths, reviewReferral, revokeReferralReward } from "../../regalos-actions";
import { GiftFields, type GiftCover } from "@/components/admin/gift-fields";
import { getReferralOverview, REFERRAL_FLAG_LABEL, REFERRAL_STATUS_LABEL } from "@/lib/admin-referrals";
import { GIFT_STATUS_LABEL, giftStatus, monthsLabel } from "@/lib/gifts";
import { BETA_ENDS_AT } from "@/lib/plans";
import { setTester, revokeTester, setFeedbackStatus } from "../../testers-actions";
import { getTesterAdmin } from "@/lib/testers-server";
import { getCoachUsage } from "@/lib/admin-coach";
import { daysLeftLabel, FEEDBACK_KIND_LABEL, FEEDBACK_STATUS_LABEL, TESTER_DAYS, testerState, type FeedbackKind } from "@/lib/testers";

export const metadata = { title: "Ficha de usuario" };

const GOAL: Record<string, string> = { grasa: "Bajar grasa", recomp: "Recomposición", fuerza: "Fuerza" };
const EQUIP: Record<string, string> = { gym: "Gimnasio", casa: "Casa", mixto: "Mixto" };
const PLAN = PLAN_LABEL;
const COACH_TIER_LABEL: Record<string, string> = { none: "Sin acceso", prueba: "Prueba o beta", entreno: "Entreno", completo: "Entreno + Nutrición", staff: "Equipo, sin tope" };
const COUNTRY: Record<string, string> = { CR: "Costa Rica", PA: "Panamá", NI: "Nicaragua", GT: "Guatemala", MX: "México", CO: "Colombia", SV: "El Salvador", HN: "Honduras", US: "Estados Unidos" };

function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className={`${panel} space-y-4 p-4`}>
      <h2 id={id} className="text-base font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}
function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-4 border-b border-line py-2 text-sm last:border-0"><dt className="shrink-0 text-muted">{k}</dt><dd className="min-w-0 break-words text-right font-semibold text-ink tabular-nums">{children}</dd></div>;
}
function Restricted({ what }: { what: string }) {
  return <p className="flex items-center gap-2 text-sm text-muted"><Lock className="size-4" aria-hidden />Tu rol no tiene acceso a {what}.</p>;
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const v = await requireSection("usuarios");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [d, refs, tester, coach] = await Promise.all([getUserDetail(v, id), getReferralOverview(v, id), getTesterAdmin(v, id).catch(() => ({ grants: [], feedback: [], unavailable: true })), getCoachUsage(v, id).catch(() => null)]);
  if (!d) notFound();
  const a = d.account;
  const today = crToday().iso;
  const status = statusOf({ onboarded: a.onboarded, last_active: a.last_active, comp_until: null }, today);
  const isSelf = a.id === v.id;
  const roleOptions = assignableRoles(v.role).filter((r) => r !== a.role);
  const targetPrivileged = PRIVILEGED.includes(a.role);
  const canChangeRole = can(v.role, "users.role") && !isSelf && (v.role === "superadmin" || !targetPrivileged);
  const isGift = (c: { source?: string | null }) => c.source === "regalo" || c.source === "referido";
  // El mes de tester tiene su propia sección (no se revoca como una cortesía).
  const comps = d.billing?.comps.filter((c) => !isGift(c) && c.source !== "tester") ?? [];
  const ts = testerState(tester.grants);
  const isTester = ts.phase === "activo" || ts.phase === "pronto";
  const renewUntil = fmtDate(new Date(Date.now() + TESTER_DAYS * 864e5).toISOString());
  const canTester = can(v.role, "users.tester") && !isSelf;
  const gifts = d.billing?.comps.filter(isGift) ?? [];
  const activeComp = comps.find((c) => !c.revoked_at && Date.parse(c.expires_at) > Date.now());
  const renewing = d.billing?.subs.find((s) => (s.status === "active" || s.status === "trialing") && !s.cancel_at_period_end && s.current_period_end && Date.parse(s.current_period_end) > Date.now());
  // Mismos datos que usa la base para apilar el regalo (vista previa en el formulario; la base decide la fecha final).
  const cover: GiftCover | undefined = d.billing ? {
    createdAt: a.created_at, betaEndsAt: BETA_ENDS_AT, renewsAt: renewing?.current_period_end ?? null,
    comps: d.billing.comps.map((c) => ({ plan: c.plan, source: c.source ?? "cortesia", starts_at: c.starts_at, expires_at: c.expires_at, revoked_at: c.revoked_at })),
    subs: d.billing.subs.map((s) => ({ plan: s.plan ?? null, status: s.status ?? "", current_period_end: s.current_period_end ?? null, cancel_at_period_end: s.cancel_at_period_end ?? false })),
  } : undefined;
  const health = d.health;

  return (
    <div className="space-y-5">
      <PageHeader back={{ href: "/admin/usuarios", label: "Usuarios" }} title={a.full_name || "Sin nombre"} desc={a.email ?? "Correo no disponible"}
        meta={<>
          <RoleBadge role={a.role} />
          <Badge tone={status === "activo" ? "good" : status === "pendiente" ? "warn" : "muted"}>{ACTIVITY_LABEL[status]}</Badge>
          {isSelf && <Badge tone="info">Eres tú</Badge>}
          {a.suspended_at && <Badge tone="bad">Suspendido</Badge>}
          {isTester && <Badge tone="warn"><Flask weight="duotone" className="size-3.5" aria-hidden />Tester hasta {fmtDate(ts.until)}</Badge>}
        </>} />
      {v.demo && <DemoNotice what="los datos de esta ficha" />}

      <div className="grid items-start gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Section title="Cuenta" id="s-cuenta">
            <dl>
              <Row k="ID"><code className="font-mono text-xs font-normal break-all">{a.id}</code></Row>
              <Row k="Alta">{fmtDate(a.created_at)}</Row>
              <Row k="Último ingreso">{fmtDateTime(a.last_sign_in_at)}</Row>
              <Row k="Última actividad">{ago(a.last_active, today)}</Row>
              <Row k="País">{a.country ? COUNTRY[a.country] ?? a.country : <Nil />}</Row>
              <Row k="Plan">{PLAN[a.plan] ?? a.plan}{activeComp && <span className="block text-xs text-[#6E4E00]">cortesía hasta {fmtDate(activeComp.expires_at)}</span>}</Row>
              <Row k="Bienvenida">{a.onboarded ? "Completada" : "Pendiente"}</Row>
              <Row k="Perfil en la comunidad">{a.username ? <Link href={`/app/comunidad/u/${a.username}`} className={link}>@{a.username}</Link> : <Nil />}</Row>
              <Row k="Comunidad">{a.suspended_at ? <span className="text-[#A3261A]">Suspendido desde {fmtDate(a.suspended_at)}{a.suspended_reason && <span className="block text-xs font-normal text-muted">{a.suspended_reason}</span>}</span> : "Activo"}</Row>
            </dl>
          </Section>

          <Section title="Objetivo y peso" id="s-salud">
            {health ? (
              <>
                <dl className="grid sm:grid-cols-2 gap-x-6">
                  <Row k="Objetivo">{GOAL[health.goal_type ?? ""] ?? <Nil />}</Row>
                  <Row k="Equipo">{EQUIP[health.equipment ?? ""] ?? <Nil />}</Row>
                  <Row k="Días por semana">{health.train_days ?? <Nil />}</Row>
                  {health.goal && <><Row k="Peso inicial y meta">{fmtNum(health.goal.start_weight)} kg a {fmtNum(health.goal.goal_weight)} kg</Row><Row k="Fecha meta">{fmtDate(health.goal.goal_date)}</Row></>}
                </dl>
                <div>
                  <h3 className="text-sm font-bold text-ink mb-2">Tendencia de peso ({health.weights.length} pesajes)</h3>
                  <Sparkline values={health.weights} label="Tendencia de peso" />
                </div>
                <p className="max-w-prose text-xs text-muted text-pretty">Datos de salud (Ley 8968): úsalos solo para acompañar al usuario. No los copies fuera del panel.</p>
              </>
            ) : <Restricted what="datos de salud" />}
          </Section>

          <Section title="Actividad" id="s-actividad">
            {d.activity ? (
              <>
                <dl className="grid grid-cols-3 divide-x divide-line rounded-xl bg-paper/60">
                  {([["Entrenos totales", d.activity.workouts_total], ["Entrenos 30 d", d.activity.workouts_30], ["Días activos 30 d", d.activity.active_days_30]] as const).map(([l, n]) => (
                    <div key={l} className="flex flex-col-reverse justify-end gap-1 px-3 py-3 sm:px-4"><dt className="text-xs text-muted">{l}</dt><dd className="text-2xl font-extrabold leading-none text-ink tabular-nums">{fmtNum(n)}</dd></div>
                  ))}
                </dl>
                <div><h3 className="text-sm font-bold text-ink mb-2">Entrenos de los últimos 28 días</h3><ActivityStrip days={d.activity.recent} today={today} label="Días con entreno en los últimos 28 días" /></div>
              </>
            ) : <Restricted what="la actividad de entrenamiento" />}
          </Section>

          <Section title="Coach Banana" id="s-coach">
            {coach === "missing" ? <p className="text-sm text-muted">Falta aplicar la migración 0032_coach_cuota.sql.</p> : coach ? (
              <>
                <dl className="grid grid-cols-3 divide-x divide-line rounded-xl bg-paper/60">
                  {([["Preguntas hoy", coach.dayUsed, coach.dayLimit], ["Preguntas del mes", coach.monthUsed, coach.monthLimit]] as const).map(([l, used, lim]) => (
                    <div key={l} className="flex flex-col-reverse justify-end gap-1 px-3 py-3 sm:px-4"><dt className="text-xs text-muted">{l}{lim === null ? ", sin tope" : ` de ${fmtNum(lim)}`}</dt><dd className="text-2xl font-extrabold leading-none text-ink tabular-nums">{fmtNum(used)}</dd></div>
                  ))}
                  <div className="flex flex-col-reverse justify-end gap-1 px-3 py-3 sm:px-4"><dt className="text-xs text-muted">Cupo</dt><dd className="text-base font-extrabold leading-tight text-ink">{COACH_TIER_LABEL[coach.tier]}</dd></div>
                </dl>
                <p className="max-w-prose text-xs text-muted text-pretty">Solo conteos (hora de Costa Rica). El contenido de las conversaciones no se muestra en el panel.</p>
              </>
            ) : <p className="text-sm text-muted">No se pudo leer el uso del coach.</p>}
          </Section>

          <Section title="Tester de la beta" id="s-tester">
            {tester.unavailable ? <p className="text-sm text-muted">Falta aplicar la migración 0029_testers.sql.</p> : (<>
              <p className="max-w-prose text-sm text-muted text-pretty">Un mes de Entreno + Nutrición como cortesía por probar la beta. No es un rol del equipo: no da acceso al panel. Al terminar, la cuenta vuelve a sus reglas normales.</p>
              {tester.grants.length ? (
                <ul className="space-y-2">{tester.grants.map((g) => {
                  const live = !g.revoked_at && Date.parse(g.starts_at) <= Date.now() && Date.parse(g.expires_at) > Date.now();
                  const st = live ? "Vigente" : g.end_kind === "renovado" ? "Renovado" : g.end_kind === "quitado" ? "Quitado" : "Terminado";
                  return (
                    <li key={g.id} className="rounded-xl border border-line px-3 py-2.5 text-sm">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">Del {fmtDate(g.starts_at)} al {fmtDate(g.expires_at)}
                        <Badge tone={live ? "good" : g.end_kind === "quitado" ? "bad" : "muted"}>{st}</Badge>{g.renewal && <Badge tone="info">Renovación</Badge>}</p>
                      <MetaList className="mt-0.5" items={[live && daysLeftLabel(Math.max(1, Math.ceil((Date.parse(g.expires_at) - Date.now()) / 864e5))), g.granted_by_name && `Por ${g.granted_by_name}`, g.revoked_at && `Cerrado el ${fmtDate(g.revoked_at)}`, g.seen_at ? "Vio la bienvenida" : live ? "Aún no abre la app" : null]} />
                    </li>);
                })}</ul>
              ) : <p className="text-sm text-muted">Nunca fue tester.</p>}
              <div>
                <h3 className="text-sm font-bold text-ink mb-2">Lo que reportó desde la app</h3>
                {tester.feedback.length ? (
                  <ul className="space-y-2">{tester.feedback.map((f) => (
                    <li key={f.id} className="rounded-xl border border-line px-3 py-2.5 text-sm">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">{FEEDBACK_KIND_LABEL[f.kind as FeedbackKind] ?? CATEGORY_LABEL[f.kind as SupportCategory] ?? f.kind}
                        <Badge tone={f.status === "resuelto" || f.status === "cerrado" ? "good" : f.status === "visto" || f.status === "en_proceso" ? "muted" : "warn"}>{FEEDBACK_STATUS_LABEL[f.status] ?? STATUS_LABEL[f.status as SupportStatus] ?? f.status}</Badge>{f.from_tester && <Badge tone="info">Tester</Badge>}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-body text-pretty">{f.body}</p>
                      <MetaList className="mt-1" items={[fmtDateTime(f.created_at), f.page && `En ${f.page}`]} />
                      {f.ticket && canSee(v.role, "soporte") && <Link href={`/admin/soporte/${f.id}`} className={`mt-2 ${rowAction}`}>Abrir el caso</Link>}
                      {!f.ticket && can(v.role, "feedback.manage") && f.status !== "resuelto" && (
                        <ActionForm action={setFeedbackStatus} className="mt-2 flex flex-wrap gap-1">
                          <input type="hidden" name="id" value={f.id} />
                          <input type="hidden" name="status" value="resuelto" />
                          <Submit className={rowAction} pendingText="Guardando…">Marcar resuelto</Submit>
                        </ActionForm>
                      )}
                    </li>
                  ))}</ul>
                ) : <p className="text-sm text-muted">Sin reportes.</p>}
              </div>
            </>)}
          </Section>

          <Section title="Facturación" id="s-billing">
            {d.billing ? (
              <>
                {d.billing.subs.length ? (
                  <Table caption="Suscripciones del usuario" captionHidden minWidth={560} bare>
                    <thead className="border-b border-line"><tr><Th>Plan</Th><Th>Estado</Th><Th>Último cobro</Th><Th>Renueva o termina</Th><Th className="text-right">MRR</Th></tr></thead>
                    <tbody>{d.billing.subs.map((s, i) => (
                      <tr key={String(s.id ?? i)} className={tr}>
                        <Td><PlanText label={s.planLabel} /></Td><Td><SubStatus status={s.status} /></Td>
                        <Td className="tabular-nums text-muted whitespace-nowrap">{s.current_period_start ? fmtDate(s.current_period_start) : <Nil />}</Td>
                        <Td className="tabular-nums text-muted whitespace-nowrap">{s.status === "trialing" ? `Prueba hasta ${fmtDate(s.current_period_end)}` : s.status === "canceled" ? `Acceso hasta ${fmtDate(s.current_period_end)}` : fmtDate(s.current_period_end)}</Td>
                        <Td className="text-right tabular-nums">{s.status === "active" ? money(s.monthly) : <Nil />}</Td>
                      </tr>))}
                    </tbody>
                  </Table>
                ) : <p className="text-sm text-muted">Sin suscripciones registradas.</p>}
                {d.billing.subs.length > 0 && can(v.role, "payments.view") && a.full_name && <Link href={`/admin/pagos?q=${encodeURIComponent(a.full_name)}`} className={`inline-block text-sm ${link}`}>Ver en Pagos</Link>}
                <div>
                  <h3 className="text-sm font-bold text-ink mb-2">Cortesías</h3>
                  {comps.length ? (
                    <ul className="space-y-2">{comps.map((c) => {
                      const live = !c.revoked_at && Date.parse(c.expires_at) > Date.now();
                      return (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 text-sm">
                          <div className="min-w-0"><p className="flex flex-wrap items-center gap-2 font-semibold text-ink">{PLAN[c.plan] ?? c.plan}, hasta {fmtDate(c.expires_at)} {live ? <Badge tone="good">Vigente</Badge> : <Badge>{c.revoked_at ? "Revocada" : "Vencida"}</Badge>}</p>
                            <MetaList className="mt-0.5" items={[c.reason ?? "Sin motivo", c.granted_by_name && `Otorgada por ${c.granted_by_name}`]} /></div>
                          {live && can(v.role, "users.comp") && (
                            <ConfirmAction action={revokeComp} danger triggerClassName={rowActionDanger} trigger="Revocar" title="Revocar cortesía" description="El usuario vuelve al plan que tenía antes de la cortesía." hidden={{ target: a.id, grant: c.id }} confirmLabel="Revocar">
                              <div><label htmlFor={`rv-${c.id}`} className="block text-xs font-bold text-ink mb-1">Motivo (opcional)</label><input id={`rv-${c.id}`} name="reason" maxLength={300} className={inputSm} /></div>
                            </ConfirmAction>
                          )}
                        </li>);
                    })}</ul>
                  ) : <p className="text-sm text-muted">Sin cortesías.</p>}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink mb-2">Regalos y recompensas</h3>
                  {gifts.length ? (
                    <ul className="space-y-2">{gifts.map((g) => {
                      const st = giftStatus(g);
                      return (
                        <li key={g.id} className="rounded-xl border border-line px-3 py-2.5 text-sm">
                          <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                            {monthsLabel(g.months ?? 1)} de {PLAN[g.plan] ?? g.plan}
                            <Badge tone={st === "activo" ? "good" : st === "programado" ? "info" : st === "revocado" ? "bad" : "muted"}>{GIFT_STATUS_LABEL[st]}</Badge>
                            {g.source === "referido" && <Badge tone="warn">Referidos</Badge>}
                          </p>
                          <MetaList className="mt-0.5" items={[`Del ${fmtDate(g.starts_at)} al ${fmtDate(g.expires_at)}`, g.granted_by_name && `Por ${g.granted_by_name}`]} />
                          {g.message && <p className="mt-1 text-xs text-muted text-pretty">Mensaje: {g.message}</p>}
                        </li>);
                    })}</ul>
                  ) : <p className="text-sm text-muted">Sin regalos.</p>}
                </div>
              </>
            ) : <Restricted what="facturación" />}
          </Section>

          {refs && (
            <Section title="Referidos" id="s-referidos">
              {refs.unavailable ? <p className="text-sm text-muted">Falta aplicar la migración 0025_regalos_referidos.sql.</p> : (<>
                <dl className="grid grid-cols-3 divide-x divide-line rounded-xl bg-paper/60">
                  {([["Invitados", refs.referrals.length], ["Activos", refs.referrals.filter((r) => r.status === "calificado").length], ["Meses ganados", refs.rewards.filter((w) => !w.revoked_at).reduce((n, w) => n + w.months, 0)]] as const).map(([l, n]) => (
                    <div key={l} className="flex flex-col-reverse justify-end gap-1 px-3 py-3 sm:px-4"><dt className="text-xs text-muted">{l}</dt><dd className="text-2xl font-extrabold leading-none text-ink tabular-nums">{fmtNum(n)}</dd></div>
                  ))}
                </dl>
                <dl>
                  <Row k="Código">{refs.code ? <code className="font-mono text-xs font-normal">{refs.code}</code> : <Nil />}</Row>
                  <Row k="Lo invitó">{refs.referred_by ? <Link href={`/admin/usuarios/${refs.referred_by.id}`} className={link}>{refs.referred_by.name || "Sin nombre"}</Link> : <Nil />}</Row>
                </dl>
                {refs.referrals.length > 0 && (
                  <ul className="space-y-2">{refs.referrals.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                          {r.user_id ? <Link href={`/admin/usuarios/${r.user_id}`} className={link}>{r.name || "Sin nombre"}</Link> : "Cuenta borrada"}
                          <Badge tone={r.status === "calificado" ? "good" : r.status === "sospechoso" ? "warn" : "muted"}>{REFERRAL_STATUS_LABEL[r.status] ?? r.status}</Badge>
                          {r.annual && <Badge tone="info">Compró anual</Badge>}
                        </p>
                        <MetaList className="mt-0.5" items={[`Se registró el ${fmtDate(r.created_at)}`, r.group_no && `Grupo ${r.group_no}`, r.flag && (REFERRAL_FLAG_LABEL[r.flag] ?? r.flag)]} />
                      </div>
                      {r.status === "sospechoso" && can(v.role, "referrals.manage") && (
                        <div className="flex gap-1">
                          <ConfirmAction action={reviewReferral} triggerClassName={rowAction} trigger="Aprobar" title="Aprobar referido" hidden={{ target: a.id, referral: r.id, decision: "aprobar" }} confirmLabel="Aprobar"
                            description="Vuelve a contar para las recompensas de esta persona cuando cumpla las condiciones.">
                            <div><label htmlFor={`ra-${r.id}`} className="block text-xs font-bold text-ink mb-1">Motivo</label><input id={`ra-${r.id}`} name="reason" required minLength={4} maxLength={300} className={inputSm} /></div>
                          </ConfirmAction>
                          <ConfirmAction action={reviewReferral} danger triggerClassName={rowActionDanger} trigger="Descartar" title="Descartar referido" hidden={{ target: a.id, referral: r.id, decision: "descartar" }} confirmLabel="Descartar"
                            description="No contará para recompensas.">
                            <div><label htmlFor={`rd-${r.id}`} className="block text-xs font-bold text-ink mb-1">Motivo</label><input id={`rd-${r.id}`} name="reason" required minLength={4} maxLength={300} className={inputSm} /></div>
                          </ConfirmAction>
                        </div>
                      )}
                    </li>
                  ))}</ul>
                )}
                <div>
                  <h3 className="text-sm font-bold text-ink mb-2">Recompensas</h3>
                  {refs.rewards.length ? (
                    <ul className="space-y-2">{refs.rewards.map((w) => (
                      <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">Grupo {w.group_no}: {monthsLabel(w.months)} de {PLAN[w.plan] ?? w.plan} {w.revoked_at ? <Badge tone="bad">Revocada</Badge> : <Badge tone="good">Entregada</Badge>}</p>
                          <MetaList className="mt-0.5" items={[fmtDate(w.created_at), w.upgraded_at && "Subió a trimestre por una compra anual", w.revoke_reason]} />
                        </div>
                        {!w.revoked_at && can(v.role, "referrals.manage") && (
                          <ConfirmAction action={revokeReferralReward} danger triggerClassName={rowActionDanger} trigger="Revocar" title="Revocar recompensa por fraude" hidden={{ target: a.id, reward: w.id }} confirmLabel="Revocar"
                            description="Quita los meses de esta recompensa y los referidos de su grupo dejan de contar. No se puede deshacer.">
                            <div><label htmlFor={`rw-${w.id}`} className="block text-xs font-bold text-ink mb-1">Motivo</label><input id={`rw-${w.id}`} name="reason" required minLength={4} maxLength={300} placeholder="p. ej. cuentas creadas por la misma persona" className={inputSm} /></div>
                          </ConfirmAction>
                        )}
                      </li>
                    ))}</ul>
                  ) : <p className="text-sm text-muted">Sin recompensas todavía.</p>}
                </div>
              </>)}
            </Section>
          )}
        </div>

        <div className="space-y-3">
          <Section title="Acciones" id="s-acciones">
            <div className="space-y-4">
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><UserCog className="size-4" aria-hidden />Rol</h3>
                <dl className="rounded-xl bg-paper/60 px-3">
                  <Row k="Rol actual"><RoleBadge role={a.role} /></Row>
                  <Row k="Tester de la beta">{isTester ? <span>Hasta el {fmtDate(ts.until)}<span className="block text-xs font-normal text-muted">{daysLeftLabel(ts.daysLeft)}{ts.daysLeft > 1 ? " restantes" : ""}</span></span> : ts.phase === "terminado" ? <span className="font-normal text-muted">Terminó el {fmtDate(ts.until)}</span> : <span className="font-normal text-muted">No</span>}</Row>
                </dl>
                {canChangeRole && roleOptions.length ? (
                  <ConfirmAction action={changeRole} trigger="Cambiar rol" title={`Cambiar rol de ${a.full_name || "usuario"}`} hidden={{ target: a.id }} confirmLabel="Cambiar rol"
                    description={<>Rol actual: <b className="text-ink">{ROLE_LABEL[a.role]}</b>. Los roles de staff dan acceso al panel.{v.role !== "superadmin" && " Solo un superadmin puede otorgar admin/superadmin."}</>}>
                    <div><label htmlFor="cr-role" className="block text-xs font-bold text-ink mb-1">Nuevo rol</label>
                      <select id="cr-role" name="role" required className={inputSm}>{roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
                    <div><label htmlFor="cr-reason" className="block text-xs font-bold text-ink mb-1">Motivo</label>
                      <textarea id="cr-reason" name="reason" required minLength={4} maxLength={300} rows={2} className={textareaSm} /></div>
                  </ConfirmAction>
                ) : (
                  <p className="text-sm text-muted">{isSelf ? "No puedes cambiar tu propio rol." : !can(v.role, "users.role") ? "Solo admin y superadmin cambian roles." : "Solo un superadmin puede modificar a un admin."}</p>
                )}
                {canTester && !tester.unavailable ? (
                  <div className="flex flex-wrap gap-2">
                    <ConfirmAction action={setTester} trigger={<><Flask weight="duotone" className="size-4" aria-hidden />{isTester ? "Renovar 1 mes desde hoy" : "Hacer tester por 1 mes"}</>}
                      title={isTester ? `Renovar el mes de tester de ${a.full_name || "este usuario"}` : `Hacer tester a ${a.full_name || "este usuario"} por 1 mes`} hidden={{ target: a.id }} confirmLabel={isTester ? "Renovar" : "Hacer tester"}
                      description={<>{isTester ? <>El mes vuelve a empezar hoy y vence el <b className="text-ink">{renewUntil}</b>.</> : <>Tendrá Entreno + Nutrición gratis por {TESTER_DAYS} días, hasta el <b className="text-ink">{renewUntil}</b>, como cortesía por probar la beta.</>} No es un rol del equipo: no da acceso al panel ni cambia su rol. Le llega un aviso en la app, una ventana de bienvenida, un correo y una notificación si las activó.</>}>
                      <div><label htmlFor="ts-reason" className="block text-xs font-bold text-ink mb-1">Motivo</label>
                        <input id="ts-reason" name="reason" required minLength={4} maxLength={300} placeholder="p. ej. prueba la app desde septiembre y reporta errores" className={inputSm} /></div>
                    </ConfirmAction>
                    {isTester && (
                      <ConfirmAction action={revokeTester} danger trigger="Quitar tester" title={`Quitar el estado de tester a ${a.full_name || "este usuario"}`} hidden={{ target: a.id }} confirmLabel="Quitar tester"
                        description="Pierde la insignia y el mes de cortesía desde ahora y vuelve a las reglas normales de su cuenta. No se le avisa.">
                        <div><label htmlFor="ts-rv" className="block text-xs font-bold text-ink mb-1">Motivo</label>
                          <input id="ts-rv" name="reason" required minLength={4} maxLength={300} placeholder="p. ej. ya no está probando la app" className={inputSm} /></div>
                      </ConfirmAction>
                    )}
                  </div>
                ) : !isSelf && !can(v.role, "users.tester") ? <p className="text-sm text-muted">Solo admin y superadmin asignan testers.</p> : null}
              </div>

              <div className="space-y-2 border-t border-line pt-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><Gift className="size-4" aria-hidden />Plan de cortesía</h3>
                {can(v.role, "users.comp") ? (
                  <ConfirmAction action={grantComp} trigger={activeComp ? "Reemplazar cortesía" : "Regalar plan"} title="Regalar plan de cortesía" hidden={{ target: a.id }} confirmLabel="Otorgar"
                    description="Activa el plan sin cobro hasta la fecha indicada. Al vencer vuelve al plan anterior. Una cortesía vigente se reemplaza.">
                    <div><label htmlFor="cg-plan" className="block text-xs font-bold text-ink mb-1">Plan</label>
                      <select id="cg-plan" name="plan" className={inputSm} defaultValue="completo"><option value="entreno">Entreno</option><option value="completo">Entreno + Nutrición</option></select></div>
                    <div><label htmlFor="cg-exp" className="block text-xs font-bold text-ink mb-1">Vence el</label>
                      <input id="cg-exp" name="expires" type="date" required min={addDays(today, 1)} max={addDays(today, 366)} defaultValue={addDays(today, 30)} className={inputSm} /></div>
                    <div><label htmlFor="cg-reason" className="block text-xs font-bold text-ink mb-1">Motivo</label>
                      <input id="cg-reason" name="reason" required minLength={4} maxLength={300} placeholder="p. ej. influencer, compensación por falla" className={inputSm} /></div>
                  </ConfirmAction>
                ) : <p className="text-sm text-muted">Solo soporte y admin otorgan cortesías.</p>}
              </div>

              <div className="space-y-2 border-t border-line pt-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><Gift className="size-4" aria-hidden />Regalar meses</h3>
                {can(v.role, "users.gift") ? (
                  <ConfirmAction action={giftMonths} trigger="Regalar meses" title={`Regalar meses a ${a.full_name || "este usuario"}`} hidden={{ target: a.id }} confirmLabel="Regalar"
                    description="Se suma al final del acceso que ya tenga (nada se recorta). Le llega un aviso en la app, una ventana de celebración, un correo y una notificación si las activó.">
                    <GiftFields cover={cover} />
                  </ConfirmAction>
                ) : <p className="text-sm text-muted">Solo admin y superadmin regalan meses.</p>}
              </div>

              <div className="space-y-2 border-t border-line pt-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><ShieldWarning className="size-4" aria-hidden />Comunidad</h3>
                {can(v.role, "users.suspend") && !isSelf ? (a.suspended_at ? (
                  <ConfirmAction action={setSuspended} trigger="Reactivar en la comunidad" title={`Reactivar a ${a.full_name || "usuario"}`} hidden={{ target: a.id, suspend: "no" }} confirmLabel="Reactivar"
                    description="Podrá volver a publicar y comentar.">
                    <div><label htmlFor="su-reason-no" className="block text-xs font-bold text-ink mb-1">Nota (opcional)</label><input id="su-reason-no" name="reason" maxLength={300} className={inputSm} /></div>
                  </ConfirmAction>
                ) : (
                  <ConfirmAction action={setSuspended} danger trigger="Suspender en la comunidad" title={`Suspender a ${a.full_name || "usuario"}`} hidden={{ target: a.id, suspend: "si" }} confirmLabel="Suspender"
                    description="No podrá publicar ni comentar. Puede seguir usando su plan de entreno. Se puede revertir.">
                    <div><label htmlFor="su-reason" className="block text-xs font-bold text-ink mb-1">Motivo</label><input id="su-reason" name="reason" required minLength={4} maxLength={300} placeholder="p. ej. acoso reiterado (reporte 12)" className={inputSm} /></div>
                  </ConfirmAction>
                )) : <p className="text-sm text-muted">{isSelf ? "No puedes suspenderte a ti mismo." : "Solo soporte y admin suspenden usuarios."}</p>}
              </div>

              <div className="space-y-2 border-t border-line pt-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><RotateCcw className="size-4" aria-hidden />Bienvenida</h3>
                {can(v.role, "users.onboarding") ? (
                  <ConfirmAction action={resetOnboarding} trigger="Reiniciar bienvenida" title="Reiniciar bienvenida" hidden={{ target: a.id }} confirmLabel="Reiniciar"
                    description="El usuario volverá a pasar por la bienvenida para recalcular su plan. No borra su historial.">
                    <div><label htmlFor="ro-reason" className="block text-xs font-bold text-ink mb-1">Motivo</label>
                      <input id="ro-reason" name="reason" required minLength={4} maxLength={300} className={inputSm} /></div>
                  </ConfirmAction>
                ) : <p className="text-sm text-muted">Solo soporte y admin reinician la bienvenida.</p>}
              </div>
              {can(v.role, "users.delete") && !isSelf && (
                <div className="space-y-2 border-t border-line pt-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><Trash className="size-4" aria-hidden />Borrar cuenta</h3>
                  <ConfirmAction action={deleteUserAccount} danger trigger="Borrar cuenta" title={`Borrar la cuenta de ${a.full_name || "usuario"}`} hidden={{ target: a.id }} confirmLabel="Borrar para siempre"
                    description="Igual que cuando la persona borra su cuenta: cancela sus cobros en ONVO, borra sus fotos y elimina todos sus datos. No se puede deshacer. Queda en auditoría.">
                    <div><label htmlFor="del-reason" className="block text-xs font-bold text-ink mb-1">Motivo</label><input id="del-reason" name="reason" required minLength={4} maxLength={300} placeholder="p. ej. lo pidió por correo el 21 de octubre" className={inputSm} /></div>
                    <div><label htmlFor="del-typed" className="block text-xs font-bold text-ink mb-1">Escribe BORRAR</label><input id="del-typed" name="typed" required pattern="[Bb][Oo][Rr][Rr][Aa][Rr]" autoComplete="off" className={inputSm} /></div>
                  </ConfirmAction>
                </div>
              )}
            </div>
          </Section>

          {d.audit && (
            <Section title="Historial de staff" id="s-audit">
              {d.audit.length ? (
                <ol className="space-y-3">{d.audit.map((x) => (
                  <li key={x.id} className="text-sm"><p className="font-semibold text-ink">{actionLabel(x.action)}</p><MetaList items={[x.actor_name ?? "Sistema", fmtDateTime(x.created_at)]} /></li>
                ))}</ol>
              ) : <p className="text-sm text-muted">Sin acciones registradas.</p>}
              <Link href={`/admin/auditoria?target=${a.id}`} className={`inline-block text-sm ${link}`}>Ver en auditoría</Link>
            </Section>
          )}
          {!health && !d.billing && <Notice title="Vista limitada">Tu rol ve solo datos de cuenta.</Notice>}
        </div>
      </div>
    </div>
  );
}
