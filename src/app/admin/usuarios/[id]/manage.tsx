// Ficha del usuario: "Administrar cuenta" (solo superadmin, 0056). Cada botón abre un diálogo con motivo obligatorio y
// confirmación; el servidor vuelve a validar el rol en cada acción. Nada aquí muestra contraseñas ni enlaces de acceso.
import Link from "next/link";
import { Envelope, Gift, IdentificationCard, LockKey, Medal, Lightning, Trophy, Warning } from "@/components/icons";
import { ConfirmAction } from "@/components/admin/action-form";
import { Badge, MetaList, btnGhost, fmtDate, fmtDateTime, fmtNum, inputSm, link, money, panel, rowAction, rowActionDanger, textareaSm } from "@/components/admin/ui";
import { ACCESS_SOURCE_LABEL, MANUAL_BADGES, badgeId, badgeLabel } from "@/lib/admin-manage";
import type { ManageData } from "@/lib/admin-manage-server";
import { addDays } from "@/lib/admin-kpis";
import { crToday } from "@/lib/today";
import {
  adjustXp, cancelRenewal, cancelScheduledCharge, changeEmail, grantAccess, grantPlan, resetIntake, resetProgress, revokeAccess,
  sendAccessEmail, setBadge, setBlocked, signOutEverywhere, updateProfile,
} from "../../cuentas-actions";

const COUNTRIES: [string, string][] = [["CR", "Costa Rica"], ["GT", "Guatemala"], ["CO", "Colombia"], ["PA", "Panamá"], ["NI", "Nicaragua"], ["SV", "El Salvador"], ["HN", "Honduras"], ["MX", "México"], ["US", "Estados Unidos"]];
const PROGRAM_STATUS: Record<string, string> = { activo: "Activo", pausado: "En pausa", abandonado: "Dejado", completado: "Completado" };
const label = "block text-xs font-bold text-ink mb-1";
const trigger = `${btnGhost} w-full justify-center sm:w-auto`;

function Reason({ id, placeholder }: { id: string; placeholder?: string }) {
  return (
    <div><label htmlFor={id} className={label}>Motivo</label>
      <textarea id={id} name="reason" required minLength={4} maxLength={300} rows={2} placeholder={placeholder ?? "p. ej. lo pidió por WhatsApp el 26 de octubre"} className={textareaSm} /></div>
  );
}

function Block({ title, icon, children, id }: { title: string; icon: React.ReactNode; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="space-y-3 border-t border-line pt-4 first:border-0 first:pt-0">
      <h3 id={id} className="flex items-center gap-2 text-sm font-bold text-ink">{icon}{title}</h3>
      {children}
    </section>
  );
}

export function ManageAccount({ id, name, country, email, isSelf, m }: { id: string; name: string; country: string | null; email: string | null; isSelf: boolean; m: ManageData }) {
  const today = crToday().iso;
  const blocked = !!m.blockedAt || !!m.auth?.bannedUntil;
  const titles = Object.fromEntries(m.catalog.map((c) => [c.slug, c.title]));
  const owned = new Set(m.access.map((a) => a.slug));
  const grantable = m.catalog.filter((c) => !owned.has(c.slug) && (c.price > 0 || c.season));
  const overrides = new Map(m.overrides.map((o) => [o.id, o]));
  const shown = new Set(m.badges.map((b) => b.id));
  const progressSlugs = [...new Set([...m.programs.map((p) => p.slug), ...m.challenges.map((c) => c.slug)])];
  const awardable = [
    ...MANUAL_BADGES.filter((b) => !shown.has(b.id)).map((b) => ({ id: b.id, label: b.label })),
    ...m.catalog.filter((c) => !shown.has(badgeId(c.kind === "programa" ? "programa" : "reto", c.slug))).map((c) => ({ id: badgeId(c.kind === "programa" ? "programa" : "reto", c.slug), label: badgeLabel(badgeId(c.kind === "programa" ? "programa" : "reto", c.slug), null, titles) })),
  ];

  return (
    <section aria-labelledby="s-admin" className={`${panel} space-y-4 p-4`}>
      <div>
        <h2 id="s-admin" className="text-base font-bold text-ink">Administrar cuenta</h2>
        <p className="mt-1 max-w-prose text-sm text-muted text-pretty">Solo superadmin. Cada cambio pide un motivo y queda en auditoría con el antes y el después.</p>
      </div>

      {blocked && (
        <p className="flex items-start gap-2 rounded-xl bg-[#FDECEC] px-3 py-2.5 text-sm font-semibold text-[#A3261A]">
          <Warning className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Cuenta bloqueada{m.blockedAt ? ` desde el ${fmtDate(m.blockedAt)}` : ""}. No puede entrar a la app.{m.blockedReason && <span className="block font-normal">{m.blockedReason}</span>}</span>
        </p>
      )}

      <Block title="Datos y correo" id="m-datos" icon={<IdentificationCard className="size-4" aria-hidden />}>
        <dl className="rounded-xl bg-paper/60 px-3 text-sm">
          <div className="flex justify-between gap-4 border-b border-line py-2"><dt className="text-muted">Correo</dt><dd className="min-w-0 break-all text-right font-semibold text-ink">{m.auth?.email ?? email ?? "Sin correo"}</dd></div>
          <div className="flex justify-between gap-4 border-b border-line py-2"><dt className="text-muted">Correo confirmado</dt><dd className="font-semibold text-ink">{m.auth ? (m.auth.confirmed ? "Sí" : "Todavía no") : "Sin datos de Auth"}</dd></div>
          {m.auth?.pendingEmail && <div className="flex justify-between gap-4 border-b border-line py-2"><dt className="text-muted">Cambio pendiente a</dt><dd className="min-w-0 break-all text-right font-semibold text-ink">{m.auth.pendingEmail}</dd></div>}
          <div className="flex justify-between gap-4 border-b border-line py-2"><dt className="text-muted">Entra con</dt><dd className="font-semibold text-ink">{m.auth?.providers.length ? m.auth.providers.map((p) => (p === "email" ? "correo" : p === "google" ? "Google" : p)).join(" y ") : "Sin datos"}</dd></div>
          <div className="flex justify-between gap-4 py-2"><dt className="text-muted">Último ingreso</dt><dd className="font-semibold text-ink tabular-nums">{fmtDateTime(m.auth?.lastSignIn ?? null)}</dd></div>
        </dl>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <ConfirmAction action={updateProfile} triggerClassName={trigger} trigger="Editar nombre y país" title="Editar nombre y país" hidden={{ target: id }} confirmLabel="Guardar">
            <div><label htmlFor="m-name" className={label}>Nombre</label><input id="m-name" name="full_name" required minLength={2} maxLength={60} defaultValue={name} autoComplete="off" className={inputSm} /></div>
            <div><label htmlFor="m-country" className={label}>País</label>
              <select id="m-country" name="country" defaultValue={country ?? ""} className={inputSm}><option value="">Sin cambiar</option>{COUNTRIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <Reason id="m-name-r" />
          </ConfirmAction>
          {!isSelf && (
            <ConfirmAction action={changeEmail} triggerClassName={trigger} trigger="Cambiar correo" title="Cambiar el correo de la cuenta" hidden={{ target: id }} confirmLabel="Cambiar correo"
              description="Cambia el correo con el que entra. Su progreso, plan y pagos no cambian.">
              <div><label htmlFor="m-email" className={label}>Correo nuevo</label><input id="m-email" name="email" type="email" required maxLength={254} autoComplete="off" className={inputSm} /></div>
              <fieldset className="space-y-2">
                <legend className={label}>Cómo cambiarlo</legend>
                <label className="flex min-h-11 items-start gap-2 text-sm text-ink"><input type="radio" name="mode" value="ahora" defaultChecked className="mt-1 size-4 accent-[#1B1505]" /><span><b>Cambiar ahora.</b> Ya verificaste que es la persona (p. ej. perdió su correo viejo o lo escribió mal). Le avisamos al correo nuevo.</span></label>
                <label className="flex min-h-11 items-start gap-2 text-sm text-ink"><input type="radio" name="mode" value="confirmar" className="mt-1 size-4 accent-[#1B1505]" /><span><b>Que lo confirme.</b> Le llega un enlace al correo nuevo y cambia cuando lo abre (vence en 1 hora).</span></label>
              </fieldset>
              <Reason id="m-email-r" />
            </ConfirmAction>
          )}
        </div>
      </Block>

      <Block title="Ayuda para entrar" id="m-acceso" icon={<Envelope className="size-4" aria-hidden />}>
        <p className="max-w-prose text-sm text-muted text-pretty">Los correos salen de Supabase con las plantillas de siempre. La contraseña la crea la persona: aquí nunca se ve ni se escribe.</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <ConfirmAction action={sendAccessEmail} triggerClassName={trigger} trigger="Enviar enlace de contraseña" title="Enviar enlace para crear una contraseña nueva" hidden={{ target: id, kind: "clave" }} confirmLabel="Enviar"
            description={<>Le llega a <b className="text-ink break-all">{m.auth?.email ?? email}</b> un enlace para crear una contraseña nueva. Vence en 1 hora.</>}>
            <Reason id="m-clave-r" placeholder="p. ej. no recuerda su contraseña" />
          </ConfirmAction>
          <ConfirmAction action={sendAccessEmail} triggerClassName={trigger} trigger="Enviar enlace para entrar" title="Enviar un enlace para entrar" hidden={{ target: id, kind: "entrar" }} confirmLabel="Enviar"
            description="Le llega un código y un botón para entrar sin contraseña.">
            <Reason id="m-entrar-r" />
          </ConfirmAction>
          {m.auth && !m.auth.confirmed && (
            <ConfirmAction action={sendAccessEmail} triggerClassName={trigger} trigger="Reenviar confirmación" title="Reenviar la confirmación del registro" hidden={{ target: id, kind: "confirmar" }} confirmLabel="Reenviar"
              description="Su correo no está confirmado. Le llega de nuevo el código para terminar de crear la cuenta.">
              <Reason id="m-conf-r" />
            </ConfirmAction>
          )}
          {!isSelf && (
            <ConfirmAction action={signOutEverywhere} triggerClassName={trigger} trigger="Cerrar todas sus sesiones" title="Cerrar todas sus sesiones" hidden={{ target: id }} confirmLabel="Cerrar sesiones"
              description="Sale de la app en todos sus dispositivos y tiene que volver a entrar. Útil si alguien más usa su cuenta.">
              <Reason id="m-salir-r" />
            </ConfirmAction>
          )}
        </div>
      </Block>

      {!isSelf && (
        <Block title="Bloqueo" id="m-bloqueo" icon={<LockKey className="size-4" aria-hidden />}>
          {blocked ? (
            <ConfirmAction action={setBlocked} triggerClassName={trigger} trigger="Desbloquear la cuenta" title="Desbloquear la cuenta" hidden={{ target: id, block: "no" }} confirmLabel="Desbloquear"
              description="Podrá entrar de nuevo con su correo y contraseña.">
              <Reason id="m-desb-r" placeholder="p. ej. se aclaró el caso" />
            </ConfirmAction>
          ) : (
            <ConfirmAction action={setBlocked} danger triggerClassName={`${trigger} text-bad!`} trigger="Bloquear la cuenta" title="Bloquear la cuenta" hidden={{ target: id, block: "si" }} confirmLabel="Bloquear"
              description="No podrá entrar a la app: se cierran sus sesiones y al intentar entrar ve que su cuenta está pausada. Sus datos se guardan. No cancela cobros: si tiene un plan que se renueva, cancela la renovación abajo. Se puede revertir.">
              <Reason id="m-bloq-r" placeholder="p. ej. fraude con tarjetas (caso BB-00042)" />
            </ConfirmAction>
          )}
        </Block>
      )}

      <Block title="Plan" id="m-plan" icon={<Gift className="size-4" aria-hidden />}>
        {m.charge && <p className="text-sm text-ink">Tiene un cobro programado de <b>{money(m.charge.amount_minor / 100)}</b> el <b>{fmtDate(m.charge.charge_at)}</b>.</p>}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <ConfirmAction action={grantPlan} triggerClassName={trigger} trigger="Dar plan o extender prueba" title="Dar un plan de cortesía" hidden={{ target: id }} confirmLabel="Otorgar"
            description="Acceso sin cobro hasta la fecha elegida. Una cortesía vigente se reemplaza. Al vencer vuelve a su plan anterior. Para extender la prueba, elige 7 días.">
            <div><label htmlFor="m-plan-p" className={label}>Plan</label>
              <select id="m-plan-p" name="plan" defaultValue="completo" className={inputSm}><option value="entreno">Entreno</option><option value="completo">Entreno + Nutrición</option></select></div>
            <div><label htmlFor="m-plan-d" className={label}>Duración</label>
              <select id="m-plan-d" name="duration" defaultValue="30" className={inputSm}>
                <option value="7">7 días</option><option value="30">30 días</option><option value="90">3 meses</option><option value="365">1 año</option>
                <option value="fecha">Hasta una fecha</option><option value="siempre">Sin vencimiento</option>
              </select></div>
            <div><label htmlFor="m-plan-f" className={label}>Fecha, si elegiste Hasta una fecha</label>
              <input id="m-plan-f" name="date" type="date" min={addDays(today, 1)} defaultValue={addDays(today, 30)} className={inputSm} /></div>
            {m.charge && (
              <label className="flex min-h-11 items-start gap-2 text-sm text-ink"><input type="checkbox" name="stop_charge" defaultChecked className="mt-0.5 size-4 accent-[#1B1505]" />
                <span>Cancelar también su cobro programado del {fmtDate(m.charge.charge_at)}. La cortesía sola no lo detiene.</span></label>
            )}
            <Reason id="m-plan-r" placeholder="p. ej. embajadora de la marca" />
          </ConfirmAction>
          {m.renewing && (
            <ConfirmAction action={cancelRenewal} danger triggerClassName={trigger} trigger="Cancelar renovación" title="Cancelar la renovación de su plan" hidden={{ target: id }} confirmLabel="Cancelar renovación"
              description="No se le vuelve a cobrar. Conserva el acceso hasta el fin del periodo que ya pagó. No reembolsa nada.">
              <Reason id="m-ren-r" />
            </ConfirmAction>
          )}
          {m.charge && (
            <ConfirmAction action={cancelScheduledCharge} danger triggerClassName={trigger} trigger="Cancelar cobro programado" title="Cancelar su cobro programado" hidden={{ target: id }} confirmLabel="Cancelar cobro"
              description="No se le cobra. Su tarjeta queda guardada y le llega el aviso de siempre.">
              <Reason id="m-cob-r" />
            </ConfirmAction>
          )}
        </div>
        <p className="text-xs text-muted text-pretty">Los reembolsos se hacen en <a href="https://dashboard.onvopay.com" target="_blank" rel="noopener noreferrer" className={link}>ONVO</a> (Costa Rica) o en <a href="https://app.tilopay.com" target="_blank" rel="noopener noreferrer" className={link}>Tilopay</a> (otros países). Desde aquí no se cobra ni se devuelve dinero.</p>
      </Block>

      <Block title="Temporadas y retos" id="m-retos" icon={<Trophy className="size-4" aria-hidden />}>
        {m.access.length ? (
          <ul className="space-y-2">{m.access.map((a) => (
            <li key={a.slug} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">{a.title ?? a.slug}{a.season && <Badge tone="info">Temporada</Badge>}<Badge tone={a.source === "compra" ? "good" : "muted"}>{ACCESS_SOURCE_LABEL[a.source] ?? a.source}</Badge></p>
                <MetaList className="mt-0.5" items={[`Desde el ${fmtDate(a.created_at)}`, a.reason]} />
              </div>
              <div className="flex flex-wrap gap-1">
                {m.intakes.includes(a.slug) && (
                  <ConfirmAction action={resetIntake} triggerClassName={rowAction} trigger="Reiniciar cuestionario" title={`Reiniciar el cuestionario de ${a.title ?? a.slug}`} hidden={{ target: id, slug: a.slug }} confirmLabel="Reiniciar"
                    description="Lo vuelve a llenar la próxima vez que abra la temporada. Su plan se arma de nuevo con las respuestas nuevas.">
                    <Reason id={`m-int-${a.slug}`} />
                  </ConfirmAction>
                )}
                <ConfirmAction action={revokeAccess} danger triggerClassName={rowActionDanger} trigger="Quitar acceso" title={`Quitar el acceso a ${a.title ?? a.slug}`} hidden={{ target: id, slug: a.slug }} confirmLabel="Quitar acceso"
                  description={a.source === "compra" ? "Es una compra: quitar el acceso no devuelve el dinero. Si corresponde, reembolsa en ONVO o Tilopay." : a.source === "anual" ? "Es la temporada incluida en su plan anual: queda libre para que elija otra." : "Deja de verlo en la app. Su progreso queda guardado."}>
                  <Reason id={`m-rev-${a.slug}`} />
                </ConfirmAction>
              </div>
            </li>
          ))}</ul>
        ) : <p className="text-sm text-muted">No tiene temporadas, programas ni retos de pago.</p>}
        {grantable.length > 0 && (
          <ConfirmAction action={grantAccess} triggerClassName={trigger} trigger="Dar acceso gratis" title="Dar acceso gratis" hidden={{ target: id }} confirmLabel="Dar acceso"
            description="Queda como cortesía. Funciona aunque las inscripciones de la temporada ya hayan cerrado.">
            <div><label htmlFor="m-acc-s" className={label}>Temporada, programa o reto</label>
              <select id="m-acc-s" name="slug" required className={inputSm}>
                {grantable.some((c) => c.season) && <optgroup label="Temporadas">{grantable.filter((c) => c.season).map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}</optgroup>}
                <optgroup label="Programas y retos de pago">{grantable.filter((c) => !c.season).map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}</optgroup>
              </select></div>
            <Reason id="m-acc-r" />
          </ConfirmAction>
        )}
        <div>
          <h4 className="mb-2 text-sm font-bold text-ink">Progreso</h4>
          {progressSlugs.length ? (
            <ul className="space-y-2">{progressSlugs.map((slug) => {
              const p = m.programs.find((x) => x.slug === slug);
              const c = m.challenges.find((x) => x.slug === slug);
              return (
                <li key={slug} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{p?.title ?? c?.title ?? titles[slug] ?? slug}</p>
                    <MetaList className="mt-0.5" items={[PROGRAM_STATUS[p?.status ?? c?.status ?? ""] ?? null, `Desde el ${fmtDate(p?.started_on ?? c?.started_on ?? null)}`, c ? `${fmtNum(c.checkins)} días marcados` : null]} />
                  </div>
                  <ConfirmAction action={resetProgress} danger triggerClassName={rowActionDanger} trigger="Reiniciar progreso" title={`Reiniciar el progreso de ${p?.title ?? c?.title ?? slug}`} hidden={{ target: id, slug }} confirmLabel="Reiniciar"
                    description="Borra su avance y empieza de cero cuando lo abra. El acceso y el XP ya ganado se quedan. No se puede deshacer.">
                    <Reason id={`m-rp-${slug}`} />
                  </ConfirmAction>
                </li>);
            })}</ul>
          ) : <p className="text-sm text-muted">Sin retos ni programas empezados.</p>}
        </div>
      </Block>

      <Block title="Insignias" id="m-insignias" icon={<Medal className="size-4" aria-hidden />}>
        {m.badges.length ? (
          <ul className="flex flex-wrap gap-2">{m.badges.filter((b) => b.id !== "nivel").map((b) => {
            const o = overrides.get(b.id);
            const manual = b.id !== "verificado";
            return (
              <li key={b.id} className="flex items-center gap-1 rounded-xl border border-line py-1 pl-3 pr-1 text-sm">
                <span className="font-semibold text-ink">{badgeLabel(b.id, b.label, titles)}</span>
                {o?.mode === "otorgada" && <Badge tone="info">A mano</Badge>}
                {manual && (
                  <ConfirmAction action={setBadge} danger triggerClassName={rowActionDanger} trigger="Quitar" title={`Quitar la insignia ${badgeLabel(b.id, b.label, titles)}`} hidden={{ target: id, badge: b.id, mode: o?.mode === "otorgada" ? "ninguna" : "quitada" }} confirmLabel="Quitar"
                    description={o?.mode === "otorgada" ? "Se la diste a mano: deja de verse." : "La ganó con sus datos. Deja de verse aunque siga cumpliendo la meta, hasta que la devuelvas."}>
                    <Reason id={`m-bq-${b.id}`} />
                  </ConfirmAction>
                )}
              </li>);
          })}</ul>
        ) : <p className="text-sm text-muted">Sin insignias todavía.</p>}
        {m.overrides.filter((o) => o.mode === "quitada").length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-bold text-ink">Quitadas a mano</h4>
            <ul className="flex flex-wrap gap-2">{m.overrides.filter((o) => o.mode === "quitada").map((o) => (
              <li key={o.id} className="flex items-center gap-1 rounded-xl border border-dashed border-line py-1 pl-3 pr-1 text-sm text-muted">
                {badgeLabel(o.id, null, titles)}
                <ConfirmAction action={setBadge} triggerClassName={rowAction} trigger="Devolver" title={`Devolver la insignia ${badgeLabel(o.id, null, titles)}`} hidden={{ target: id, badge: o.id, mode: "ninguna" }} confirmLabel="Devolver"
                  description="Vuelve a verse si la sigue cumpliendo con sus datos.">
                  <Reason id={`m-bd-${o.id}`} />
                </ConfirmAction>
              </li>
            ))}</ul>
          </div>
        )}
        {awardable.length > 0 && (
          <ConfirmAction action={setBadge} triggerClassName={trigger} trigger="Otorgar insignia" title="Otorgar una insignia" hidden={{ target: id, mode: "otorgada" }} confirmLabel="Otorgar"
            description="Se ve en su perfil y en la comunidad como si la hubiera ganado. Nivel e identidad verificada no se dan a mano.">
            <div><label htmlFor="m-badge" className={label}>Insignia</label>
              <select id="m-badge" name="badge" required className={inputSm}>{awardable.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></div>
            <Reason id="m-badge-r" placeholder="p. ej. migró sus entrenos de otra app" />
          </ConfirmAction>
        )}
      </Block>

      <Block title="XP" id="m-xp" icon={<Lightning className="size-4" aria-hidden />}>
        <p className="text-sm text-ink">Tiene <b className="tabular-nums">{fmtNum(m.xp)} XP</b>{m.xpAdjust !== 0 && <span className="text-muted"> (incluye {m.xpAdjust > 0 ? "+" : ""}{fmtNum(m.xpAdjust)} de ajustes)</span>}.</p>
        <ConfirmAction action={adjustXp} triggerClassName={trigger} trigger="Ajustar XP" title="Ajustar XP" hidden={{ target: id, total: m.xp }} confirmLabel="Ajustar"
          description="Suma o resta XP (usa un número negativo para restar). Cambia su nivel si cruza un límite. El total nunca queda bajo 0.">
          <div><label htmlFor="m-xp-d" className={label}>XP a sumar o restar</label><input id="m-xp-d" name="delta" type="number" inputMode="numeric" required min={-20000} max={20000} step={1} placeholder="p. ej. 200 o -150" className={inputSm} /></div>
          <Reason id="m-xp-r" placeholder="p. ej. compensación por un entreno que no se guardó" />
        </ConfirmAction>
      </Block>

      <p className="text-xs text-muted"><Link href={`/admin/auditoria?target=${id}`} className={link}>Ver todo su historial en auditoría</Link></p>
    </section>
  );
}
