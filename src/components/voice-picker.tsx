"use client";
// "Cómo te hablo": tres opciones con un ejemplo real de cómo suena cada una. Se usa en la bienvenida y en el perfil.
import { Check } from "@/components/icons";
import { VOICES, type Voice } from "@/lib/voice";

export function VoicePicker({ value, onChange, name = "lenguaje" }: { value: Voice; onChange: (v: Voice) => void; name?: string }) {
  return (
    <div role="radiogroup" aria-label="Cómo te hablo" className="space-y-2">
      {VOICES.map((o) => {
        const on = value === o.id;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} name={name} onClick={() => onChange(o.id)}
            className={`pressable w-full min-h-11 rounded-3xl border-2 p-4 text-left transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(.23,1,.32,1)] active:scale-[.98] ${on ? "border-ink bg-banana" : "border-line bg-white hover:border-ink/40"}`}>
            <span className="flex items-start gap-3">
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold text-ink">{o.label}</span>
                <span className="block text-sm text-ink/70">{o.d}</span>
                <span className={`mt-2 block rounded-2xl px-3 py-2 text-sm font-semibold text-ink ${on ? "bg-white/70" : "bg-cream"}`}><span className="sr-only">Ejemplo: </span>“{o.sample}”</span>
              </span>
              <span aria-hidden className={`mt-0.5 grid place-items-center size-6 shrink-0 rounded-full border-2 transition-colors duration-150 ${on ? "bg-ink border-ink text-white" : "border-line"}`}><Check weight="bold" className={`size-4 transition-[opacity,transform] duration-200 ease-[cubic-bezier(.23,1,.32,1)] ${on ? "opacity-100 scale-100" : "opacity-0 scale-50"}`} /></span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
