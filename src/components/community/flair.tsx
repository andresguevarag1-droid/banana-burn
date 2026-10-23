// Insignias junto al nombre en la comunidad: verificado, nivel de perfil e insignia destacada.
// Sin hooks: sirve en componentes de servidor y de cliente. Compactas y legibles: cada pieza tiene su texto para
// lectores de pantalla y un title para quien pasa el cursor. Solo muestra lo que viene de la base (0030).
import { BrandIcon } from "@/components/icons";
import { tierByIdx, type Flair } from "@/lib/profile-power";

/** Fondo y tinta de cada nivel de perfil (contraste AA del ícono sobre el fondo). */
export const TIER_SKIN: Record<number, { chip: string; ring: string; text: string }> = {
  1: { chip: "bg-cream text-peel border border-line", ring: "ring-line", text: "text-peel" },
  2: { chip: "bg-[linear-gradient(135deg,#FFE45C,#FFD60A)] text-ink", ring: "ring-banana", text: "text-banana-ink" },
  3: { chip: "bg-[linear-gradient(135deg,#FFE066,#F2A100)] text-ink", ring: "ring-ember", text: "text-ember-ink" },
  4: { chip: "bg-[linear-gradient(135deg,#4A7A14,#2C4D09)] text-white", ring: "ring-peel", text: "text-peel" },
  5: { chip: "bg-[linear-gradient(135deg,#3A3120,#1B1505)] text-banana ring-1 ring-banana/70", ring: "ring-banana", text: "text-ink" },
};
export const tierSkin = (idx: number | null | undefined) => TIER_SKIN[tierByIdx(idx).idx];

/** Sello de verificado (escudo con check). Verde hoja: contraste 6,9:1 sobre blanco. */
export function VerifiedMark({ className = "size-4", label = true }: { className?: string; label?: boolean }) {
  return (
    <span className="inline-grid shrink-0 place-items-center align-middle" title="Identidad verificada">
      <svg viewBox="0 0 24 24" aria-hidden className={`${className} text-peel`}>
        <path fill="currentColor" d="M12 1.8l2.4 1.7 2.9-.2 1 2.8 2.5 1.5-.7 2.8 1.2 2.7-2.2 1.9-.3 2.9-2.9.6-1.7 2.4-2.8-.9-2.7 1.1-1.9-2.2-2.9-.4-.5-2.9-2.3-1.8 1.1-2.7-.6-2.8 2.5-1.4 1.1-2.8 2.9.3z" />
        <path d="M8.2 12.3l2.5 2.5 5.1-5.3" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label && <span className="sr-only">Verificado</span>}
    </span>
  );
}

/** Emblema del nivel de perfil (desde Racimo). `full` muestra el nombre; si no, solo el ícono. */
export function TierEmblem({ tier, full = false, className = "" }: { tier: number | null | undefined; full?: boolean; className?: string }) {
  if (!tier || tier < 2) return null;
  const t = tierByIdx(tier), s = TIER_SKIN[t.idx];
  return (
    <span title={`Perfil ${t.name}`} className={`inline-flex shrink-0 items-center gap-1 rounded-full align-middle font-extrabold ${s.chip} ${full ? "h-6 pl-1 pr-2 text-xs" : "size-5 justify-center"} ${className}`}>
      <BrandIcon name={t.icon} weight="fill" aria-hidden className={full ? "size-4" : "size-3.5"} />
      {full ? <span>{t.name}</span> : <span className="sr-only">Perfil {t.name}</span>}
    </span>
  );
}

/** Insignia destacada: ícono y nombre. `label`: "always", "sm" (nombre desde 640 px) o "never" (solo ícono, en espacios chicos). */
export function FeaturedBadge({ f, label = "always", className = "" }: { f: NonNullable<Flair["featured"]>; label?: "always" | "sm" | "never"; className?: string }) {
  const text = label === "always" ? "" : label === "sm" ? "sr-only sm:not-sr-only" : "sr-only";
  return (
    <span title={`Insignia destacada: ${f.label}`} className={`inline-flex min-w-0 shrink items-center gap-1 rounded-full align-middle text-ink ${label === "never" ? "" : "sm:border sm:border-banana/60 sm:bg-banana-soft/70 sm:pr-2"} ${label === "always" ? "h-6 max-w-40 border border-banana/60 bg-banana-soft/70 pl-0.5 pr-2 text-xs font-bold" : "text-xs font-bold sm:h-6 sm:max-w-40 sm:pl-0.5"} ${className}`}>
      <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-ink text-banana"><BrandIcon name={f.icon} className="size-3" /></span>
      <span className={`truncate ${text}`}><span className="sr-only">Insignia: </span>{f.label}</span>
    </span>
  );
}

/**
 * Todo junto, en el orden que se lee: verificado, nivel de perfil, insignia destacada.
 * `size`: "sm" en comentarios y filas (solo íconos), "md" en publicaciones y tarjetas (con el nombre de la insignia).
 */
export function NameFlair({ flair, size = "md", className = "" }: { flair: Flair | null | undefined; size?: "sm" | "md"; className?: string }) {
  if (!flair || (!flair.verified && !(flair.tier && flair.tier > 1) && !flair.featured)) return null;
  return (
    <span className={`inline-flex min-w-0 shrink-0 items-center gap-1 ${className}`}>
      {flair.verified && <VerifiedMark className={size === "sm" ? "size-4" : "size-[18px]"} />}
      <TierEmblem tier={flair.tier} />
      {flair.featured && <FeaturedBadge f={flair.featured} label={size === "sm" ? "never" : "sm"} />}
    </span>
  );
}
