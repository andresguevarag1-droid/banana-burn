"use client";
import { useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Banana, BananaMedal, BananaTrophy, BrandIcon, ChatCircle, DotsThree, Flag, PaperPlaneTilt, Trash, WarningCircle } from "@/components/icons";
import { addComment, deleteComment, deletePost, getComments, report, toggleKudo, type ReportReason } from "@/app/actions/community";
import type { Author, FeedComment, FeedPost } from "@/lib/community";

function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}
const Avatar = ({ name }: { name: string }) => <span className="grid place-items-center size-10 shrink-0 rounded-full bg-banana font-extrabold text-ink" aria-hidden>{name[0]?.toUpperCase()}</span>;
const profileHref = (a: Author) => (a.username ? `/app/comunidad/u/${a.username}` : null);

const REASONS: [ReportReason, string][] = [["spam", "Spam"], ["acoso", "Acoso"], ["contenido_inapropiado", "Inapropiado"], ["desinformacion_salud", "Info de salud falsa"], ["otro", "Otro"]];

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
        <p className="flex-1 min-w-0 text-sm py-1.5 break-words">
          {href ? <Link href={href} className="font-bold text-ink hover:underline">{c.author.name}</Link> : <b className="text-ink">{c.author.name}</b>} <span className="text-body">{c.body}</span>
        </p>
        {!temp && state !== "reported" && (
          <button type="button" onClick={() => setMenu((m) => (m === "closed" ? "open" : "closed"))} aria-expanded={menu !== "closed"} aria-label={`Opciones del comentario de ${c.author.name}`} className="tap pressable grid place-items-center size-11 -my-1.5 shrink-0 rounded-full text-faint hover:bg-cream hover:text-ink">
            <DotsThree weight="bold" className="size-5" />
          </button>
        )}
      </div>
      {menu === "open" && (
        <div className="mb-2 flex flex-wrap gap-2 animate-fade">
          {c.mine
            ? <button type="button" onClick={() => setMenu("confirm")} className="chip pressable h-11 px-4 bg-white border border-line text-bad"><Trash weight="duotone" className="size-4" />Borrar comentario</button>
            : <button type="button" onClick={() => setMenu("report")} className="chip pressable h-11 px-4 bg-white border border-line text-ink"><Flag weight="duotone" className="size-4" />Reportar comentario</button>}
        </div>
      )}
      {menu === "confirm" && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm animate-fade" role="group" aria-label="Confirmar borrado">
          <span className="font-semibold text-ink">¿Borrar tu comentario?</span>
          <button type="button" disabled={pending} onClick={() => start(async () => {
            const r = await deleteComment(c.id).catch(() => ({ ok: false, error: "Sin conexión. Intenta de nuevo." }));
            if (r.ok) onDeleted(c.id); else { setMsg(r.error ?? "No pudimos borrar el comentario."); setState("error"); setMenu("closed"); }
          })} className="tap h-11 px-3 font-bold text-bad underline">{pending ? "Borrando…" : "Sí, borrar"}</button>
          <button type="button" onClick={() => setMenu("closed")} className="tap h-11 px-3 font-bold text-ink underline">No</button>
        </div>
      )}
      {menu === "report" && <div className="mb-2"><ReportChips label="Motivo del reporte del comentario" onCancel={() => setMenu("closed")} onPick={(k) => { setMenu("closed"); setState("reported"); start(async () => { const r = await report("comment", c.id, k).catch(() => ({ ok: false, error: "Sin conexión." })); if (!r.ok) { setState("error"); setMsg(r.error ?? "No pudimos enviar el reporte."); } }); }} /></div>}
      {state === "reported" && <p className="mb-2 text-xs font-semibold text-peel" role="status">Gracias, lo revisaremos.</p>}
      {state === "error" && msg && <p className="mb-2 text-xs font-semibold text-bad" role="alert">{msg}</p>}
    </li>
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
  const [pop, setPop] = useState(false);
  const [openReport, setOpenReport] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const cid = useId();
  if (gone) return null;
  const d = p.data;
  const href = profileHref(p.author);

  function banana() {
    const on = !kudo;
    setErr(null);
    setKudo(on); setCount((c) => c + (on ? 1 : -1));
    if (on) { setPop(true); setTimeout(() => setPop(false), 300); try { navigator.vibrate?.(15); } catch { /* */ } }
    start(async () => {
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

  const raw: [string, string | null][] = p.kind === "workout" ? [
    ["Tiempo", d.mins ? `${d.mins} min` : null],
    ["Series", d.sets ? String(d.sets) : null],
    ["Volumen", d.volume ? `${(d.volume / 1000).toLocaleString("es-419", { maximumFractionDigits: 1 })} t` : null],
  ] : [];
  const stats = raw.filter((x): x is [string, string] => x[1] !== null);
  const hidden = Math.max(0, total - comments.length);

  return (
    <article className="card overflow-hidden">
      <header className="flex items-center gap-3 p-4 pb-2">
        {href ? <Link href={href} className="rounded-full" tabIndex={-1} aria-hidden><Avatar name={p.author.name} /></Link> : <Avatar name={p.author.name} />}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink truncate">{href ? <Link href={href} className="hover:underline">{p.author.name}</Link> : p.author.name}{p.author.username && <span className="font-semibold text-faint"> @{p.author.username}</span>}</p>
          <p className="text-xs text-muted"><time dateTime={p.at}>{timeAgo(p.at)}</time></p>
        </div>
        {p.mine ? (
          <button onClick={() => setConfirmDel((o) => !o)} aria-expanded={confirmDel} className="tap pressable grid place-items-center size-11 rounded-full text-faint hover:bg-cream hover:text-ink" aria-label="Borrar publicación"><Trash weight="duotone" className="size-4" /></button>
        ) : (
          <button disabled={reported} onClick={() => setOpenReport((o) => !o)} aria-expanded={openReport} aria-controls={`report-${p.id}`} className="tap pressable grid place-items-center size-11 rounded-full text-faint hover:bg-cream hover:text-ink disabled:text-peel" aria-label={reported ? "Reportado" : "Reportar publicación"}><Flag weight="duotone" className="size-4" /></button>
        )}
      </header>

      {confirmDel && (
        <div className="mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-2xl bg-bad/5 border border-bad/20 p-3 text-sm animate-fade" role="group" aria-label="Confirmar borrado">
          <span className="flex-1 min-w-0 font-semibold text-ink">¿Borrar esta publicación? Se borran también sus bananas y comentarios.</span>
          <button type="button" onClick={() => setConfirmDel(false)} className="btn-ghost h-11 px-4 text-sm">Cancelar</button>
          <button type="button" onClick={removePost} disabled={pending} className="btn h-11 px-4 text-sm bg-bad text-white">{pending ? "Borrando…" : "Borrar"}</button>
        </div>
      )}
      {openReport && !reported && (
        <div id={`report-${p.id}`} className="mx-4 mb-2">
          <ReportChips label="Motivo del reporte" onCancel={() => setOpenReport(false)} onPick={(k) => { setReported(true); setOpenReport(false); start(async () => { const r = await report("post", p.id, k).catch(() => ({ ok: false, error: "Sin conexión." })); if (!r.ok) { setReported(false); setErr(r.error ?? "No pudimos enviar el reporte."); } }); }} />
        </div>
      )}
      {reported && <p className="mx-4 mb-2 text-xs font-semibold text-peel" role="status">Gracias, lo revisaremos.</p>}

      <div className="px-4">
        {p.kind !== "text" && <p className="flex items-center gap-2.5 text-lg font-extrabold text-ink"><span className="grid place-items-center size-9 shrink-0 rounded-xl bg-banana-soft text-banana-ink"><BrandIcon name={d.icon ?? (p.kind === "challenge" ? "medal" : p.kind === "pr" ? "trophy" : "barbell")} className="size-5" /></span><span className="min-w-0">{d.title ?? (p.kind === "workout" ? "Entreno" : "")}</span></p>}
        {p.body && <p className={`${p.kind === "text" ? "text-base" : "mt-1 text-[15px]"} text-body whitespace-pre-line break-words`}>{p.body}</p>}
        {stats.length > 0 && (
          <dl className={`mt-3 grid gap-2 rounded-2xl bg-cream p-3 text-center ${stats.length === 3 ? "grid-cols-3" : stats.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
            {stats.map(([k, val]) => <div key={k}><dt className="text-[11px] font-semibold text-muted">{k}</dt><dd className="font-extrabold text-ink tabular-nums">{val}</dd></div>)}
          </dl>
        )}
        {d.prs && d.prs.length > 0 && <p className="mt-2 flex items-center gap-2 rounded-xl bg-banana-soft px-3 py-2 text-sm font-bold text-banana-ink"><BananaTrophy className="size-5 shrink-0" />Récord en {d.prs.join(", ")}</p>}
        {p.kind === "challenge" && <p className="mt-2 flex items-center gap-2 rounded-xl bg-peel/10 px-3 py-2 text-sm font-bold text-peel"><BananaMedal className="size-5 shrink-0" />Medalla desbloqueada</p>}
      </div>

      <div className="flex items-center gap-1 px-2 py-2 mt-2 border-t border-line">
        <button onClick={banana} className={`tap pressable flex items-center gap-1.5 h-11 px-3 rounded-full font-bold text-sm ${kudo ? "bg-banana text-ink" : "text-muted hover:bg-cream"}`} aria-pressed={kudo} aria-label={`${kudo ? "Quitar" : "Dar"} banana. ${count} ${count === 1 ? "banana" : "bananas"}`}>
          <Banana weight={kudo ? "fill" : "duotone"} className={`size-5 transition-transform duration-200 ease-out motion-reduce:transition-none ${kudo ? "text-ink" : "text-banana-ink"} ${pop ? "scale-125" : ""}`} /><span className="hidden sm:inline">Dar banana</span><span className="tabular-nums">{count}</span>
        </button>
        <button onClick={() => { setOpen((o) => !o); if (!open) setTimeout(() => input.current?.focus(), 0); }} className="tap pressable flex items-center gap-1.5 h-11 px-3 rounded-full font-bold text-sm text-muted hover:bg-cream" aria-expanded={open} aria-controls={cid} aria-label={`${total} ${total === 1 ? "comentario" : "comentarios"}. ${open ? "Ocultar caja de comentario" : "Comentar"}`}>
          <ChatCircle weight="duotone" className="size-4" /><span className="tabular-nums">{total}</span>
        </button>
      </div>

      {err && <p role="alert" className="mx-4 mb-2 flex items-center gap-1.5 text-xs font-semibold text-bad"><WarningCircle weight="fill" className="size-4 shrink-0" />{err}</p>}

      {(open || comments.length > 0) && (
        <div id={cid} className="px-4 pb-4">
          {hidden > 0 && <button type="button" onClick={showAll} disabled={loadingAll} className="tap h-11 text-sm font-bold text-muted hover:text-ink">{loadingAll ? "Cargando…" : `Ver los ${total} comentarios`}</button>}
          {comments.length > 0 && <ul aria-label="Comentarios">{comments.map((c) => <Comment key={c.id} c={c} onDeleted={(id) => { setComments((xs) => xs.filter((x) => x.id !== id)); setTotal((n) => Math.max(0, n - 1)); }} />)}</ul>}
          {open && (
            <form onSubmit={send} className="flex gap-2 pt-1">
              <input ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Escribe algo motivador…" className="input h-11 text-[16px] sm:text-sm" aria-label="Comentario" enterKeyHint="send" />
              <button className="tap pressable grid place-items-center size-11 shrink-0 rounded-full bg-ink text-white hover:bg-black disabled:opacity-30" disabled={!text.trim() || pending} aria-label="Enviar comentario"><PaperPlaneTilt weight="fill" className="size-4" /></button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}
