"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, WarningCircle } from "@/components/icons";
import { safeAction } from "@/lib/action-client";
import { useT } from "@/lib/i18n/client";
import type { Locale, Units } from "@/lib/i18n/locale";
import { updateLanguage } from "./actions";

const LOCALES: [Locale, string][] = [["es-419", "Español"], ["en-US", "English"]];
const UNITS: [Units, string][] = [["metric", "kg y cm"], ["imperial", "lb y ft/in"]];

/** Perfil (#287): idioma y unidades. Se guarda al tocar, como "Cómo te hablo". Los nombres de idioma no se traducen. */
export function LanguageSettings({ locale: l0, units: u0 }: { locale: Locale; units: Units }) {
  const t = useT();
  const [locale, setLocale] = useState(l0);
  const [units, setUnits] = useState(u0);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = (next: { locale?: Locale; units?: Units }) => {
    if (pending) return;
    const prev = { locale, units };
    if (next.locale) setLocale(next.locale);
    if (next.units) setUnits(next.units);
    setMsg(null);
    start(async () => {
      const r = await safeAction(updateLanguage(next));
      if (!r.ok) { setLocale(prev.locale); setUnits(prev.units); setMsg({ ok: false, t: r.error ?? "No pudimos guardar. Intenta de nuevo." }); return; }
      setMsg({ ok: true, t: r.demo ? "Demo: lo verás en esta sesión." : "Listo, guardado." });
      router.refresh();
    });
  };
  const seg = (on: boolean) => `pressable h-12 rounded-2xl border-2 font-bold transition-[background-color,border-color,color,transform] ${on ? "border-ink bg-banana text-ink" : "border-line bg-white text-muted"}`;
  return (
    <div className="space-y-4">
      <div role="group" aria-label="Idioma / Language" className="grid grid-cols-2 gap-2">
        {LOCALES.map(([k, l]) => <button key={k} type="button" lang={k} disabled={pending} onClick={() => k !== locale && save({ locale: k })} className={seg(locale === k)} aria-pressed={locale === k}>{l}</button>)}
      </div>
      <div role="group" aria-label={t("Unidades")}>
        <p className="mb-1.5 text-sm font-bold text-ink">{t("Unidades")}</p>
        <div className="grid grid-cols-2 gap-2">
          {UNITS.map(([k, l]) => <button key={k} type="button" disabled={pending} onClick={() => k !== units && save({ units: k })} className={seg(units === k)} aria-pressed={units === k}>{t(l)}</button>)}
        </div>
      </div>
      <p role={msg && !msg.ok ? "alert" : "status"} className={`flex min-h-5 items-center gap-1.5 text-sm font-semibold ${msg?.ok ? "text-peel" : "text-bad"}`}>
        {msg && (msg.ok ? <CheckCircle weight="fill" className="size-4 shrink-0" /> : <WarningCircle weight="fill" className="size-4 shrink-0" />)}{pending ? <span className="text-muted">{t("Guardando…")}</span> : msg && t(msg.t)}
      </p>
    </div>
  );
}
