import Link from "next/link";
import { requireSection } from "@/lib/admin-auth";
import { can } from "@/lib/admin-perms";
import { getTesterOverview } from "@/lib/testers-server";
import { daysLeftLabel, FEEDBACK_KIND_LABEL, FEEDBACK_STATUS_LABEL, testerDaysLeft, type FeedbackKind } from "@/lib/testers";
import { setFeedbackStatus } from "../../testers-actions";
import { ActionForm, Submit } from "@/components/admin/action-form";
import { Badge, DemoNotice, Empty, MetaList, Notice, PageHeader, Table, Td, Th, fmtDate, fmtDateTime, fmtNum, link, panel, rowAction, trHover } from "@/components/admin/ui";

export const metadata = { title: "Testers y reportes" };

export default async function TestersPage() {
  const v = await requireSection("usuarios");
  const { testers, feedback, unavailable } = await getTesterOverview(v);
  const open = feedback.filter((f) => f.status !== "resuelto");
  const manage = can(v.role, "feedback.manage");

  return (
    <div className="space-y-5">
      <PageHeader back={{ href: "/admin/usuarios", label: "Usuarios" }} title="Testers y reportes"
        desc="Quién está probando la beta, cuándo termina su mes de cortesía y lo que reportan desde la app. Para hacer tester a alguien, abre su ficha." />
      {v.demo && <DemoNotice what="los testers y sus reportes" />}
      {unavailable && <Notice tone="warn" title="Falta la migración 0029_testers.sql">Ejecútala en el SQL Editor de Supabase para habilitar los testers y los reportes.</Notice>}

      <dl className={`${panel} grid grid-cols-3 divide-x divide-line`}>
        {([["Testers vigentes", testers.length], ["Terminan en 3 días", testers.filter((t) => testerDaysLeft(t.expires_at) <= 3).length], ["Reportes abiertos", open.length]] as const).map(([l, n]) => (
          <div key={l} className="flex flex-col-reverse gap-1 px-3 py-3 sm:px-4"><dt className="text-xs text-muted">{l}</dt><dd className="text-2xl font-extrabold leading-none text-ink tabular-nums">{fmtNum(n)}</dd></div>
        ))}
      </dl>

      {testers.length > 0 && (
        <ul className={`${panel} divide-y divide-line md:hidden`} aria-label={`Testers vigentes: ${fmtNum(testers.length)}`}>
          {testers.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/usuarios/${t.id}#s-tester`} className="flex min-h-11 items-center gap-3 px-4 py-3 outline-none transition-colors duration-150 hover:bg-paper/50 focus-visible:bg-paper focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-banana/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{t.name}</p>
                  <MetaList className="mt-1" items={[`Hasta el ${fmtDate(t.expires_at)}`, testerDaysLeft(t.expires_at) <= 3 ? <Badge key="q" tone="warn">{daysLeftLabel(testerDaysLeft(t.expires_at))}</Badge> : daysLeftLabel(testerDaysLeft(t.expires_at)), t.reports ? `${fmtNum(t.reports)} ${t.reports === 1 ? "reporte" : "reportes"}` : null]} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {testers.length ? (
        <Table caption={`Testers vigentes: ${fmtNum(testers.length)}`} minWidth={560} className="hidden md:block">
          <thead className="border-b border-line"><tr><Th>Persona</Th><Th>Desde</Th><Th>Hasta</Th><Th>Quedan</Th><Th className="text-right">Reportes</Th></tr></thead>
          <tbody>{testers.map((t) => (
            <tr key={t.id} className={trHover}>
              <Td className="max-w-64"><Link href={`/admin/usuarios/${t.id}#s-tester`} className={`block truncate font-semibold ${link}`}>{t.name}</Link>{t.email && <p className="truncate text-xs text-muted">{t.email}</p>}</Td>
              <Td className="whitespace-nowrap text-muted">{fmtDate(t.starts_at)}</Td>
              <Td className="whitespace-nowrap">{fmtDate(t.expires_at)}</Td>
              <Td className="whitespace-nowrap">{testerDaysLeft(t.expires_at) <= 3 ? <Badge tone="warn">{daysLeftLabel(testerDaysLeft(t.expires_at))}</Badge> : daysLeftLabel(testerDaysLeft(t.expires_at))}</Td>
              <Td className="text-right tabular-nums">{fmtNum(t.reports)}</Td>
            </tr>
          ))}</tbody>
        </Table>
      ) : !unavailable && <Empty title="Todavía no hay testers vigentes">Abre la ficha de una persona y toca Hacer tester por 1 mes.</Empty>}

      <section aria-labelledby="t-reportes" className={`${panel} space-y-3 p-4`}>
        <h2 id="t-reportes" className="text-base font-bold text-ink">Reportes desde la app</h2>
        {feedback.length ? (
          <ul className="space-y-2">{feedback.map((f) => (
            <li key={f.id} className="rounded-xl border border-line px-3 py-2.5 text-sm">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                <Link href={`/admin/usuarios/${f.user_id}#s-tester`} className={link}>{f.name ?? "Sin nombre"}</Link>
                <span className="text-muted font-normal">{FEEDBACK_KIND_LABEL[f.kind as FeedbackKind] ?? f.kind}</span>
                <Badge tone={f.status === "resuelto" ? "good" : f.status === "visto" ? "muted" : "warn"}>{FEEDBACK_STATUS_LABEL[f.status] ?? f.status}</Badge>
                {f.from_tester && <Badge tone="info">Tester</Badge>}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-body text-pretty">{f.body}</p>
              <MetaList className="mt-1" items={[fmtDateTime(f.created_at), f.page && `En ${f.page}`]} />
              {manage && f.status !== "resuelto" && (
                <ActionForm action={setFeedbackStatus} className="mt-2 flex flex-wrap gap-1">
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="status" value={f.status === "nuevo" ? "visto" : "resuelto"} />
                  <Submit className={rowAction} pendingText="Guardando…">{f.status === "nuevo" ? "Marcar visto" : "Marcar resuelto"}</Submit>
                </ActionForm>
              )}
            </li>
          ))}</ul>
        ) : <p className="text-sm text-muted">Sin reportes todavía. Les llegan desde el botón Reportar algo en Hoy.</p>}
      </section>
    </div>
  );
}
