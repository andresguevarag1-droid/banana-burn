"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };


function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        const bullet = /^\s*[-•]\s+/.test(line);
        const parts = line.replace(/^\s*[-•]\s+/, "").split(/(\*\*[^*]+\*\*)/g).map((p, j) => (p.startsWith("**") ? <b key={j} className="text-ink">{p.slice(2, -2)}</b> : <span key={j}>{p}</span>));
        if (!line.trim()) return <div key={i} className="h-2" />;
        return bullet ? <p key={i} className="flex gap-2"><span className="text-banana-ink">•</span><span>{parts}</span></p> : <p key={i}>{parts}</p>;
      })}
    </>
  );
}

export function Chat({ initial, opener, suggest }: { initial: Msg[]; opener: string; suggest: string[] }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setInput(""); setBusy(true);
    try {
      const res = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      if (!res.ok || !res.body) throw new Error();
      const reader = res.body.getReader(); const dec = new TextDecoder(); let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...next, { role: "assistant", content: acc }]);
      }
    } catch {
      setMsgs([...next, { role: "assistant", content: "⚠️ No pude responder ahora. Revisa tu conexión e intenta de nuevo." }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-9rem)] lg:min-h-[calc(100dvh-6rem)]">
      <header className="flex items-center gap-3 pb-4 border-b border-line">
        <span className="grid place-items-center size-12 rounded-2xl bg-banana"><Sparkles className="size-6 text-ink" /></span>
        <div><h1 className="text-xl font-extrabold text-ink">Coach Banana</h1><p className="text-sm text-muted">Conoce tu plan, tu peso y tus entrenos</p><p className="text-[11px] text-faint">Puede equivocarse · no sustituye consejo médico</p></div>
      </header>

      <div className="flex-1 py-5 space-y-4">
        <div className="flex justify-start animate-rise">
          <div className="max-w-[88%] rounded-3xl rounded-bl-lg px-4 py-3 text-[15px] leading-relaxed space-y-1 bg-banana-soft/70 border border-banana/40 text-body"><Rich text={opener} /></div>
        </div>
        {!msgs.length && (
          <div className="flex flex-wrap gap-2 animate-rise">
            {suggest.map((s) => <button key={s} onClick={() => send(s)} className="pressable min-h-11 rounded-full bg-white border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-ink transition text-left">{s}</button>)}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-3xl px-4 py-3 text-[15px] leading-relaxed space-y-1 ${m.role === "user" ? "bg-ink text-white rounded-br-lg" : "bg-white border border-line text-body rounded-bl-lg"}`}>
              {m.content ? (m.role === "user" ? m.content : <Rich text={m.content} />) : <span className="inline-flex gap-1 py-1">{[0, 1, 2].map((d) => <span key={d} className="size-2 rounded-full bg-faint animate-bounce" style={{ animationDelay: `${d * 120}ms` }} />)}</span>}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="sticky bottom-24 lg:bottom-6 flex gap-2 rounded-full bg-white border border-line p-1.5 shadow-lift">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escríbele a tu coach…" maxLength={2000} className="flex-1 min-w-0 bg-transparent px-4 text-[16px] text-ink outline-none placeholder:text-faint" aria-label="Mensaje" />
        <button disabled={busy || !input.trim()} className="pressable grid place-items-center size-11 rounded-full bg-ink text-white hover:bg-black disabled:opacity-30" aria-label="Enviar"><ArrowUp className="size-5" /></button>
      </form>
    </div>
  );
}
