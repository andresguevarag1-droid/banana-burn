// Piezas de UI del panel (server-safe).
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CaretLeft as ChevronLeft, CaretRight as ChevronRight, Info, Warning as TriangleAlert } from "@/components/icons";
import { ROLE_LABEL } from "@/lib/admin-perms";
import { EMPTY, fmtNum } from "@/lib/admin-format";
import type { Role } from "@/lib/supabase/server";

export { EMPTY, fmtDate, fmtDateTime, fmtDay, fmtNum, fmtPct, money } from "@/lib/admin-format";

/**
 * Encabezado único de cada sección del panel: título, una línea de descripción y acciones opcionales.
 * `back` agrega un enlace de regreso arriba del título; `meta` muestra chips (rol, estado) bajo la descripción.
 */
export function PageHeader({ title, desc, children, back, meta }: { title: string; desc?: ReactNode; children?: ReactNode; back?: { href: string; label: string }; meta?: ReactNode }) {
  return (
    <header className="space-y-2">
      {back && <Link href={back.href} className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-muted hover:text-ink outline-none focus-visible:ring-4 focus-visible:ring-banana/50"><ArrowLeft className="size-4" aria-hidden />{back.label}</Link>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink break-words">{title}</h1>
          {desc && <p className="mt-1 text-sm text-muted max-w-2xl break-words">{desc}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {children && <div className="flex flex-wrap gap-2 sm:justify-end">{children}</div>}
      </div>
    </header>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "good" | "bad" | "muted" }) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className="mt-1.5 text-xl sm:text-[28px] leading-none font-extrabold text-ink tabular-nums break-words">{value}</p>
      {hint && <p className={`mt-1.5 text-xs ${tone === "good" ? "text-peel font-semibold" : tone === "bad" ? "text-bad font-semibold" : "text-muted"}`}>{hint}</p>}
    </div>
  );
}

const ROLE_STYLE: Record<string, string> = {
  superadmin: "bg-ink text-white", admin: "bg-[#3A3220] text-white", coach: "bg-[#E6EEFD] text-[#1D4FBF]",
  support: "bg-[#E8F6EE] text-[#17703A]", pro: "bg-line text-[#4F4636]", free: "bg-line text-[#4F4636]",
};
/** Rol de acceso (no el plan): usuarios finales se muestran como "Usuario"; el plan va en su propia columna. */
export function RoleBadge({ role }: { role: Role | string }) {
  const label = role === "free" || role === "pro" ? "Usuario" : ROLE_LABEL[role as Role] ?? role;
  return <span className={`chip h-6 ${ROLE_STYLE[role] ?? "bg-line text-ink"}`}>{label}</span>;
}

const TONE: Record<string, string> = {
  good: "bg-[#E8F6EE] text-[#17703A]", warn: "bg-banana-soft text-[#6E4E00]", bad: "bg-[#FDECEC] text-[#B4232A]", info: "bg-[#E6EEFD] text-[#1D4FBF]", muted: "bg-line text-[#4F4636]",
};
export function Badge({ tone = "muted", children }: { tone?: keyof typeof TONE; children: ReactNode }) {
  return <span className={`chip h-6 ${TONE[tone]}`}>{children}</span>;
}

export const SUB_STATUS: Record<string, [string, keyof typeof TONE]> = {
  active: ["Activa", "good"], trialing: ["Prueba", "info"], past_due: ["Pago pendiente", "bad"], unpaid: ["Impaga", "bad"],
  incomplete: ["Incompleta", "warn"], canceled: ["Cancelada", "muted"], cancelled: ["Cancelada", "muted"], failed: ["Fallida", "bad"], expired: ["Vencida", "muted"],
};
export function SubStatus({ status }: { status?: string | null }) {
  if (!status) return <span className="text-sm text-muted">Sin suscripción</span>;
  const [l, t] = SUB_STATUS[status] ?? [status, "muted"];
  return <Badge tone={t}>{l}</Badge>;
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn"; title: string; children?: ReactNode }) {
  const Icon = tone === "warn" ? TriangleAlert : Info;
  return (
    <div role={tone === "warn" ? "alert" : "status"} className={`flex gap-3 rounded-2xl border p-4 text-sm ${tone === "warn" ? "border-[#F2C94C] bg-banana-soft/60 text-[#5B4300]" : "border-line bg-white text-body"}`}>
      <Icon className="size-5 shrink-0 mt-0.5" aria-hidden />
      <div><p className="font-bold">{title}</p>{children && <div className="mt-0.5 text-[13px] leading-relaxed">{children}</div>}</div>
    </div>
  );
}

export const DemoNotice = ({ what = "estos datos" }: { what?: string }) => (
  <Notice title="Datos de demostración">Sin Supabase configurado, {what} son de ejemplo y las acciones no se guardan.</Notice>
);
export const MigrationNotice = () => (
  <Notice tone="warn" title="Falta la migración 0005_admin.sql">Ejecútala en el SQL Editor de Supabase para habilitar esta sección.</Notice>
);

/** Estado vacío: título corto, explicación opcional y una acción para salir del vacío. */
export function Empty({ children, title, action }: { children?: ReactNode; title?: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center" role="status">
      {title && <p className="font-bold text-ink">{title}</p>}
      {children && <p className={`text-sm text-muted ${title ? "mt-1" : ""}`}>{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Celda vacía legible para lectores de pantalla. */
export const Nil = () => <span className="text-faint"><span aria-hidden>{EMPTY}</span><span className="sr-only">Sin dato</span></span>;

/** Tabla con caption accesible (visible u oculto) y scroll horizontal en móvil. */
export function Table({ caption, captionHidden, children, minWidth = 720 }: { caption: string; captionHidden?: boolean; children: ReactNode; minWidth?: number }) {
  return (
    <div className="card relative overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full text-sm" style={{ minWidth }}>
        <caption className={captionHidden ? "sr-only" : "text-left px-4 pt-4 pb-1 text-sm font-bold text-ink"}>{caption}</caption>
        {children}
      </table>
    </div>
  );
}
export const Th = ({ children, className = "" }: { children?: ReactNode; className?: string }) => <th scope="col" className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted whitespace-nowrap ${className}`}>{children}</th>;
export const Td = ({ children, className = "" }: { children?: ReactNode; className?: string }) => <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;

/** Paginación por querystring, conservando los filtros. */
export function Pagination({ page, total, pageSize, basePath, params }: { page: number; total: number; pageSize: number; basePath: string; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="text-xs text-muted">{fmtNum(total)} resultado{total === 1 ? "" : "s"}</p>;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const cls = "inline-flex items-center gap-1 h-9 px-3 rounded-full border border-line bg-white text-sm font-semibold text-ink outline-none focus-visible:ring-4 focus-visible:ring-banana/50 hover:bg-paper";
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-xs text-muted">Página {page} de {pages} · {fmtNum(total)} resultados</p>
      <div className="flex gap-2">
        {page > 1 ? <Link className={cls} href={href(page - 1)} rel="prev"><ChevronLeft className="size-4" aria-hidden />Anterior</Link> : <span className={`${cls} opacity-40`} aria-disabled="true"><ChevronLeft className="size-4" aria-hidden />Anterior</span>}
        {page < pages ? <Link className={cls} href={href(page + 1)} rel="next">Siguiente<ChevronRight className="size-4" aria-hidden /></Link> : <span className={`${cls} opacity-40`} aria-disabled="true">Siguiente<ChevronRight className="size-4" aria-hidden /></span>}
      </div>
    </nav>
  );
}

/** Campo con etiqueta (siempre visible) para filtros y formularios. */
export function Field({ label, htmlFor, hint, children, className = "" }: { label: string; htmlFor: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-xs font-bold text-ink mb-1">{label}</label>
      {children}
      {hint && <p id={`${htmlFor}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Variante compacta del input de marca para tablas y filtros. */
export const inputSm = "input h-10! rounded-xl! text-sm!";

export function ago(day: string | null, today: string): string {
  if (!day) return "Nunca";
  const d = Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(day.slice(0, 10) + "T00:00:00Z")) / 864e5);
  return d <= 0 ? "Hoy" : d === 1 ? "Ayer" : `Hace ${d} d`;
}
