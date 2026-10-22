import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gift, Lock, RotateCcw, UserCog } from "lucide-react";
import { requireSection } from "@/lib/admin-auth";
import { getUserDetail, statusOf, USER_STATUS } from "@/lib/admin";
import { assignableRoles, can, PRIVILEGED, ROLE_LABEL } from "@/lib/admin-perms";
import { isUuid } from "@/lib/admin-validate";
import { addDays, money } from "@/lib/admin-kpis";
import { crToday } from "@/lib/today";
import { ActivityStrip, Sparkline } from "@/components/admin/charts";
import { ConfirmAction } from "@/components/admin/action-form";
import { Badge, DemoNotice, Notice, RoleBadge, SubStatus, Table, Td, Th, ago, fmtDate, fmtDateTime, inputSm } from "@/components/admin/ui";
import { changeRole, grantComp, resetOnboarding, revokeComp } from "../../actions";

export const metadata = { title: "Ficha de usuario" };

const GOAL: Record<string, string> = { grasa: "Bajar grasa", recomp: "Recomposición", fuerza: "Fuerza" };
const EQUIP: Record<string, string> = { gym: "Gimnasio", casa: "Casa", mixto: "Mixto" };
const PLAN: Record<string, string> = { free: "Gratis", entreno: "Entreno", completo: "Entreno + Nutrición", pro: "Pro (legado)" };

function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="card p-5 space-y-4">
      <h2 id={id} className="font-extrabold text-ink">{title}</h2>
      {children}
    </section>
  );
}
function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-4 py-2 border-b border-line last:border-0 text-sm"><dt className="text-muted">{k}</dt><dd className="text-ink font-semibold text-right">{children}</dd></div>;
}
function Restricted({ what }: { what: string }) {
  return <p className="flex items-center gap-2 text-sm text-muted"><Lock className="size-4" aria-hidden />Tu rol no tiene acceso a {what}.</p>;
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const v = await requireSection("usuarios");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const d = await getUserDetail(v, id);
  if (!d) notFound();
  const a = d.account;
  const today = crToday().iso;
  const status = statusOf({ onboarded: a.onboarded, last_active: a.last_active, comp_until: null }, today);
  const isSelf = a.id === v.id;
  const roleOptions = assignableRoles(v.role).filter((r) => r !== a.role);
  const targetPrivileged = PRIVILEGED.includes(a.role);
  const canChangeRole = can(v.role, "users.role") && !isSelf && (v.role === "superadmin" || !targetPrivileged);
  const activeComp = d.billing?.comps.find((c) => !c.revoked_at && Date.parse(c.expires_at) > Date.now());
  const health = d.health;

  return (
    <div className="space-y-6">
      <Link href="/admin/usuarios" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />Usuarios</Link>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">{a.full_name || "Sin nombre"}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {a.email ?? "correo no disponible"} <RoleBadge role={a.role} />
            <Badge tone={status === "activo" ? "good" : status === "pendiente" ? "warn" : "muted"}>{USER_STATUS.find(([k]) => k === status)?.[1]}</Badge>
            {isSelf && <Badge tone="info">Eres tú</Badge>}
          </p>
        </div>
      </header>
      {v.demo && <DemoNotice what="los datos de esta ficha" />}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Cuenta" id="s-cuenta">
            <dl>
              <Row k="ID"><code className="text-xs font-mono">{a.id}</code></Row>
              <Row k="Alta">{fmtDate(a.created_at)}</Row>
              <Row k="Último ingreso">{fmtDateTime(a.last_sign_in_at)}</Row>
              <Row k="Última actividad">{ago(a.last_active, today)}</Row>
              <Row k="País">{a.country ?? "—"}</Row>
              <Row k="Plan">{PLAN[a.plan] ?? a.plan}{activeComp && <span className="block text-xs text-[#6E4E00]">cortesía hasta {fmtDate(activeComp.expires_at)}</span>}</Row>
              <Row k="Bienvenida">{a.onboarded ? "Completada" : "Pendiente"}</Row>
            </dl>
          </Section>

          <Section title="Objetivo y peso" id="s-salud">
            {health ? (
              <>
                <dl className="grid sm:grid-cols-2 gap-x-6">
                  <Row k="Objetivo">{GOAL[health.goal_type ?? ""] ?? "—"}</Row>
                  <Row k="Equipo · días">{EQUIP[health.equipment ?? ""] ?? "—"} · {health.train_days ?? "—"} d/sem</Row>
                  {health.goal && <><Row k="Peso inicial → meta">{health.goal.start_weight} → {health.goal.goal_weight} kg</Row><Row k="Fecha meta">{fmtDate(health.goal.goal_date)}</Row></>}
                </dl>
                <div>
                  <h3 className="text-sm font-bold text-ink mb-2">Tendencia de peso ({health.weights.length} pesajes)</h3>
                  <Sparkline values={health.weights} label="Tendencia de peso" />
                </div>
                <p className="text-[11px] text-muted">Datos de salud (Ley 8968): úsalos solo para acompañar al usuario. No los copies fuera del panel.</p>
              </>
            ) : <Restricted what="datos de salud" />}
          </Section>

          <Section title="Actividad" id="s-actividad">
            {d.activity ? (
              <>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[["Entrenos totales", d.activity.workouts_total], ["Entrenos 30 d", d.activity.workouts_30], ["Días activos 28 d", d.activity.active_days_30]].map(([l, n]) => (
                    <div key={l} className="rounded-2xl bg-paper/70 p-3"><p className="text-2xl font-extrabold text-ink tabular-nums">{n}</p><p className="text-xs text-muted">{l}</p></div>
                  ))}
                </div>
                <div><h3 className="text-sm font-bold text-ink mb-2">Últimos 28 días</h3><ActivityStrip days={d.activity.recent} today={today} label="Días con entreno" /></div>
              </>
            ) : <Restricted what="la actividad de entrenamiento" />}
          </Section>

          <Section title="Facturación" id="s-billing">
            {d.billing ? (
              <>
                {d.billing.subs.length ? (
                  <Table caption="Suscripciones del usuario" captionHidden minWidth={520}>
                    <thead className="border-b border-line"><tr><Th>Plan</Th><Th>Estado</Th><Th>Proveedor</Th><Th>Renueva / termina</Th><Th className="text-right">MRR</Th></tr></thead>
                    <tbody>{d.billing.subs.map((s, i) => (
                      <tr key={String(s.id ?? i)} className="border-b border-line last:border-0">
                        <Td className="text-ink">{s.planLabel}</Td><Td><SubStatus status={s.status} /></Td><Td className="text-muted">{s.provider ?? "—"}</Td>
                        <Td className="tabular-nums text-muted">{fmtDate(s.current_period_end)}</Td><Td className="text-right tabular-nums">{s.status === "active" ? money(s.monthly) : "—"}</Td>
                      </tr>))}
                    </tbody>
                  </Table>
                ) : <p className="text-sm text-muted">Sin suscripciones registradas.</p>}
                <div>
                  <h3 className="text-sm font-bold text-ink mb-2">Cortesías</h3>
                  {d.billing.comps.length ? (
                    <ul className="space-y-2">{d.billing.comps.map((c) => {
                      const live = !c.revoked_at && Date.parse(c.expires_at) > Date.now();
                      return (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line p-3 text-sm">
                          <div><p className="font-semibold text-ink">{PLAN[c.plan] ?? c.plan} · hasta {fmtDate(c.expires_at)} {live ? <Badge tone="good">Vigente</Badge> : <Badge>{c.revoked_at ? "Revocada" : "Vencida"}</Badge>}</p>
                            <p className="text-xs text-muted">{c.reason ?? "Sin motivo"}{c.granted_by_name ? ` · por ${c.granted_by_name}` : ""}</p></div>
                          {live && can(v.role, "users.comp") && (
                            <ConfirmAction action={revokeComp} danger trigger="Revocar" title="Revocar cortesía" description="El usuario vuelve al plan que tenía antes de la cortesía." hidden={{ target: a.id, grant: c.id }} confirmLabel="Revocar">
                              <div><label htmlFor={`rv-${c.id}`} className="block text-xs font-bold text-ink mb-1">Motivo (opcional)</label><input id={`rv-${c.id}`} name="reason" maxLength={300} className={inputSm} /></div>
                            </ConfirmAction>
                          )}
                        </li>);
                    })}</ul>
                  ) : <p className="text-sm text-muted">Sin cortesías.</p>}
                </div>
              </>
            ) : <Restricted what="facturación" />}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Acciones" id="s-acciones">
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><UserCog className="size-4" aria-hidden />Rol</h3>
                {canChangeRole && roleOptions.length ? (
                  <ConfirmAction action={changeRole} trigger="Cambiar rol" title={`Cambiar rol de ${a.full_name || "usuario"}`} hidden={{ target: a.id }} confirmLabel="Cambiar rol"
                    description={<>Rol actual: <b className="text-ink">{ROLE_LABEL[a.role]}</b>. Los roles de staff dan acceso al panel.{v.role !== "superadmin" && " Solo un superadmin puede otorgar admin/superadmin."}</>}>
                    <div><label htmlFor="cr-role" className="block text-xs font-bold text-ink mb-1">Nuevo rol</label>
                      <select id="cr-role" name="role" required className={inputSm}>{roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
                    <div><label htmlFor="cr-reason" className="block text-xs font-bold text-ink mb-1">Motivo</label>
                      <textarea id="cr-reason" name="reason" required minLength={4} maxLength={300} rows={2} className="input h-auto! py-2 rounded-xl! text-sm!" /></div>
                  </ConfirmAction>
                ) : (
                  <p className="text-sm text-muted">{isSelf ? "No puedes cambiar tu propio rol." : !can(v.role, "users.role") ? "Solo admin y superadmin cambian roles." : "Solo un superadmin puede modificar a un admin."}</p>
                )}
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
                <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><RotateCcw className="size-4" aria-hidden />Bienvenida</h3>
                {can(v.role, "users.onboarding") ? (
                  <ConfirmAction action={resetOnboarding} trigger="Reiniciar bienvenida" title="Reiniciar bienvenida" hidden={{ target: a.id }} confirmLabel="Reiniciar"
                    description="El usuario volverá a pasar por la bienvenida para recalcular su plan. No borra su historial.">
                    <div><label htmlFor="ro-reason" className="block text-xs font-bold text-ink mb-1">Motivo</label>
                      <input id="ro-reason" name="reason" required minLength={4} maxLength={300} className={inputSm} /></div>
                  </ConfirmAction>
                ) : <p className="text-sm text-muted">Solo soporte y admin reinician la bienvenida.</p>}
              </div>
            </div>
          </Section>

          {d.audit && (
            <Section title="Historial de staff" id="s-audit">
              {d.audit.length ? (
                <ol className="space-y-3">{d.audit.map((x) => (
                  <li key={x.id} className="text-sm"><p className="font-semibold text-ink">{x.action}</p><p className="text-xs text-muted">{x.actor_name ?? "Sistema"} · {fmtDateTime(x.created_at)}</p></li>
                ))}</ol>
              ) : <p className="text-sm text-muted">Sin acciones registradas.</p>}
              <Link href={`/admin/auditoria?target=${a.id}`} className="text-sm font-semibold text-ink underline underline-offset-2">Ver en auditoría</Link>
            </Section>
          )}
          {!health && !d.billing && <Notice title="Vista limitada">Tu rol ve solo datos de cuenta.</Notice>}
        </div>
      </div>
    </div>
  );
}
