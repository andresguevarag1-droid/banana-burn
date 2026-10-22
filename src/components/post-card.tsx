"use client";
import { useState, useTransition } from "react";
import { Flag, MessageCircle, Send, Trash2 } from "lucide-react";
import { addComment, deletePost, report, toggleKudo } from "@/app/actions/community";
import type { FeedPost } from "@/lib/community";

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

export function PostCard({ p, me }: { p: FeedPost; me: string }) {
  const [kudo, setKudo] = useState(p.iKudo);
  const [count, setCount] = useState(p.kudos);
  const [comments, setComments] = useState(p.comments);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const [reported, setReported] = useState(false);
  const [pop, setPop] = useState(false);
  const [, start] = useTransition();
  if (gone) return null;
  const d = p.data;

  function banana() {
    const on = !kudo;
    setKudo(on); setCount((c) => c + (on ? 1 : -1));
    if (on) { setPop(true); setTimeout(() => setPop(false), 450); try { navigator.vibrate?.(15); } catch { /* */ } }
    start(() => { toggleKudo(p.id, on); });
  }
  function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setComments((c) => [...c, { id: `tmp-${Date.now()}`, author: { id: "me", username: null, name: me }, body, at: new Date().toISOString() }]);
    setText("");
    start(() => { addComment(p.id, body); });
  }

  return (
    <article className="card overflow-hidden">
      <header className="flex items-center gap-3 p-4 pb-2">
        <Avatar name={p.author.name} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink truncate">{p.author.name}{p.author.username && <span className="font-semibold text-faint"> @{p.author.username}</span>}</p>
          <p className="text-xs text-muted"><time dateTime={p.at}>{timeAgo(p.at)}</time></p>
        </div>
        {p.mine ? (
          <button onClick={() => { setGone(true); start(() => { deletePost(p.id); }); }} className="grid place-items-center size-9 rounded-full text-faint hover:bg-cream" aria-label="Borrar publicación"><Trash2 className="size-4" /></button>
        ) : (
          <button disabled={reported} onClick={() => { setReported(true); start(() => { report("post", p.id, "Reportado desde el feed"); }); }} className="grid place-items-center size-9 rounded-full text-faint hover:bg-cream disabled:text-peel" aria-label={reported ? "Reportado" : "Reportar publicación"}><Flag className="size-4" /></button>
        )}
      </header>

      <div className="px-4">
        <p className="text-lg font-extrabold text-ink">{d.emoji} {d.title ?? (p.kind === "workout" ? "Entreno" : "")}</p>
        {p.body && <p className="mt-1 text-[15px] text-body">{p.body}</p>}
        {p.kind === "workout" && (
          <dl className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-cream p-3 text-center">
            <div><dt className="text-[11px] font-semibold text-muted">Tiempo</dt><dd className="font-extrabold text-ink tabular-nums">{d.mins ?? "—"} min</dd></div>
            <div><dt className="text-[11px] font-semibold text-muted">Series</dt><dd className="font-extrabold text-ink tabular-nums">{d.sets ?? "—"}</dd></div>
            <div><dt className="text-[11px] font-semibold text-muted">Volumen</dt><dd className="font-extrabold text-ink tabular-nums">{d.volume ? `${(d.volume / 1000).toLocaleString("es-CR", { maximumFractionDigits: 1 })} t` : "—"}</dd></div>
          </dl>
        )}
        {d.prs && d.prs.length > 0 && <p className="mt-2 rounded-xl bg-banana-soft px-3 py-2 text-sm font-bold text-banana-ink">🏆 Récord en {d.prs.join(", ")}</p>}
        {p.kind === "challenge" && <p className="mt-2 rounded-xl bg-peel/10 px-3 py-2 text-sm font-bold text-peel">🏅 Medalla desbloqueada</p>}
      </div>

      <div className="flex items-center gap-1 px-2 py-2 mt-2 border-t border-line">
        <button onClick={banana} className={`flex items-center gap-1.5 h-10 px-3 rounded-full font-bold text-sm transition ${kudo ? "bg-banana text-ink" : "text-muted hover:bg-cream"}`} aria-pressed={kudo} aria-label={`${kudo ? "Quitar" : "Dar"} banana. ${count} bananas`}>
          <span className={`text-lg transition-transform ${pop ? "scale-150" : ""}`}>🍌</span><span className="tabular-nums">{count}</span>
        </button>
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 h-10 px-3 rounded-full font-bold text-sm text-muted hover:bg-cream" aria-expanded={open}>
          <MessageCircle className="size-4" /><span className="tabular-nums">{Math.max(p.commentCount, comments.length)}</span>
        </button>
      </div>

      {(open || comments.length > 0) && (
        <div className="px-4 pb-4 space-y-2">
          {comments.map((c) => <p key={c.id} className="text-sm"><b className="text-ink">{c.author.name}</b> <span className="text-body">{c.body}</span></p>)}
          {open && (
            <form onSubmit={send} className="flex gap-2 pt-1">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Escribe algo motivador…" className="input h-10 text-sm" aria-label="Comentario" />
              <button className="grid place-items-center size-10 shrink-0 rounded-full bg-ink text-white disabled:opacity-30" disabled={!text.trim()} aria-label="Enviar comentario"><Send className="size-4" /></button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}
