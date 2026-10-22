"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BananaCoin, BananaFlame, BananaTrophy, Barbell, BrandIcon, DownloadSimple, LevelIcon, Monkey, ShareNetwork, Timer } from "@/components/icons";
import { levelOf } from "@/lib/gamify";
import { Confetti } from "@/components/confetti";
import { ProgressBar } from "@/components/progress-bar";
import { Sheet, SheetTitle } from "@/components/sheet";
import { clock, plural, volumeText } from "./logic";
import { drawStory, downloadBlob, shareStory } from "./story-card";
import { useReducedMotion } from "./device";
import { GoldBanana } from "./ui";

/** Número que sube hasta su valor (momento raro: el cierre del entreno). */
function useCountUp(to: number, ms = 800) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) { setV(to); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, reduce]);
  return v;
}

export function Recap({ title, icon, xpBefore, xp, rushed, streak, seconds, done, total, volume, prs, bananas, saveMsg, feedback }: {
  title: string; icon: string; xpBefore: number; xp: number; rushed: boolean; streak: number; seconds: number; done: number; total: number; volume: number;
  prs: string[]; bananas: { got: number; total: number }; saveMsg: string | null; feedback: string | null;
}) {
  const before = levelOf(xpBefore), after = levelOf(xpBefore + xp);
  const leveled = after.idx > before.idx;
  const shownXp = useCountUp(xp);
  // La barra de nivel arranca donde estabas y avanza con lo ganado hoy
  const [bar, setBar] = useState(leveled ? 0 : before.progress);
  useEffect(() => { const t = setTimeout(() => setBar(after.progress), 450); return () => clearTimeout(t); }, [after.progress]);

  const [story, setStory] = useState<{ url: string; blob: Blob } | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  useEffect(() => () => { if (story) URL.revokeObjectURL(story.url); }, [story]);

  async function makeStory() {
    setBusy(true); setShareMsg(null);
    try {
      const blob = await drawStory({
        title, date: new Date(), time: clock(seconds), sets: String(done), volume: volume > 0 ? volumeText(volume) : "0 kg", xp: `+${xp}`,
        streak, level: `Nivel ${after.idx}, ${after.n}`, prs: rushed ? [] : prs, bananas,
      });
      setStory({ blob, url: URL.createObjectURL(blob) });
    } catch { setShareMsg("No pudimos crear la imagen en este teléfono."); }
    setBusy(false);
  }
  async function share() {
    if (!story) return;
    const r = await shareStory(story.blob, title);
    setShareMsg(r === "downloaded" ? "Imagen descargada. Súbela a tu historia." : r === "shared" ? "Listo, compartido." : null);
  }

  const stats: { icon: React.ReactNode; big: string; small: string }[] = [
    { icon: <Timer weight="duotone" className="size-5 text-ink/70" />, big: clock(seconds), small: "tiempo" },
    { icon: <Barbell weight="duotone" className="size-5 text-ink/70" />, big: `${done}/${total}`, small: "series" },
    { icon: <BananaCoin className="size-5 text-banana-ink" />, big: `+${shownXp}`, small: "XP ganados" },
    { icon: <BananaFlame className="size-5 text-ember-ink" />, big: String(streak), small: streak === 1 ? "día de racha" : "días de racha" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper">
      <Confetti />
      <div tabIndex={0} role="region" aria-label="Resumen del entreno" className="flex-1 overflow-y-auto overflow-x-hidden px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-6 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-banana/60">
        <div className="mx-auto w-full max-w-sm stagger text-center">
          <div><span className="mx-auto grid place-items-center size-28 rounded-[2.25rem] bg-banana shadow-lift animate-pop">
            {leveled ? <LevelIcon idx={after.idx} className="size-16" title={after.n} /> : <BananaFlame weight="fill" className="size-16 text-ember-ink" />}
          </span></div>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-ink">{leveled ? `Subiste a ${after.n}` : "Entreno completado"}</h1>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-lg font-semibold text-muted"><BrandIcon name={icon} className="size-5 text-banana-ink" />{title}</p>

          <div className="mt-6 card text-left">
            <ul role="list" className="grid grid-cols-2">
              {stats.map((s, i) => (
                <li key={s.small} className={`flex items-center gap-3 p-4 ${i % 2 ? "border-l border-line" : ""} ${i > 1 ? "border-t border-line" : ""}`}>
                  <span aria-hidden className="grid place-items-center size-10 shrink-0 rounded-xl bg-cream">{s.icon}</span>
                  <p className="min-w-0 flex flex-col"><span className="text-xl font-extrabold text-ink tabular-nums leading-tight">{s.big}</span><span className="text-xs font-semibold text-muted">{s.small}</span></p>
                </li>
              ))}
            </ul>
            <div className="border-t border-line p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-ink">Bananas del día</p>
                <p className="ml-auto text-sm font-bold text-muted tabular-nums">{bananas.got} de {bananas.total}</p>
              </div>
              <div className="mt-2 flex gap-1.5" role="img" aria-label={`${bananas.got} de ${bananas.total} ejercicios completos`}>
                {Array.from({ length: bananas.total }, (_, i) => i < bananas.got ? <GoldBanana key={i} className="size-8" pop /> : <span key={i} aria-hidden className="inline-grid size-8 opacity-30"><GoldBanana className="size-8" /></span>)}
              </div>
              {volume > 0 && <p className="mt-2 text-sm text-muted">Moviste <span className="font-bold text-ink tabular-nums">{volumeText(volume)}</span> en total.</p>}
            </div>
            <div className="border-t border-line p-4">
              <div className="flex items-center gap-2.5">
                <LevelIcon idx={after.idx} className="size-7 shrink-0" />
                <div className="min-w-0">
                  <p className="font-extrabold leading-tight text-ink">{after.n}</p>
                  <p className="text-xs font-semibold text-muted tabular-nums">Nivel {after.idx}{after.next ? `, ${after.toNext} XP para ${after.next.n}` : ", el máximo"}</p>
                </div>
              </div>
              <ProgressBar value={bar} min={0.04} className="mt-3 h-2.5" fill="bg-ember" label={`Progreso del nivel ${after.idx}`} />
            </div>
          </div>

          {rushed && <p className="mt-3 flex gap-2.5 rounded-2xl bg-cream p-3 text-left text-sm text-ink"><Timer weight="duotone" className="size-5 shrink-0 text-ink/70" /><span>Registraste las series muy rápido. El día cuenta para tu racha, pero los XP y los récords se ganan cuando cada serie lleva su tiempo real.</span></p>}
          {prs.length > 0 && !rushed && (
            <div className="mt-3 rounded-[1.5rem] bg-banana p-4 text-left">
              <p className="font-extrabold text-ink flex items-center gap-2"><BananaTrophy weight="fill" className="size-6" /> {prs.length === 1 ? "Récord personal" : `${prs.length} récords personales`}</p>
              <p className="text-sm text-ink/80">{prs.join(", ")}</p>
            </div>
          )}
          {saveMsg && <p className="mt-3 text-sm text-banana-ink">{saveMsg}</p>}

          <div className="mt-3 card p-4 text-left" aria-live="polite">
            <p className="flex items-center gap-1.5 text-sm font-bold text-ink"><Monkey className="size-5 text-banana-ink" />Coach Banana</p>
            {feedback ? <p className="mt-1 text-[15px] text-ink leading-relaxed animate-enter">{feedback}</p> : <p className="mt-2 flex gap-1" aria-label="Analizando tu entreno">{[0, 1, 2].map((d) => <span key={d} className="size-2 rounded-full bg-faint animate-bounce" style={{ animationDelay: `${d * 120}ms` }} />)}</p>}
          </div>
        </div>
      </div>
      <footer className="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-line bg-white/95">
        <div className="mx-auto flex max-w-sm gap-2">
          <button type="button" onClick={makeStory} disabled={busy} className="btn-ghost h-14 flex-1 text-base"><ShareNetwork weight="bold" className="size-5" />{busy ? "Creando…" : "Compartir"}</button>
          <Link href="/app" className="btn-primary h-14 flex-1 text-base">Listo</Link>
        </div>
      </footer>

      <Sheet open={!!story} onClose={() => setStory(null)} className="max-h-[92dvh] overflow-y-auto">
        <div className="px-5">
          <SheetTitle className="text-2xl font-extrabold text-ink">Tu historia</SheetTitle>
          <p className="text-sm text-muted">Lista para Instagram o WhatsApp.</p>
          {story && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.url} alt={`Tarjeta del entreno ${title}: ${clock(seconds)}, ${plural(done, "serie", "series")}, racha de ${streak}`} className="mx-auto mt-4 aspect-[9/16] w-full max-w-[240px] rounded-2xl shadow-lift" />
          )}
          {shareMsg && <p role="status" className="mt-3 text-center text-sm font-semibold text-ink">{shareMsg}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => story && downloadBlob(story.blob)} className="btn-ghost h-13 flex-1"><DownloadSimple weight="bold" className="size-5" />Descargar</button>
            <button type="button" onClick={share} data-autofocus className="btn-banana h-13 flex-1"><ShareNetwork weight="bold" className="size-5" />Compartir</button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
