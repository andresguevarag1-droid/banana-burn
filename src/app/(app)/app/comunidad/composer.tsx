"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PaperPlaneTilt, WarningCircle } from "@/components/icons";
import { createPost } from "@/app/actions/community";
import { PostCard } from "@/components/post-card";
import type { FeedPost } from "@/lib/community";

const MAX = 500;

/** Compositor de publicaciones de texto + publicaciones recién creadas (antes de que el feed se recargue). */
export function Composer({ me, visibility, suspended, feedIds = [] }: { me: string; visibility: string; suspended: boolean; feedIds?: string[] }) {
  const [text, setText] = useState("");
  const [vis, setVis] = useState<"publico" | "seguidores">(visibility === "publico" ? "publico" : "seguidores");
  const [err, setErr] = useState<string | null>(null);
  const [mine, setMine] = useState<FeedPost[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  const left = MAX - text.length;

  if (suspended) return <p className="card p-4 text-sm text-muted">Tu cuenta no puede publicar ni comentar por ahora. Si crees que es un error, escríbenos a <a className="font-bold underline" href="mailto:hola@bananaburn.app">hola@bananaburn.app</a>.</p>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || pending) return;
    setErr(null);
    start(async () => {
      const r = await createPost(body, vis).catch(() => ({ ok: false, error: "Sin conexión. Intenta de nuevo.", post: undefined }));
      if (r.ok && r.post) { setMine((m) => [r.post!, ...m]); setText(""); router.refresh(); }
      else setErr(r.error ?? "No pudimos publicar. Intenta de nuevo.");
    });
  }

  return (
    <>
      <form onSubmit={submit} className="card p-4 space-y-3" aria-label="Nueva publicación">
        <label htmlFor="nuevo-post" className="sr-only">¿Cómo te fue hoy?</label>
        <textarea id="nuevo-post" value={text} onChange={(e) => setText(e.target.value.slice(0, MAX))} rows={2} maxLength={MAX} placeholder="¿Cómo te fue hoy? Comparte un logro, una duda o una victoria pequeña." className="input h-auto min-h-20 py-3 resize-y text-[16px] sm:text-[15px]" aria-describedby="nuevo-post-ayuda" />
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-muted" htmlFor="nuevo-post-vis">Lo ven</label>
          <select id="nuevo-post-vis" value={vis} onChange={(e) => setVis(e.target.value as typeof vis)} className="input h-11 w-auto py-0 text-[16px] sm:text-sm">
            <option value="seguidores">Mis seguidores</option>
            <option value="publico">Todos en Banana Burn</option>
          </select>
          <span id="nuevo-post-ayuda" className={`ml-auto text-xs tabular-nums ${left < 40 ? "text-ember-ink font-bold" : "text-faint"}`}>{left} caracteres</span>
          <button disabled={!text.trim() || pending} className="btn-primary h-11 px-5 text-sm"><PaperPlaneTilt weight="fill" className="size-4" />{pending ? "Publicando…" : "Publicar"}</button>
        </div>
        {err && <p role="alert" className="flex items-center gap-1.5 text-sm font-semibold text-bad"><WarningCircle weight="fill" className="size-4 shrink-0" />{err}</p>}
      </form>
      {mine.filter((p) => !feedIds.includes(p.id)).map((p) => <PostCard key={p.id} p={p} me={me} onDeleted={(id) => setMine((m) => m.filter((x) => x.id !== id))} />)}
    </>
  );
}
