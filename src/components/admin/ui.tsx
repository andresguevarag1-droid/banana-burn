// Piezas de UI del panel (server-safe).
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
import { ArrowLeft, CaretLeft as ChevronLeft, CaretRight as ChevronRight, Info, Warning as TriangleAlert } from "@/components/icons";
import { ROLE_LABEL } from "@/lib/admin-perms";
import { EMPTY, fmtNum } from "@/lib/admin-format";
import type { Role } from "@/lib/supabase/server";

export { EMPTY, fmtDate, fmtDateTime, fmtDay, fmtNum, fmtPct, money } from "@/lib/admin-format";

/*
 * Sistema visual del panel: superficies planas (borde, sin sombra, radio 1rem), botones compactos de 40 px
 * sin sombra y con transiciones explícitas (la utilidad global `btn` usa `transition-all`), números tabulares.
 * Un panel interno se usa decenas de veces al día: nada se anima salvo el feedback de presión.
 */
export const panel = "rounded-2xl border border-line bg-white";
const press = "transition-[background-color,border-color,color,transform]! duration-150! ease-out! shadow-none!";
export const btnPrimary = `btn-primary h-10! px-4! text-sm! ${press}`;
export const btnGhost = `btn-ghost h-10! px-4! text-sm! bg-white! ${press}`;
export const btnDanger = `btn h-10! px-4! text-sm! bg-bad text-white hover:bg-[#A82227] ${press}`;
/** Acciones de fila en tablas: texto compacto, sin borde, para no llenar la tabla de botones. */
export const rowAction = "tap inline-flex h-8 items-center rounded-lg px-2 text-sm font-semibold text-ink hover:bg-paper active:scale-[.97] transition-[background-color,transform] duration-150 ease-out outline-none focus-visible:ring-4 focus-visible:ring-banana/50";
export const rowActionDanger = rowAction.replace("text-ink hover:bg-paper", "text-bad hover:bg-[#FDECEC]");
export const link = "font-semibold text-ink underline decoration-line underline-offset-2 hover:decoration-ink rounded outline-none focus-visible:ring-4 focus-visible:ring-banana/50";

/**
 * Encabezado único de cada sección del panel: título, una línea de descripción y acciones opcionales.
 * `back` agrega un enlace de regreso arriba del título; `meta` muestra chips (rol, estado) bajo la descripción.
 */
export function PageHeader({ title, desc, children, back, meta }: { title: string; desc?: ReactNode; children?: ReactNode; back?: { href: string; label: string }; meta?: ReactNode }) {
  return (
    <header className="space-y-2">
      {back && <Link href={back.href} className="tap inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-muted hover:text-ink outline-none focus-visible:ring-4 focus-visible:ring-banana/50"><ArrowLeft className="size-4" aria-hidden />{back.label}</Link>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-ink break-words text-balance">{title}</h1>
          {desc && <p className="mt-1 text-sm text-muted max-w-prose break-words text-pretty">{desc}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {children && <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">{children}</div>}
      </div>
    </header>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "good" | "bad" | "muted" }) {
  return (
    <div className={`${panel} p-4`}>
      <p className="text-[13px] font-semibold text-muted truncate">{label}</p>
      <p className="mt-2 text-2xl leading-none font-extrabold tracking-tight text-ink tabular-nums">{value}</p>
      {hint && <p className={`mt-2 text-xs leading-snug tabular-nums text-pretty ${tone === "good" ? "text-peel font-semibold" : tone === "bad" ? "text-bad font-semibold" : "text-muted"}`}>{hint}</p>}
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
  return <span className={`chip h-6 whitespace-nowrap ${ROLE_STYLE[role] ?? "bg-line text-ink"}`}>{label}</span>;
}

const TONE: Record<string, string> = {
  good: "bg-[#E8F6EE] text-[#17703A]", warn: "bg-banana-soft text-[#6E4E00]", bad: "bg-[#FDECEC] text-[#B4232A]", info: "bg-[#E6EEFD] text-[#1D4FBF]", muted: "bg-line text-[#4F4636]",
};
export function Badge({ tone = "muted", children }: { tone?: keyof typeof TONE; children: ReactNode }) {
  return <span className={`chip h-6 whitespace-nowrap ${TONE[tone]}`}>{children}</span>;
}

export const SUB_STATUS: Record<string, [string, keyof typeof TONE]> = {
  active: ["Activa", "good"], trialing: ["Prueba", "info"], past_due: ["Pago pendiente", "bad"], unpaid: ["Impaga", "bad"],
  incomplete: ["Incompleta", "warn"], canceled: ["Cancelada", "muted"], cancelled: ["Cancelada", "muted"], failed: ["Fallida", "bad"], expired: ["Vencida", "muted"],
};
export function SubStatus({ status }: { status?: string | null }) {
  if (!status) return <span className="text-sm text-muted whitespace-nowrap">Sin suscripción</span>;
  const [l, t] = SUB_STATUS[status] ?? [status, "muted"];
  return <Badge tone={t}>{l}</Badge>;
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn"; title: string; children?: ReactNode }) {
  const Icon = tone === "warn" ? TriangleAlert : Info;
  return (
    <div role={tone === "warn" ? "alert" : "status"} className={`flex gap-3 rounded-2xl border px-4 py-3 text-sm ${tone === "warn" ? "border-[#F2C94C] bg-banana-soft/60 text-[#5B4300]" : "border-line bg-white/60 text-body"}`}>
      <Icon className="size-5 shrink-0 mt-px" aria-hidden />
      <div className="min-w-0 max-w-prose"><p className="font-bold">{title}</p>{children && <div className="mt-0.5 text-[13px] leading-relaxed text-pretty">{children}</div>}</div>
    </div>
  );
}

export const DemoNotice = ({ what = "estos datos" }: { what?: string }) => (
  <Notice title="Datos de demostración">Sin Supabase configurado, {what} son de ejemplo y las acciones no se guardan.</Notice>
);
export const MigrationNotice = () => (
  <Notice tone="warn" title="Falta la migración 0005_admin.sql">Ejecútala en el SQL Editor de Supabase para habilitar esta sección.</Notice>
);

/** Estado vacío: título corto, explicación opcional y una acción para salir del vacío. `boxed` lo envuelve en un panel. */
export function Empty({ children, title, action, boxed = true }: { children?: ReactNode; title?: string; action?: ReactNode; boxed?: boolean }) {
  return (
    <div className={`px-6 py-10 text-center text-pretty ${boxed ? panel : ""}`} role="status">
      {title && <p className="font-bold text-ink">{title}</p>}
      {children && <p className={`text-sm text-muted ${title ? "mt-1" : ""}`}>{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Celda vacía legible para lectores de pantalla. */
export const Nil = () => <span className="text-faint"><span aria-hidden>{EMPTY}</span><span className="sr-only">Sin dato</span></span>;

/** Tabla con caption accesible (visible u oculto) y scroll horizontal en móvil. */
export function Table({ caption, captionHidden, children, minWidth = 720, className = "", bare = false }: { caption: string; captionHidden?: boolean; children: ReactNode; minWidth?: number; className?: string; bare?: boolean }) {
  // `bare`: dentro de otro panel, sin borde propio (nada de tarjetas dentro de tarjetas).
  return (
    <div className={`${bare ? "-mx-4 border-y border-line" : panel} relative overflow-x-auto overscroll-x-contain ${className}`} tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full text-sm tabular-nums" style={{ minWidth }}>
        <caption className={captionHidden ? "sr-only" : "text-left px-4 pt-3.5 pb-2 text-sm font-bold text-ink"}>{caption}</caption>
        {children}
      </table>
    </div>
  );
}
/** Encabezado de columna: sentence case (sin mayúsculas espaciadas), fondo sutil para separar del cuerpo. */
export const Th = ({ children, className = "" }: { children?: ReactNode; className?: string }) => <th scope="col" className={`bg-[#FCFAF3] px-2.5 py-2.5 first:pl-4 last:pr-4 first:sticky first:left-0 first:z-[1] ${/\btext-(center|right)\b/.test(className) ? "" : "text-left "}text-xs font-semibold text-muted whitespace-nowrap ${className}`}>{children}</th>;
export const Td = ({ children, className = "" }: { children?: ReactNode; className?: string }) => <td className={`px-2.5 py-2.5 first:pl-4 last:pr-4 first:sticky first:left-0 first:z-[1] first:bg-white align-middle ${className}`}>{children}</td>;
/** La primera columna queda fija al desplazar la tabla de lado (en móvil siempre se sabe de quién es la fila). */
/** Clases de fila de tabla (borde inferior + hover sutil, que Tailwind ya limita a punteros finos). */
export const tr = "border-b border-line last:border-0";
export const trHover = `${tr} hover:bg-paper/50`;

/** Paginación por querystring, conservando los filtros. */
export function Pagination({ page, total, pageSize, basePath, params }: { page: number; total: number; pageSize: number; basePath: string; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="text-xs text-muted tabular-nums">{fmtNum(total)} resultado{total === 1 ? "" : "s"}</p>;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const cls = "inline-flex items-center gap-1 h-11 px-4 rounded-full border border-line bg-white text-sm font-semibold text-ink outline-none focus-visible:ring-4 focus-visible:ring-banana/50";
  const live = `${cls} hover:bg-paper active:scale-[.97] transition-[background-color,transform] duration-150 ease-out`;
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-xs text-muted tabular-nums">Página {page} de {pages}, {fmtNum(total)} resultados</p>
      <div className="flex gap-2">
        {page > 1 ? <Link className={live} href={href(page - 1)} rel="prev"><ChevronLeft className="size-4" aria-hidden />Anterior</Link> : <span className={`${cls} text-faint! border-line/60`} aria-disabled="true"><ChevronLeft className="size-4" aria-hidden />Anterior</span>}
        {page < pages ? <Link className={live} href={href(page + 1)} rel="next">Siguiente<ChevronRight className="size-4" aria-hidden /></Link> : <span className={`${cls} text-faint! border-line/60`} aria-disabled="true">Siguiente<ChevronRight className="size-4" aria-hidden /></span>}
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
export const inputSm = "input h-11! rounded-xl! px-3! text-sm! transition-[border-color,box-shadow,background-color]!";
export const textareaSm = "input h-auto! py-2 rounded-xl! px-3! text-sm! transition-[border-color,box-shadow,background-color]!";

/**
 * Barra de filtros única para todas las listas: campos en fila que se envuelven, botones siempre al final a la derecha.
 * "Limpiar" aparece a la izquierda de "Filtrar", así el botón principal no cambia de lugar al filtrar.
 * Sin textos de ayuda bajo los campos: desalinearían la fila.
 */
export function FilterBar({ label, children, filtered, clearHref, submitLabel = "Filtrar", search = false }: { label: string; children: ReactNode; filtered?: boolean; clearHref?: string; submitLabel?: string; search?: boolean }) {
  return (
    <form className={`${panel} flex flex-wrap items-end gap-3 p-3 sm:p-4`} role={search ? "search" : undefined} aria-label={label}>
      {children}
      <div className="ml-auto flex gap-2">
        {filtered && clearHref && <Link href={clearHref} className={btnGhost}>Limpiar</Link>}
        <button className={btnPrimary}>{submitLabel}</button>
      </div>
    </form>
  );
}
/** Anchos de campo dentro de FilterBar (crecen y se envuelven sin dejar huecos). */
export const fw = { search: "flex-[2_1_16rem]", select: "flex-[1_1_9rem]", date: "flex-[1_1_9.5rem]" } as const;

/** Título de sección dentro de una página: uno solo por bloque, sin mayúsculas espaciadas; acción opcional a la derecha. */
export function SectionHeading({ id, title, action, desc }: { id: string; title: string; action?: ReactNode; desc?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-bold text-ink text-balance">{title}</h2>
        {desc && <p className="mt-0.5 text-sm text-muted max-w-prose text-pretty">{desc}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

/** Pestañas secundarias (Contenido, Comunidad): subrayado, sin competir con la navegación principal. Se desplazan en móvil. */
export function SubTabs({ label, items }: { label: string; items: { href: string; label: string; current: boolean; icon?: IconType; badge?: number }[] }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max min-w-full gap-1 border-b border-line text-sm">
        {items.map((t) => (
          <li key={t.href}>
            <Link href={t.href} aria-current={t.current ? "page" : undefined}
              className={`-mb-px inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 px-3 font-semibold outline-none transition-colors duration-150 focus-visible:ring-4 focus-visible:ring-banana/50 ${t.current ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}>
              {t.icon && <t.icon className="size-4" aria-hidden />}{t.label}
              {!!t.badge && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ember px-1.5 text-[11px] font-bold text-ink tabular-nums">{t.badge}<span className="sr-only"> pendientes</span></span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Datos secundarios en línea (sustituye cadenas con puntos medios): cada dato en su propio span, separados por espacio. */
export function MetaList({ items, className = "" }: { items: ReactNode[]; className?: string }) {
  const list = items.filter((x) => x !== null && x !== undefined && x !== false && x !== "");
  return <span className={`inline-flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted tabular-nums ${className}`}>{list.map((x, i) => <span key={i} className="min-w-0 break-words">{x}</span>)}</span>;
}

/** Plan con periodicidad en segunda línea ("Entreno (mensual)" llega así desde los datos). */
export function PlanText({ label }: { label: string }) {
  const m = /^(.*?)\s*\(([^()]+)\)$/.exec(label);
  const [plan, period] = m ? [m[1], m[2]] : [label, ""];
  return <><span className="whitespace-nowrap text-ink">{plan}</span>{period && <span className="block text-xs text-muted">{period.charAt(0).toUpperCase() + period.slice(1)}</span>}</>;
}

export function ago(day: string | null, today: string): string {
  if (!day) return "Nunca";
  const d = Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(day.slice(0, 10) + "T00:00:00Z")) / 864e5);
  return d <= 0 ? "Hoy" : d === 1 ? "Ayer" : `Hace ${d} d`;
}
