"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BananaMedal, Barbell, ForkKnife, Globe, PaperPlaneTilt, Question, TrendUp, Users, WarningCircle } from "@/components/icons";
import { createPost, publishTodayWorkout } from "@/app/actions/community";
import { PostCard } from "@/components/post-card";
import { Avatar } from "@/components/community/avatar";
import { counterState, fmtDuration, fmtNum, fmtVolume, POST_TAGS, type PostTag } from "@/lib/community-view";
import type { FeedPost, TodayWorkout } from "@/lib/community";

const MAX = 500;
const TAG_ICON = { entreno: Barbell, logro: BananaMedal, pregunta: Question, comida: ForkKnife, progreso: TrendUp } as const;
/** Evento para abrir el compositor desde otro lado (p. ej. "Publica tu primer logro"). */
export const COMPOSE_EVENT = "bb:compose";

/** Compositor de la tropa: compacto, se abre al enfocar o al elegir un tipo; publica texto o el entreno de hoy. */
export function Composer({ me, meXp, visibility, suspended, today, feedIds = [] }: { me: string; meXp?: number | null; visibility: string; suspended: boolean; today: TodayWorkout | null; feedIds?: string[] }) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState<PostTag | null>(null);
  const [open, setOpen] = useState(false);
  const [vis, setVis] = useState<"publico" | "seguidores">(visibility === "publico" ? "publico" : "seguidores");
  const [err, setErr] = useState<string | null>(null);
  const [mine, setMine] = useState<FeedPost[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  const area = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const ids = useId();
  const counter = counterState(text.length, MAX);
  const attach = tag === "entreno" && !!today && !today.published;
  const canSend = (text.trim().length > 0 || attach) && !pending;
  const def = POST_TAGS.find((t) => t.id === tag);

  useEffect(() => {
    function onCompose(e: Event) {
      const t = (e as CustomEvent<{ tag?: PostTag }>).detail?.tag ?? null;
      setTag(t); setOpen(true);
      form.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      setTimeout(() => area.current?.focus({ preventScroll: true }), 0);
    }
    window.addEventListener(COMPOSE_EVENT, onCompose);
    return () => window.removeEventListener(COMPOSE_EVENT, onCompose);
  }, []);

  if (suspended) return <p className="card p-4 text-sm text-muted">Tu cuenta no puede publicar ni comentar por ahora. Si crees que es un error, escríbenos a <a className="font-bold underline" href="mailto:hola@bananaburn.app">hola@bananaburn.app</a>.</p>;

  function pick(t: PostTag) {
    setTag((cur) => (cur === t ? null : t));
    setOpen(true);
    setTimeout(() => area.current?.focus(), 0);
  }
  function close() { setOpen(false); setTag(null); setErr(null); area.current?.blur(); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    const body = text.trim();
    setErr(null);
    start(async () => {
      const fail = { ok: false, error: "Sin conexión. Intenta de nuevo.", post: undefined };
      const r = attach ? await publishTodayWorkout(body, vis).catch(() => fail) : await createPost(body, vis, tag).catch(() => fail);
      if (r.ok && r.post) { setMine((m) => [r.post!, ...m]); setText(""); setTag(null); setOpen(false); router.refresh(); }
      else setErr(r.error ?? "No pudimos publicar. Intenta de nuevo.");
    });
  }

  return (
    <>
      <form ref={form} onSubmit={submit} aria-label="Nueva publicación" onKeyDown={(e) => { if (e.key === "Escape" && !text) close(); }}
        onBlur={(e) => { if (!text && !tag && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}
        className={`card p-3 sm:p-4 transition-shadow duration-200 ease-out ${open ? "shadow-lift ring-2 ring-banana/60" : ""}`}>
        <div className="flex items-start gap-3">
          <Avatar name={me} xp={meXp} className="mt-1" />
          <label htmlFor={`${ids}-t`} className="sr-only">{def ? def.chip : "¿Cómo te fue hoy?"}</label>
          <textarea id={`${ids}-t`} ref={area} value={text} onFocus={() => setOpen(true)} onChange={(e) => setText(e.target.value.slice(0, MAX))} rows={open ? 4 : 1} maxLength={MAX}
            placeholder={def?.placeholder ?? (open ? "¿Cómo te fue hoy? Cuéntale a la tropa: un logro, una duda o una victoria pequeña." : "¿Cómo te fue hoy?")} aria-describedby={`${ids}-c`}
            className={`flex-1 min-w-0 resize-none rounded-2xl border border-transparent bg-cream px-4 py-3 text-[16px] sm:text-[15px] text-ink placeholder:text-faint outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-out focus:bg-white focus:border-ink focus:ring-4 focus:ring-banana/40 ${open ? "min-h-28" : "h-12 overflow-hidden"}`} />
        </div>

        <div role="group" aria-label="Tipo de publicación" className="mt-3 flex flex-wrap gap-2">
          {POST_TAGS.map((t) => {
            const Icon = TAG_ICON[t.id];
            const on = tag === t.id;
            return (
              <button key={t.id} type="button" onClick={() => pick(t.id)} aria-pressed={on}
                className={`chip pressable h-11 px-3.5 text-[13px] font-bold border ${on ? "bg-ink text-white border-ink" : "bg-white text-ink border-line hover:border-ink/30"}`}>
                <Icon weight={on ? "fill" : "duotone"} className={`size-4 ${on ? "text-banana" : t.id === "entreno" ? "text-ink" : "text-banana-ink"}`} />{t.chip}
              </button>
            );
          })}
        </div>

        <div className="bb-expand" data-open={open} aria-hidden={!open} inert={!open}>
          <div>
            {tag === "entreno" && (
              today && !today.published ? (
                <div className="mt-3 flex items-center gap-3 rounded-2xl bg-ink p-3 text-white">
                  <span className="grid place-items-center size-10 shrink-0 rounded-xl bg-banana text-ink"><Barbell weight="fill" className="size-5" /></span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white/60">Se adjunta tu entreno de hoy</p>
                    <p className="font-extrabold truncate">{today.title}</p>
                    <p className="text-xs text-white/75 tabular-nums">{[fmtDuration(today.mins), today.sets ? `${fmtNum(today.sets)} series` : null, fmtVolume(today.volume)].filter(Boolean).join(", ")}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 rounded-2xl bg-cream p-3 text-sm text-muted">
                  {today?.published ? "Tu entreno de hoy ya está en el feed. Esto se publica como texto." : <>Todavía no registras un entreno hoy. Se publica como texto, o <Link href="/app/entrenar" className="font-bold text-ink underline">ve a entrenar</Link>.</>}
                </p>
              )
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div role="radiogroup" aria-label="Quién lo ve" className="flex rounded-full bg-cream p-1">
                {([["seguidores", "Mis seguidores", Users], ["publico", "Todos", Globe]] as const).map(([k, l, Icon]) => (
                  <button key={k} type="button" role="radio" aria-checked={vis === k} onClick={() => setVis(k)}
                    className={`tap pressable flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-bold ${vis === k ? "bg-white text-ink shadow-soft" : "text-muted hover:text-ink"}`}>
                    <Icon weight={vis === k ? "fill" : "duotone"} className="size-4" />{l}
                  </button>
                ))}
              </div>
              <span id={`${ids}-c`} aria-live="polite" className={`ml-auto text-xs font-semibold tabular-nums ${counter.show ? (counter.danger ? "text-bad" : "text-ember-ink") : "sr-only"}`}>
                {counter.show ? `Quedan ${fmtNum(counter.left)}` : `Máximo ${MAX} caracteres`}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button type="button" onClick={close} className="btn-ghost h-11 px-4 text-sm">Cancelar</button>
              <button type="submit" disabled={!canSend} className="btn-banana h-11 px-5 text-sm font-extrabold">
                <PaperPlaneTilt weight="fill" className="size-4" />{pending ? "Publicando…" : attach ? "Publicar entreno" : "Publicar"}
              </button>
            </div>
          </div>
        </div>
        {err && <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-bad"><WarningCircle weight="fill" className="size-4 shrink-0" />{err}</p>}
      </form>
      {mine.filter((p) => !feedIds.includes(p.id)).map((p) => <PostCard key={p.id} p={p} me={me} onDeleted={(id) => setMine((m) => m.filter((x) => x.id !== id))} />)}
    </>
  );
}

/** Botón que abre el compositor con un tipo ya elegido. */
export function ComposeTrigger({ tag, className, children }: { tag?: PostTag; className?: string; children: React.ReactNode }) {
  return <button type="button" className={className} onClick={() => window.dispatchEvent(new CustomEvent(COMPOSE_EVENT, { detail: { tag } }))}>{children}</button>;
}
