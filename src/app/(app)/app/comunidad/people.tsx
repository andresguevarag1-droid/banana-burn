import Link from "next/link";
import { Lightning, Target } from "@/components/icons";
import { MapPin } from "@/components/community/icons";
import { Avatar, LevelBadge } from "@/components/community/avatar";
import { NameFlair } from "@/components/community/flair";
import { plural } from "@/lib/community-view";
import type { Person } from "@/lib/community";
import { FollowButton } from "./follow";

/** Tarjeta de persona para Descubrir: nivel, bio, en qué se parecen a ti y su actividad real. */
export function PersonCard({ p }: { p: Person }) {
  const href = p.username ? `/app/comunidad/u/${p.username}` : null;
  const tags = [
    p.sameCountry && { k: "pais", l: "Tu país", Icon: MapPin },
    p.sameGoal && { k: "obj", l: "Tu objetivo", Icon: Target },
    p.activeDays > 0 && { k: "act", l: `${plural(p.activeDays, "día activo", "días activos")} en 2 semanas`, Icon: Lightning },
  ].filter(Boolean) as { k: string; l: string; Icon: typeof Target }[];
  return (
    <li className="card flex flex-col p-4">
      <div className="flex items-start gap-3">
        <Avatar name={p.name} xp={p.xp} size="lg" />
        <div className="flex-1 min-w-0">
          {href ? <Link href={href} className="block font-extrabold text-ink truncate hover:underline">{p.name}</Link> : <span className="block font-extrabold text-ink truncate">{p.name}</span>}
          {p.username && <span className="block text-xs text-faint truncate">@{p.username}</span>}
          <span className="mt-1.5 flex flex-wrap items-center gap-1"><LevelBadge xp={p.xp} /><NameFlair flair={p.flair} /></span>
        </div>
      </div>
      {p.bio && <p className="mt-3 text-sm text-body line-clamp-2 break-words">{p.bio}</p>}
      {tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="En qué coinciden">
          {tags.map(({ k, l, Icon }) => <li key={k} className="chip bg-cream text-ink"><Icon weight="duotone" className="size-3.5 text-banana-ink" />{l}</li>)}
        </ul>
      )}
      <div className="mt-auto pt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted tabular-nums">{plural(p.followers, "seguidor", "seguidores")}</span>
        <FollowButton userId={p.id} name={p.name} />
      </div>
    </li>
  );
}

/** Fila compacta (barra lateral y estados vacíos). */
export function PersonRow({ p }: { p: Person }) {
  const href = p.username ? `/app/comunidad/u/${p.username}` : null;
  return (
    <li className="flex items-center gap-3">
      <Avatar name={p.name} xp={p.xp} size="md" />
      <span className="flex-1 min-w-0">
        <span className="flex min-w-0 items-center gap-1">{href ? <Link href={href} className="-my-2.5 block py-2.5 font-bold text-ink truncate hover:underline">{p.name}</Link> : <span className="block font-bold text-ink truncate">{p.name}</span>}<NameFlair flair={p.flair} size="sm" className="shrink-0" /></span>
        <span className="block text-xs text-faint truncate">{p.activeDays > 0 ? plural(p.activeDays, "día activo", "días activos") + " en 2 semanas" : p.username ? `@${p.username}` : ""}</span>
      </span>
      <FollowButton userId={p.id} name={p.name} />
    </li>
  );
}
