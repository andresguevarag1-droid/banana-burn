"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowCounterClockwise, ArrowUp, ChatCircle, Monkey, Plus, WarningCircle } from "@/components/icons";
import { errorFor, isLocalOnly, splitCut, type ChatError } from "./errors";

type Msg = { role: "user" | "assistant"; content: string; at?: string };
/** Un envío que falló: el mensaje del usuario queda aparte (no entra al historial que se manda al modelo). */
type Failed = { q: string; err: ChatError; inHistory?: boolean };

const SINCE_KEY = "bb.coach.since";
/** El coach habla con íconos de marca, no con emojis: limpiamos cualquiera que traiga el modelo. */
const noEmoji = (t: string) => t.replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu, "").replace(/[ \t]{2,}/g, " ");

function CoachAvatar() {
  return <span aria-hidden className="grid place-items-center size-9 shrink-0 rounded-xl bg-ink text-banana"><Monkey className="size-6" /></span>;
}
function UserAvatar({ name }: { name: string }) {
  return <span aria-hidden className="grid place-items-center size-9 shrink-0 rounded-xl bg-banana text-sm font-extrabold text-ink">{name[0]?.toUpperCase() || "T"}</span>;
}

function Rich({ text }: { text: string }) {
  return (
    <>
      {noEmoji(text).split("\n").map((line, i) => {
        const bullet = /^\s*[-•]\s+/.test(line);
        const parts = line.replace(/^\s*[-•]\s+/, "").split(/(\*\*[^*]+\*\*)/g).map((p, j) => (p.startsWith("**") ? <b key={j} className="text-ink">{p.slice(2, -2)}</b> : <span key={j}>{p}</span>));
        if (!line.trim()) return <div key={i} className="h-2" />;
        return bullet ? <p key={i} className="flex gap-2"><span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-banana-ink" /><span>{parts}</span></p> : <p key={i}>{parts}</p>;
      })}
    </>
  );
}

export function Chat({ initial, opener, suggest, name, configured = true }: { initial: Msg[]; opener: string; suggest: string[]; name: string; configured?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<Failed | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  // "Nueva conversación" es local a este navegador: el historial guardado no se borra, solo se oculta desde esa fecha.
  useEffect(() => {
    try {
      const since = localStorage.getItem(SINCE_KEY);
      if (since) setMsgs((m) => m.filter((x) => !x.at || x.at > since));
    } catch { /* sin almacenamiento */ }
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, failed]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy || !configured) return;
    setFailed(null);
    // Solo mensajes reales van al modelo: nada de avisos locales ni respuestas vacías.
    const history = msgs.filter((m) => !isLocalOnly(m)).map(({ role, content }) => ({ role, content }));
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setInput(""); setBusy(true);
    let acc = "";
    try {
      const res = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [...history, { role: "user", content: q }] }) });
      if (!res.ok || !res.body) {
        const body = res.headers.get("content-type")?.startsWith("text/plain") ? await res.text().catch(() => "") : "";
        throw errorFor(res.status, body);
      }
      const reader = res.body.getReader(); const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...next, { role: "assistant", content: splitCut(acc).content }]);
      }
      const { content, cut } = splitCut(acc);
      if (cut) {
        // Respuesta a medias: la conservamos visible pero ofrecemos reintentar la pregunta completa.
        setMsgs(content ? [...next, { role: "assistant", content }] : msgs);
        setFailed(content ? { q, err: { text: "La respuesta se cortó antes de terminar.", retry: true }, inHistory: true } : { q, err: { text: "Se cortó la respuesta. Intenta de nuevo.", retry: true } });
      }
    } catch (e) {
      // El mensaje fallido no se guarda en el historial: así no se reenvía como si el coach lo hubiera contestado.
      setMsgs(msgs);
      setFailed({ q, err: e && typeof e === "object" && "text" in e ? (e as ChatError) : errorFor(null) });
    } finally { setBusy(false); }
  }

  function newConversation() {
    try { localStorage.setItem(SINCE_KEY, new Date().toISOString()); } catch { /* sin almacenamiento */ }
    setMsgs([]); setFailed(null); setInput("");
    field.current?.focus();
  }

  const fresh = msgs.length === 0 && !failed;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-9rem)] lg:min-h-[calc(100dvh-6rem)]">
      <header className="flex items-center gap-3 pb-4 border-b border-line">
        <span className="grid place-items-center size-12 shrink-0 rounded-2xl bg-ink text-banana"><Monkey weight="fill" className="size-8 [--bb-icon-bg:var(--color-ink)]" /></span>
        <div className="flex-1 min-w-0"><h1 className="text-xl font-extrabold text-ink">Coach Banana</h1><p className="text-sm text-muted">Conoce tu plan, tu peso y tus entrenos</p><p className="text-xs text-muted">Puede equivocarse y no sustituye el consejo médico.</p></div>
        {configured && msgs.length > 0 && (
          <button type="button" onClick={newConversation} disabled={busy} className="tap pressable inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3 h-11 text-sm font-bold text-ink hover:bg-cream disabled:opacity-40">
            <Plus weight="bold" className="size-4" /><span className="hidden sm:inline">Nueva conversación</span><span className="sm:hidden">Nueva</span>
          </button>
        )}
      </header>

      <div className="flex-1 py-5 space-y-4" aria-live="polite" aria-busy={busy}>
        {configured ? (
          <div className="flex items-end gap-2 justify-start animate-enter">
            <CoachAvatar />
            <div className="max-w-[85%] rounded-3xl rounded-bl-lg px-4 py-3 text-[15px] leading-relaxed space-y-1 bg-banana-soft/70 border border-banana/40 text-body"><Rich text={opener} /></div>
          </div>
        ) : (
          <div className="card p-6 text-center animate-enter" role="status">
            <span className="mx-auto grid place-items-center size-14 rounded-2xl bg-banana-soft text-banana-ink" aria-hidden><Monkey className="size-9" /></span>
            <p className="mt-3 text-lg font-extrabold text-ink">El coach se está configurando</p>
            <p className="mt-1 text-sm text-muted text-pretty">Estamos terminando de conectar a Coach Banana. Mientras tanto, tu rutina, tus cargas y tu plan siguen funcionando como siempre.</p>
          </div>
        )}
        {configured && fresh && (
          <div className="flex flex-wrap gap-2 pl-11 stagger" aria-label="Preguntas sugeridas">
            {suggest.map((s) => <button key={s} onClick={() => send(s)} className="pressable min-h-11 inline-flex items-center gap-2 rounded-2xl bg-white border border-line px-3.5 py-2 text-sm font-semibold text-ink hover:border-ink text-left"><ChatCircle weight="duotone" className="size-4 shrink-0 text-banana-ink" />{s}</button>)}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex items-end gap-2 animate-enter ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && <CoachAvatar />}
            <div className={`max-w-[80%] rounded-3xl px-4 py-3 text-[15px] leading-relaxed space-y-1 ${m.role === "user" ? "bg-ink text-white rounded-br-lg" : "bg-white border border-line text-body rounded-bl-lg"}`}>
              {m.content ? (m.role === "user" ? m.content : <Rich text={m.content} />) : <span className="inline-flex gap-1 py-1" role="status" aria-label="El coach está escribiendo">{[0, 1, 2].map((d) => <span key={d} className="size-2 rounded-full bg-faint animate-bounce motion-reduce:animate-none" style={{ animationDelay: `${d * 120}ms` }} />)}</span>}
            </div>
            {m.role === "user" && <UserAvatar name={name} />}
          </div>
        ))}
        {failed && (
          <div className="space-y-2 animate-enter">
            {!failed.inHistory && (
              <div className="flex items-end gap-2 justify-end">
                <div className="max-w-[80%] rounded-3xl rounded-br-lg px-4 py-3 text-[15px] leading-relaxed bg-ink/70 text-white">{failed.q}</div>
                <UserAvatar name={name} />
              </div>
            )}
            <div role="alert" className="ml-11 flex flex-wrap items-center gap-2 rounded-2xl border border-bad/20 bg-bad/5 px-3 py-2 text-sm text-bad">
              <WarningCircle weight="fill" className="size-5 shrink-0" />
              <span className="flex-1 min-w-0 font-semibold">{failed.err.text}</span>
              {failed.err.retry && <button type="button" onClick={() => send(failed.q)} disabled={busy} className="tap pressable inline-flex items-center gap-1.5 rounded-full bg-white border border-bad/30 px-3 h-11 font-bold text-bad hover:bg-bad/5"><ArrowCounterClockwise weight="bold" className="size-4" />Reintentar</button>}
            </div>
          </div>
        )}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="sticky bottom-24 lg:bottom-6 flex gap-2 rounded-full bg-white border border-line p-1.5 shadow-lift">
        <input ref={field} value={input} onChange={(e) => setInput(e.target.value)} disabled={!configured} placeholder={configured ? "Escríbele a tu coach…" : "El coach se está configurando"} maxLength={2000} className="flex-1 min-w-0 bg-transparent px-4 text-[16px] text-ink outline-none placeholder:text-faint disabled:cursor-not-allowed" aria-label="Mensaje" />
        <button disabled={!configured || busy || !input.trim()} className="pressable grid place-items-center size-11 rounded-full bg-ink text-white hover:bg-black disabled:opacity-30" aria-label="Enviar"><ArrowUp weight="bold" className="size-5" /></button>
      </form>
    </div>
  );
}
