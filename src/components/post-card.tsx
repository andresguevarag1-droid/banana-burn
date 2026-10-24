"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Banana, BananaCoin, BananaMedal, BananaTrophy, Barbell, BrandIcon, ChatCircle, Clock, DotsThree, Flag, ForkKnife, Lightning, PaperPlaneTilt, Question, Trash, TrendUp, WarningCircle } from "@/components/icons";
import { Avatar, LevelBadge } from "@/components/community/avatar";
import { NameFlair } from "@/components/community/flair";
import { TesterBadge } from "@/components/testers/tester-badge";
import { addComment, deleteComment, deletePost, getComments, report, toggleKudo, type ReportReason } from "@/app/actions/community";
import { fmtDuration, fmtNum, fmtVolume, tagDef, timeAgo } from "@/lib/community-view";
import type { Author, FeedComment, FeedPost } from "@/lib/community";

const profileHref = (a: Author) => (a.username ? `/app/comunidad/u/${a.username}` : null);
const TAG_ICON = { entreno: Barbell, logro: BananaMedal, pregunta: Question, comida: ForkKnife, progreso: TrendUp } as const;
const TAG_SKIN: Record<string, string> = { entreno: "bg-ink text-white", logro: "bg-banana text-ink", pregunta: "bg-sky/10 text-sky", comida: "bg-peel/10 text-peel", progreso: "bg-ember/10 text-ember-ink" };

const REASONS: [ReportReason, string][] = [["spam", "Spam"], ["acoso", "Acoso"], ["contenido_inapropiado", "Inapropiado"], ["desinformacion_salud", "Info de salud falsa"], ["otro", "Otro"]];

/** Tiempo relativo que se actualiza solo (y no rompe la hidratación: el primer render usa el del servidor). */
function Ago({ iso }: { iso: string }) {
  const [label, setLabel] = useState(() => timeAgo(iso));
  useEffect(() => { setLabel(timeAgo(iso)); const t = setInterval(() => setLabel(timeAgo(iso)), 60_000); return () => clearInterval(t); }, [iso]);
  return <time dateTime={iso} title={new Date(iso).toLocaleString("es-419", { dateStyle: "medium", timeStyle: "short" })} suppressHydrationWarning>{label}</time>;
}

function ReportChips({ onPick, onCancel, label }: { onPick: (r: ReportReason) => void; onCancel: () => void; label: string }) {
  return (
    <div className="rounded-2xl bg-cream p-3 animate-fade" role="group" aria-label={label} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}>
      <p className="text-sm font-bold text-ink">¿Por qué lo reportas?</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {REASONS.map(([k, l]) => <button key={k} type="button" onClick={() => onPick(k)} className="chip pressable h-11 px-4 bg-white border border-line text-ink hover:border-ink">{l}</button>)}
        <button type="button" onClick={onCancel} className="tap h-11 px-3 text-sm font-semibold text-muted underline hover:text-ink">Cancelar</button>
      </div>
    </div>
  );
}

function Comment({ c, onDeleted }: { c: FeedComment; onDeleted: (id: string) => void }) {
  const [menu, setMenu] = useState<"closed" | "open" | "report" | "confirm">("closed");
  const [state, setState] = useState<"idle" | "reported" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const temp = c.id.startsWith("tmp-");
  const href = profileHref(c.author);
  return (
    <li className="group">
      <div className="flex items-start gap-2">
        <Avatar name={c.author.name} size="sm" xp={c.author.xp} className="mt-1.5" />
        <div className="flex-1 min-w-0 rounded-2xl rounded-tl-md bg-cream px-3 py-2">
          <p className="text-sm break-words">
            {href ? <Link href={href} className="font-bold text-ink hover:underline">{c.author.name}</Link> : <b className="text-ink">{c.author.name}</b>}
            {c.author.tester && <TesterBadge compact className="ml-1.5" />}
            <NameFlair flair={c.author.flair} size="sm" className="ml-1 align-[-3px]" />
            <span className="ml-1.5 inline-block whitespace-nowrap text-xs text-faint"><Ago iso={c.at} /></span>
          </p>
          <p className="text-sm text-body break-words">{c.body}</p>
        </div>
        {!temp && state !== "reported" && (
          <button type="button" onClick={() => setMenu((m) => (m === "closed" ? "open" : "closed"))} aria-expanded={menu !== "closed"} aria-label={`Opciones del comentario de ${c.author.name}`} className="tap pressable grid place-items-center size-11 shrink-0 rounded-full text-faint hover:bg-cream hover:text-ink">
            <DotsThree weight="bold" className="size-5" />
          </button>
        )}
      </div>
      {menu === "open" && (
        <div className="mt-1 ml-10 flex flex-wrap gap-2 animate-fade">
          {c.mine
            ? <button type="button" onClick={() => setMenu("confirm")} className="chip pressable h-11 px-4 bg-white border border-line text-bad"><Trash weight="duotone" className="size-4" />Borrar comentario</button>
            : <button type="button" onClick={() => setMenu("report")} className="chip pressable h-11 px-4 bg-white border border-line text-ink"><Flag weight="duotone" className="size-4" />Reportar comentario</button>}
        </div>
      )}
      {menu === "confirm" && (
        <div className="mt-1 ml-10 flex flex-wrap items-center gap-2 text-sm animate-fade" role="group" aria-label="Confirmar borrado">
          <span className="font-semibold text-ink">¿Borrar tu comentario?</span>
          <button type="button" disabled={pending} onClick={() => start(async () => {
            const r = await deleteComment(c.id).catch(() => ({ ok: false, error: "Sin conexión. Intenta de nuevo." }));
            if (r.ok) onDeleted(c.id); else { setMsg(r.error ?? "No pudimos borrar el comentario."); setState("error"); setMenu("closed"); }
          })} className="tap h-11 px-3 font-bold text-bad underline">{pending ? "Borrando…" : "Sí, borrar"}</button>
          <button type="button" onClick={() => setMenu("closed")} className="tap h-11 px-3 font-bold text-ink underline">No</button>
        </div>
      )}
      {menu === "report" && <div className="mt-1 ml-10"><ReportChips label="Motivo del reporte del comentario" onCancel={() => setMenu("closed")} onPick={(k) => { setMenu("closed"); setState("reported"); start(async () => { const r = await report("comment", c.id, k).catch(() => ({ ok: false, error: "Sin conexión." })); if (!r.ok) { setState("error"); setMsg(r.error ?? "No pudimos enviar el reporte."); } }); }} /></div>}
      {state === "reported" && <p className="mt-1 ml-10 text-xs font-semibold text-peel" role="status">Gracias, lo revisaremos.</p>}
      {state === "error" && msg && <p className="mt-1 ml-10 text-xs font-semibold text-bad" role="alert">{msg}</p>}
    </li>
  );
}

/** Tarjeta de entreno: título, cifras (duración, series, volumen, XP), ejercicios y récords. Solo lo que viene en los datos. */
function WorkoutCard({ d }: { d: FeedPost["data"] }) {
  const stats = ([
    ["Duración", fmtDuration(d.mins), Clock],
    ["Series", d.sets ? fmtNum(d.sets) : null, Barbell],
    ["Volumen", fmtVolume(d.volume), Lightning],
    ["XP", d.xp && d.xp > 0 ? `+${fmtNum(d.xp)}` : null, BananaCoin],
  ] as const).filter((x) => x[1] !== null);
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-ink/10 bg-ink text-white">
      <div className="relative flex items-center gap-3 px-4 pt-4">
        <span className="grid place-items-center size-11 shrink-0 rounded-2xl bg-banana text-ink"><BrandIcon name={d.icon ?? "barbell"} className="size-6" /></span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white/60">Entreno completado</p>
          <p className="text-lg font-extrabold leading-tight truncate">{d.title ?? "Entreno"}</p>
        </div>
        <Banana aria-hidden weight="fill" className="pointer-events-none absolute -right-3 -top-2 size-20 text-banana/10 rotate-12" />
      </div>
      {stats.length > 0 && (
        <dl className={`mt-3 grid gap-px bg-white/10 border-y border-white/10 ${stats.length >= 4 ? "grid-cols-4" : stats.length === 3 ? "grid-cols-3" : stats.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
          {stats.map(([k, val, Icon]) => (
            <div key={k} className="bg-ink px-2 py-2.5 text-center">
              <dt className="flex items-center justify-center gap-1 text-[11px] font-semibold text-white/60"><Icon weight="duotone" className="size-3.5" />{k}</dt>
              <dd className={`mt-0.5 text-[15px] leading-tight font-extrabold tabular-nums ${k === "XP" ? "text-banana" : ""}`}>{val}</dd>
            </div>
          ))}
        </dl>
      )}
      {d.ex && d.ex.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 px-4 pt-3" aria-label="Ejercicios">
          {d.ex.slice(0, 6).map((e) => <li key={e} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/85">{e}</li>)}
        </ul>
      )}
      {d.prs && d.prs.length > 0 ? (
        <p className="m-3 flex items-center gap-2 rounded-xl bg-banana px-3 py-2 text-sm font-extrabold text-ink"><BananaTrophy className="size-5 shrink-0" /><span className="min-w-0">{d.prs.length === 1 ? "Récord personal" : `${d.prs.length} récords personales`}: {d.prs.join(", ")}</span></p>
      ) : <div className="h-3" />}
    </div>
  );
}

/** Banana (kudos) optimista con salto y tres bananitas. */
function KudoButton({ on, count, onPress }: { on: boolean; count: number; onPress: () => void }) {
  const [burst, setBurst] = useState(0);
  return (
    <button type="button" onClick={() => { if (!on) setBurst((b) => b + 1); onPress(); }}
      className={`tap pressable relative flex items-center gap-1.5 h-11 px-3.5 rounded-full font-bold text-sm ${on ? "bg-banana text-ink shadow-[0_4px_12px_-6px_rgb(138_98_0/.5)]" : "text-muted hover:bg-banana-soft hover:text-ink"}`}
      aria-pressed={on} aria-label={`${on ? "Quitar" : "Dar"} banana. ${count} ${count === 1 ? "banana" : "bananas"}`}>
      <span className="relative grid place-items-center">
        <Banana key={`b${burst}`} weight={on ? "fill" : "duotone"} className={`size-5 ${on ? "text-ink" : "text-banana-ink"} ${burst ? "bb-kudo-pop" : ""}`} />
        {burst > 0 && on && <span key={`s${burst}`} aria-hidden className="bb-kudo-burst"><i><Banana weight="fill" className="size-3" /></i><i><Banana weight="fill" className="size-3" /></i><i><Banana weight="fill" className="size-3" /></i></span>}
      </span>
      <span className="hidden sm:inline">{on ? "Banana dada" : "Dar banana"}</span>
      <span key={count} className="bb-count-in tabular-nums">{fmtNum(count)}</span>
    </button>
  );
}

export function PostCard({ p, me, onDeleted }: { p: FeedPost; me: string; onDeleted?: (id: string) => void }) {
  const [kudo, setKudo] = useState(p.iKudo);
  const [count, setCount] = useState(p.kudos);
  const [comments, setComments] = useState<FeedComment[]>(p.comments);
  const [total, setTotal] = useState(p.commentCount);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [reported, setReported] = useState(false);
  const [openReport, setOpenReport] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [pending, start] = useTransition();
  const [, startKudo] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const cid = useId();
  if (gone) return null;
  const d = p.data;
  const href = profileHref(p.author);
  const tag = p.kind === "text" ? tagDef(d.tag) : null;
  const TagIcon = tag ? TAG_ICON[tag.id] : null;

  function banana() {
    const on = !kudo;
    setErr(null);
    setKudo(on); setCount((c) => c + (on ? 1 : -1));
    if (on) { try { navigator.vibrate?.(12); } catch { /* sin vibración */ } }
    startKudo(async () => {
      const r = await toggleKudo(p.id, on).catch(() => ({ ok: false, error: "Sin conexión. Intenta de nuevo." }));
      if (!r.ok) { setKudo(!on); setCount((c) => c + (on ? -1 : 1)); setErr(r.error ?? "No pudimos guardar tu banana."); }
    });
  }
  function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || pending) return;
    setErr(null);
    const tmp = `tmp-${Date.now()}`;
    setComments((c) => [...c, { id: tmp, author: { id: "me", username: null, name: me }, body, at: new Date().toISOString(), mine: true }]);
    setTotal((n) => n + 1);
    setText("");
    start(async () => {
      const r = await addComment(p.id, body).catch(() => ({ ok: false, error: "Sin conexión. Intenta de nuevo.", id: undefined }));
      if (r.ok && r.id) setComments((c) => c.map((x) => (x.id === tmp ? { ...x, id: r.id! } : x)));
      else {
        setComments((c) => c.filter((x) => x.id !== tmp)); setTotal((n) => n - 1);
        setText(body); setErr(r.error ?? "No pudimos enviar tu comentario."); input.current?.focus();
      }
    });
  }
  function removePost() {
    setErr(null);
    start(async () => {
      const r = await deletePost(p.id).catch(() => ({ ok: false, error: "Sin conexión. Intenta de nuevo." }));
      if (r.ok) { setGone(true); onDeleted?.(p.id); } else { setConfirmDel(false); setErr(r.error ?? "No pudimos borrar la publicación."); }
    });
  }
  async function showAll() {
    setLoadingAll(true);
    const r = await getComments(p.id).catch(() => null);
    setLoadingAll(false);
    if (r?.ok) { setComments(r.comments); setTotal(r.comments.length); setOpen(true); } else setErr("No pudimos cargar los comentarios. Intenta de nuevo.");
  }

  const hidden = Math.max(0, total - comments.length);

  return (
    <article className="card overflow-hidden animate-enter" aria-label={`Publicación de ${p.author.name}`}>
      <header className="flex items-center gap-3 p-4 pb-0">
        {href ? <Link href={href} className="rounded-full" tabIndex={-1} aria-hidden><Avatar name={p.author.name} xp={p.author.xp} /></Link> : <Avatar name={p.author.name} xp={p.author.xp} />}
        <div className="flex-1 min-w-0">
          {/* flex-wrap: con insignia y nivel, un nombre corto ("Carla Mora") quedaba en "Carla M…"; ahora las insignias bajan. */}
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
            <span className="max-w-full font-bold text-ink truncate">{href ? <Link href={href} className="hover:underline">{p.author.name}</Link> : p.author.name}</span>
            <NameFlair flair={p.author.flair} className="shrink-0" />
            <LevelBadge xp={p.author.xp} compact className={`shrink-0 ${(p.author.flair?.tier && p.author.flair.tier > 1) || p.author.tester ? "max-[419px]:hidden" : ""}`} />
            {p.author.tester && <TesterBadge compact />}
          </p>
          <p className="text-xs text-muted truncate">{p.author.username && <span>@{p.author.username} </span>}<Ago iso={p.at} /></p>
        </div>
        {p.mine ? (
          <button onClick={() => setConfirmDel((o) => !o)} aria-expanded={confirmDel} className="tap pressable grid place-items-center size-11 rounded-full text-faint hover:bg-cream hover:text-ink" aria-label="Borrar publicación"><Trash weight="duotone" className="size-4" /></button>
        ) : (
          <button disabled={reported} onClick={() => setOpenReport((o) => !o)} aria-expanded={openReport} aria-controls={`report-${p.id}`} className="tap pressable grid place-items-center size-11 rounded-full text-faint hover:bg-cream hover:text-ink disabled:text-peel" aria-label={reported ? "Reportado" : "Reportar publicación"}><Flag weight="duotone" className="size-4" /></button>
        )}
      </header>

      {confirmDel && (
        <div className="mx-4 mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-bad/5 border border-bad/20 p-3 text-sm animate-fade" role="group" aria-label="Confirmar borrado">
          <span className="flex-1 min-w-0 font-semibold text-ink">¿Borrar esta publicación? Se borran también sus bananas y comentarios.</span>
          <button type="button" onClick={() => setConfirmDel(false)} className="btn-ghost h-11 px-4 text-sm">Cancelar</button>
          <button type="button" onClick={removePost} disabled={pending} className="btn h-11 px-4 text-sm bg-bad text-white">{pending ? "Borrando…" : "Borrar"}</button>
        </div>
      )}
      {openReport && !reported && (
        <div id={`report-${p.id}`} className="mx-4 mt-2">
          <ReportChips label="Motivo del reporte" onCancel={() => setOpenReport(false)} onPick={(k) => { setReported(true); setOpenReport(false); start(async () => { const r = await report("post", p.id, k).catch(() => ({ ok: false, error: "Sin conexión." })); if (!r.ok) { setReported(false); setErr(r.error ?? "No pudimos enviar el reporte."); } }); }} />
        </div>
      )}
      {reported && <p className="mx-4 mt-2 text-xs font-semibold text-peel" role="status">Gracias, lo revisaremos.</p>}

      <div className="px-4 pt-3">
        {tag && TagIcon && <p className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 h-7 text-xs font-bold ${TAG_SKIN[tag.id]}`}><TagIcon weight="duotone" className="size-4" />{tag.label}</p>}
        {p.body && <p className={`${p.kind === "text" ? "text-[17px] leading-relaxed" : "text-[15px]"} text-body whitespace-pre-line break-words`}>{p.body}</p>}
        {p.kind === "workout" && <WorkoutCard d={d} />}
        {p.kind === "pr" && d.prs && d.prs.length > 0 && <p className="mt-2 flex items-center gap-2 rounded-xl bg-banana px-3 py-2 text-sm font-extrabold text-ink"><BananaTrophy className="size-5 shrink-0" />Récord en {d.prs.join(", ")}</p>}
        {p.kind === "challenge" && (
          <div className="mt-1 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-banana to-banana-soft p-4 text-ink">
            <span className="grid place-items-center size-12 shrink-0 rounded-2xl bg-ink text-banana"><BananaMedal weight="fill" className="size-7" /></span>
            <div className="min-w-0"><p className="text-xs font-bold text-ink/70">Medalla desbloqueada</p><p className="font-extrabold leading-tight">{d.title ?? "Completó un reto"}</p></div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 px-2 py-2 mt-3 border-t border-line">
        <KudoButton on={kudo} count={count} onPress={banana} />
        <button onClick={() => { setOpen((o) => !o); if (!open) setTimeout(() => input.current?.focus(), 0); }} className="tap pressable flex items-center gap-1.5 h-11 px-3.5 rounded-full font-bold text-sm text-muted hover:bg-cream hover:text-ink" aria-expanded={open} aria-controls={cid} aria-label={`${total} ${total === 1 ? "comentario" : "comentarios"}. ${open ? "Ocultar caja de comentario" : "Comentar"}`}>
          <ChatCircle weight="duotone" className="size-5" /><span className="hidden sm:inline">Comentar</span><span className="tabular-nums">{fmtNum(total)}</span>
        </button>
      </div>

      {err && <p role="alert" className="mx-4 mb-2 flex items-center gap-1.5 text-xs font-semibold text-bad"><WarningCircle weight="fill" className="size-4 shrink-0" />{err}</p>}

      {(open || comments.length > 0) && (
        <div id={cid} className="px-4 pb-4 space-y-2">
          {hidden > 0 && <button type="button" onClick={showAll} disabled={loadingAll} className="tap h-11 text-sm font-bold text-muted hover:text-ink">{loadingAll ? "Cargando…" : `Ver los ${fmtNum(total)} comentarios`}</button>}
          {comments.length > 0 && <ul aria-label="Comentarios" className="space-y-2">{comments.map((c) => <Comment key={c.id} c={c} onDeleted={(id) => { setComments((xs) => xs.filter((x) => x.id !== id)); setTotal((n) => Math.max(0, n - 1)); }} />)}</ul>}
          {open && (
            <form onSubmit={send} className="flex gap-2 pt-1">
              <input ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Escribe algo motivador…" className="input h-11 rounded-full text-[16px] sm:text-sm" aria-label="Comentario" enterKeyHint="send" />
              <button className="tap pressable grid place-items-center size-11 shrink-0 rounded-full bg-banana text-ink hover:brightness-95 disabled:opacity-40" disabled={!text.trim() || pending} aria-label="Enviar comentario"><PaperPlaneTilt weight="fill" className="size-4" /></button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}
