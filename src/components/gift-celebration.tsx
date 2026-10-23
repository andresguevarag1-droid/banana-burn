"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Portal } from "@/components/portal";
import { Confetti } from "@/components/confetti";
import { Gift } from "@/components/icons";
import { markGiftsSeen } from "@/app/actions/gifts";
import { giftTitle, type GiftView } from "@/lib/gifts";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric" });

/** Regalo de ejemplo del demo (?regalo=demo): rotulado como demo y sin guardar nada. */
function demoGift(): GiftView {
  const now = Date.now();
  return { id: 0, source: "regalo", plan: "completo", months: 3, message: "Gracias por entrenar con nosotros desde el primer día.", startsAt: new Date(now).toISOString(), expiresAt: new Date(now + 92 * 864e5).toISOString(), status: "activo", title: giftTitle({ months: 3, plan: "completo", source: "regalo" }) };
}

/**
 * Celebración única de "Te regalaron X meses de <plan>". El layout pasa los regalos que la persona aún no vio (servidor,
 * RLS: solo los suyos). Al cerrar se marcan vistos en la base y no vuelve a salir en ningún dispositivo.
 * Movimiento: entra en 280 ms desde .96 (ease-out), sale en 200 ms; con movimiento reducido solo hay fundido y sin confeti.
 */
export function GiftCelebration({ gifts, demo }: { gifts: GiftView[]; demo: boolean }) {
  const [list, setList] = useState<GiftView[]>(gifts);
  const [isDemo, setIsDemo] = useState(false);
  useEffect(() => {
    if (!demo) return;
    try { if (new URLSearchParams(window.location.search).get("regalo") === "demo") { setList([demoGift()]); setIsDemo(true); } } catch { /* sin URL */ }
  }, [demo]);
  if (!list.length) return null;
  return <GiftDialog gifts={list} demo={isDemo} onClose={() => { setList([]); if (!demo) markGiftsSeen().catch(() => {}); }} />;
}

function GiftDialog({ gifts, demo, onClose }: { gifts: GiftView[]; demo: boolean; onClose: () => void }) {
  const [closing, setClosing] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const g = gifts[0];
  const later = Date.parse(g.startsAt) > Date.now() + 60_000;
  const close = () => { if (closing) return; setClosing(true); setTimeout(onClose, 200); };
  useEffect(() => {
    btn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Portal>
      <div className="fixed inset-0 z-[80] grid place-items-center px-4" role="dialog" aria-modal="true" aria-labelledby="regalo-t" aria-describedby="regalo-d">
        <div className={`bb-backdrop absolute inset-0 bg-ink/50 ${closing ? "bb-out" : ""}`} onClick={close} aria-hidden />
        {!closing && <Confetti n={40} />}
        <div className={`bb-celebrate relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-banana text-ink shadow-lift ${closing ? "bb-out" : ""}`}>
          <div className="relative grid place-items-center bg-banana-soft pt-6">
            {demo && <span className="absolute left-4 top-4 chip bg-ink text-white">Demo</span>}
            <span className="absolute right-4 top-4 grid size-11 place-items-center rounded-2xl bg-white text-banana-ink shadow-sm" aria-hidden><Gift weight="duotone" className="size-6" /></span>
            <Image src="/brand/mascota-sola.webp" alt="" width={176} height={176} priority className="relative -mb-2 size-40 object-contain drop-shadow-lg" />
          </div>
          <div className="px-6 pb-6 pt-5 text-center">
            <p className="text-sm font-bold text-banana-ink">{g.source === "referido" ? "Recompensa por invitar" : "Un regalo para ti"}</p>
            <h2 id="regalo-t" className="mt-1 text-[1.6rem] font-extrabold leading-tight tracking-tight text-balance">{g.title}</h2>
            <p id="regalo-d" className="mt-2 text-sm font-semibold text-ink/80 text-pretty">
              {later ? `Empieza el ${fmt(g.startsAt)}, cuando termine el acceso que ya tienes, y dura hasta el ${fmt(g.expiresAt)}.` : `Ya está activo hasta el ${fmt(g.expiresAt)}. Sin cobros.`}
            </p>
            {g.message && <blockquote className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-left text-sm text-ink text-pretty">{g.message}</blockquote>}
            {gifts.length > 1 && <p className="mt-3 text-sm font-semibold text-ink/80">Y {gifts.length - 1 === 1 ? "un regalo más" : `${gifts.length - 1} regalos más`}: míralos en Mi plan.</p>}
            <div className="mt-5 grid gap-2">
              <button ref={btn} type="button" onClick={close} className="btn-primary h-12 w-full">Genial, gracias</button>
              <Link href="/app/suscripcion" onClick={close} className="tap inline-flex h-11 items-center justify-center text-sm font-bold text-ink/80 underline-offset-2 hover:text-ink hover:underline">Ver mis regalos</Link>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
