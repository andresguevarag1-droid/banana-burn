"use client";
import { Banana, LevelIcon, Minus, Plus } from "@/components/icons";
import { clock } from "./logic";
import css from "./workout.module.css";

/** Stepper grande para usar con la mano sudada: botones de 56 px y número editable al centro. */
export function BigStepper({ label, unit, value, placeholder, inputMode, onMinus, onPlus, onChange, tone = "light" }: {
  label: string; unit: string; value: string; placeholder?: string; inputMode: "decimal" | "numeric"; onMinus: () => void; onPlus: () => void; onChange: (v: string) => void; tone?: "light" | "dark";
}) {
  const btn = tone === "dark" ? "bg-white/10 text-white hover:bg-white/20" : "bg-white text-ink border border-line hover:border-ink/30";
  return (
    <div className="flex-1 min-w-0">
      <div className={`flex items-center gap-1.5 rounded-[1.25rem] p-1.5 ${tone === "dark" ? "bg-white/5" : "bg-cream"}`}>
        <button type="button" onClick={onMinus} className={`pressable grid place-items-center size-12 shrink-0 rounded-2xl ${btn}`} aria-label={`Menos ${label}`}><Minus weight="bold" className="size-5" /></button>
        <label className="flex-1 min-w-0 text-center">
          <span className="sr-only">{label}</span>
          <input value={value} onChange={(e) => onChange(e.target.value)} inputMode={inputMode} placeholder={placeholder} onFocus={(e) => e.target.select()}
            className={`w-full min-w-0 bg-transparent text-center text-[28px] leading-none font-extrabold outline-none tabular-nums rounded-lg focus-visible:ring-4 focus-visible:ring-banana/60 ${tone === "dark" ? "text-white placeholder:text-white/40" : "text-ink placeholder:text-faint"}`} />
          <span aria-hidden className={`block mt-0.5 text-[11px] font-bold ${tone === "dark" ? "text-white/60" : "text-muted"}`}>{unit}</span>
        </label>
        <button type="button" onClick={onPlus} className={`pressable grid place-items-center size-12 shrink-0 rounded-2xl ${btn}`} aria-label={`Más ${label}`}><Plus weight="bold" className="size-5" /></button>
      </div>
    </div>
  );
}

/**
 * Cuenta regresiva circular. El arco restante se vacía y una banana viaja en su punta.
 * Solo anima transform y stroke-dashoffset, con transición lineal del mismo largo que el tick.
 */
export function CountRing({ left, total, size = 248, stroke = 14, track = "rgb(255 255 255 / .12)", color = "#FFD60A", tip = "text-ink", text = "text-white", children }: {
  left: number; total: number; size?: number; stroke?: number; track?: string; color?: string; tip?: string; text?: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, left / Math.max(1, total)));
  const urgent = left > 0 && left <= 3.05;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 250ms linear" }} />
      </svg>
      {/* La banana va en la punta del arco */}
      <div aria-hidden className="absolute inset-0" style={{ transform: `rotate(${frac * 360}deg)`, transition: "transform 250ms linear" }}>
        <span className="absolute left-1/2 top-0 grid place-items-center -translate-x-1/2 rounded-full" style={{ width: stroke * 2.4, height: stroke * 2.4, marginTop: -stroke * 0.7, background: color }}>
          <Banana weight="fill" className={tip} style={{ width: stroke * 1.6, height: stroke * 1.6 }} />
        </span>
      </div>
      <div className={`absolute inset-0 grid place-items-center text-center ${text}`}>
        <div>
          <span key={urgent ? Math.ceil(left) : "n"} className={`block font-extrabold tabular-nums leading-none tracking-tight ${urgent ? css.beat : ""}`} style={{ fontSize: size * 0.3 }}>
            {left >= 60 ? clock(left) : Math.ceil(left)}
          </span>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Progreso total de la sesión (series hechas / total). */
export function SessionRing({ value, size = 44 }: { value: number; size?: number }) {
  const sw = 4, r = (size - sw) / 2, c = 2 * Math.PI * r;
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span className="relative grid place-items-center shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Sesión al ${pct} %`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="#FFF" stroke="#EDE3C6" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1B1505" strokeWidth={sw} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} opacity={value > 0 ? 1 : 0}
          style={{ transition: "stroke-dashoffset 450ms cubic-bezier(.23,1,.32,1)" }} />
      </svg>
      <span aria-hidden className="absolute inset-0 grid place-items-center text-[11px] font-extrabold text-ink tabular-nums">{pct}%</span>
    </span>
  );
}

/** Banana dibujada con relleno amarillo y contorno tinta (la "ganada"). */
export function GoldBanana({ className = "size-6", pop }: { className?: string; pop?: boolean }) {
  return (
    <span aria-hidden className={`relative inline-grid ${className} ${pop ? css.collect : ""}`}>
      <Banana weight="fill" className="col-start-1 row-start-1 size-full text-banana" />
      <Banana weight="regular" className="col-start-1 row-start-1 size-full text-ink" />
    </span>
  );
}

/**
 * Las bananas del día: una por ejercicio. Se llenan al terminarlo. Cada una lleva a su ejercicio.
 * Debajo, una barrita con el avance de las series de ese ejercicio.
 */
export function BananaTrail({ items, current, onPick, fresh }: { items: { name: string; done: number; total: number }[]; current: number; onPick: (i: number) => void; fresh?: number | null }) {
  return (
    <nav aria-label="Ejercicios del entreno" className="flex gap-1">
      {items.map((it, i) => {
        const full = it.done >= it.total && it.total > 0;
        const on = i === current;
        return (
          <button key={i} type="button" onClick={() => onPick(i)} aria-current={on ? "step" : undefined}
            aria-label={`${it.name}, ${it.done} de ${it.total} series${full ? ", completo" : ""}`}
            className={`pressable flex-1 min-w-0 flex flex-col items-center gap-1 rounded-xl pt-1.5 pb-1 ${on ? "bg-white shadow-soft" : "hover:bg-white/60"}`}>
            {full ? <GoldBanana className="size-6" pop={fresh === i} /> : <Banana weight={on ? "duotone" : "regular"} className={`size-6 ${on ? "text-ink" : "text-faint"}`} aria-hidden />}
            <span aria-hidden className="block h-1 w-[70%] rounded-full bg-line overflow-hidden">
              <span className="bar-fill block h-full w-full rounded-full bg-ink" style={{ transform: `translateX(${(it.done / Math.max(1, it.total) - 1) * 100}%)` }} />
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** "+10 XP" que sube desde donde se ganó. Se vuelve a montar con cada `k`. */
export function XpPop({ k, xp }: { k: number; xp: number }) {
  if (!xp) return null;
  return (
    <span key={k} aria-hidden className={`${css.xp} z-10 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-ink px-3 h-8 text-sm font-extrabold text-banana shadow-lift`}>
      +{xp} XP
    </span>
  );
}

/**
 * Meta de nivel compacta: ícono del nivel, frase concreta ("Te faltan 80 XP para Plátano macho: 3 series más")
 * y una barra que se llena en vivo al marcar series. Solo anima transform.
 */
export function LevelMeter({ idx, progress, text, tone = "light", className = "" }: { idx: number; progress: number; text: string; tone?: "light" | "dark"; className?: string }) {
  const v = Math.max(0.03, Math.min(1, progress));
  const dark = tone === "dark";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span aria-hidden className={`grid place-items-center size-7 shrink-0 rounded-lg ${dark ? "bg-white/10" : "bg-banana-soft ring-1 ring-banana/40"}`}><LevelIcon idx={idx} className={`size-[18px] ${dark ? "text-banana!" : ""}`} /></span>
      <div className="flex-1 min-w-0">
        <p className={`line-clamp-2 text-xs leading-tight font-bold tabular-nums ${dark ? "text-white/85" : "text-ink"}`}>{text}</p>
        <div aria-hidden className={`mt-1 h-1.5 overflow-hidden rounded-full ${dark ? "bg-white/15" : "bg-line"}`}>
          <div className={`bar-fill h-full w-full rounded-full ${dark ? "bg-banana" : "bg-ember"}`} style={{ transform: `translateX(${(v - 1) * 100}%)` }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Subida de nivel en pleno entreno: aparece y se va sola en 1,1 s, sin bloquear toques.
 * El anuncio para lectores de pantalla lo hace el reproductor (región aria-live).
 */
export function LevelUpBurst({ idx, name, k }: { idx: number; name: string; k: number }) {
  return (
    <div key={k} aria-hidden className="pointer-events-none fixed inset-0 z-[70] grid place-items-center px-6">
      <div className={`${css.levelup} flex flex-col items-center rounded-[2rem] bg-ink ring-2 ring-banana/70 px-8 py-6 text-center text-white shadow-lift`}>
        <span className="grid place-items-center size-20 rounded-[1.5rem] bg-banana"><LevelIcon idx={idx} className="size-12 text-ink!" /></span>
        <p className="mt-3 text-sm font-bold text-banana">Subiste de nivel</p>
        <p className="text-2xl font-extrabold tracking-tight">{name}</p>
      </div>
    </div>
  );
}
