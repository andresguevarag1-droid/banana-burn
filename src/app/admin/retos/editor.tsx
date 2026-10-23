"use client";
// Editor de un reto de la tienda: datos, precio, recompensas, inicio y plan día a día con ayudantes de patrón.
import { useActionState, useMemo, useState } from "react";
import { ArrowsLeftRight, Copy, Plus, Repeat, Trash } from "@/components/icons";
import { Status, Submit } from "@/components/admin/action-form";
import { Field, btnGhost, inputSm, panel, textareaSm } from "@/components/admin/ui";
import { ChallengeCover } from "@/components/retos/cover";
import { COVERS, COVER_LABEL, DIFFICULTY_LABEL, ICONS, MAX_CHALLENGE_XP, STATUS_LABEL, VERIFY_LABEL, type CoverStyle, type DayTask, type TaskType } from "@/lib/challenges";
import { saveStoreChallenge } from "./actions";
import { EMPTY_META, ProgramEditor } from "./program-editor";
import { weeksOf, type ProgramMeta, type ProgramSession } from "@/lib/programs";

export type EditorValue = {
  uuid?: string; slug?: string; title: string; desc: string; days: number; verify: string; stepsGoal?: number; icon: string; cover: CoverStyle;
  difficulty: string; minutes: number; grace: number; xp: number; badge: string; rewardTitle: string | null; priceUsd: number; onvoPriceId: string | null;
  startMode: "libre" | "fecha"; startDate: string | null; featured: boolean; comingSoon: boolean; safetyNote: string | null; status: string; sort: number; plan: DayTask[];
  /** Programa (0024): tipo, meta, sesiones y nombres de sus ejercicios. */
  kind: "reto" | "programa"; program: ProgramMeta | null; sessions: ProgramSession[]; names: Record<string, string>;
};

const TYPES: { v: TaskType; l: string }[] = [
  { v: "reps", l: "Repeticiones" }, { v: "tiempo", l: "Tiempo (s)" }, { v: "pasos", l: "Pasos" }, { v: "entreno", l: "Entreno" },
  { v: "habito", l: "Hábito" }, { v: "nutricion", l: "Comida" }, { v: "descanso", l: "Descanso" },
];
const sel = `${inputSm} pr-8`;

export function ChallengeEditor({ init, canSell }: { init: EditorValue; canSell: boolean }) {
  const [state, action] = useActionState(saveStoreChallenge, null);
  const [days, setDays] = useState(init.days);
  const [plan, setPlan] = useState<DayTask[]>(() => Array.from({ length: init.days }, (_, i) => init.plan[i] ?? { t: "", type: "habito" }));
  const [cover, setCover] = useState<CoverStyle>(init.cover);
  const [icon, setIcon] = useState(init.icon);
  const [verify, setVerify] = useState(init.verify);
  const [startMode, setStartMode] = useState(init.startMode);
  const [price, setPrice] = useState(String(init.priceUsd || ""));
  const [kind, setKind] = useState(init.kind);
  const isProg = kind === "programa";
  // Ayudantes
  const [cycle, setCycle] = useState(7);
  const [tpl, setTpl] = useState("{n} flexiones en total hoy");
  const [from, setFrom] = useState(10);
  const [to, setTo] = useState(100);
  const [tplType, setTplType] = useState<TaskType>("reps");
  const [restEvery, setRestEvery] = useState(7);
  const [restText, setRestText] = useState("Descanso activo: camina 20 min y estira 5 min");

  const rows = useMemo(() => Array.from({ length: days }, (_, i) => plan[i] ?? { t: "", type: "habito" as TaskType }), [plan, days]);
  const filled = rows.filter((r) => r.t.trim()).length;
  const set = (i: number, patch: Partial<DayTask>) => setPlan((p) => { const out = Array.from({ length: days }, (_, k) => p[k] ?? { t: "", type: "habito" as TaskType }); out[i] = { ...out[i], ...patch }; return out; });
  const resize = (n: number) => { const d = Math.max(1, Math.min(365, Math.round(n) || 1)); setDays(d); setPlan((p) => Array.from({ length: d }, (_, k) => p[k] ?? { t: "", type: "habito" })); };
  const repeat = () => setPlan((p) => { const k = Math.max(1, Math.min(days, cycle)); const base = Array.from({ length: k }, (_, i) => p[i] ?? { t: "", type: "habito" as TaskType }); return Array.from({ length: days }, (_, i) => ({ ...base[i % k] })); });
  const progression = () => setPlan(() => Array.from({ length: days }, (_, i) => { const n = Math.round(from + (to - from) * (days <= 1 ? 1 : i / (days - 1))); return { t: tpl.replaceAll("{n}", n.toLocaleString("es-CO")), type: tplType, target: n }; }));
  const rest = () => setPlan((p) => Array.from({ length: days }, (_, i) => ((i + 1) % Math.max(2, restEvery) === 0 ? { t: restText, type: "descanso" as TaskType } : p[i] ?? { t: "", type: "habito" as TaskType })));
  const fillDown = () => setPlan((p) => { const out: DayTask[] = []; for (let i = 0; i < days; i++) { const cur = p[i]; out.push(cur?.t.trim() ? cur : out[i - 1] ? { ...out[i - 1] } : { t: "", type: "habito" }); } return out; });
  const clear = () => setPlan(Array.from({ length: days }, () => ({ t: "", type: "habito" as TaskType })));

  const k = init.uuid ?? "nuevo";
  return (
    <form action={action} className="space-y-5">
      {init.uuid && <input type="hidden" name="id" value={init.uuid} />}
      <input type="hidden" name="kind" value={kind} />
      <fieldset className={`${panel} flex flex-wrap items-center gap-3 p-4 sm:p-5`}>
        <legend className="sr-only">Tipo</legend>
        <p className="mr-auto min-w-0 text-sm text-muted"><b className="text-ink">Tipo.</b> Un reto es un hábito diario con check-in. Un programa reemplaza la rutina de la persona mientras dura.</p>
        {(["reto", "programa"] as const).map((k) => (
          <label key={k} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-bold transition-transform duration-150 ease-out active:scale-[.97] ${kind === k ? "border-ink bg-banana text-ink" : "border-line bg-white text-ink"}`}>
            <input type="radio" name="kind-ui" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />{k === "reto" ? "Reto de hábitos" : "Programa de entreno"}
          </label>
        ))}
      </fieldset>
      <input type="hidden" name="plan" value={JSON.stringify(rows.filter((r) => r.t.trim()).length === days ? rows : rows.slice(0, rows.findIndex((r) => !r.t.trim()) < 0 ? days : rows.findIndex((r) => !r.t.trim())))} />

      <section className={`${panel} grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_16rem]`} aria-labelledby={`ed-basic-${k}`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <h2 id={`ed-basic-${k}`} className="font-extrabold text-ink sm:col-span-2">Datos del reto</h2>
          <Field label="Título" htmlFor={`t-${k}`} className="sm:col-span-2"><input id={`t-${k}`} name="title" required minLength={3} maxLength={80} defaultValue={init.title} className={inputSm} /></Field>
          <Field label="Identificador (slug)" htmlFor={`s-${k}`} hint={init.uuid ? "No cambia: lo guardan inscripciones y compras" : "Vacío = se genera del título"}>
            <input id={`s-${k}`} name="slug" maxLength={60} defaultValue={init.slug} readOnly={!!init.uuid} pattern="[a-z0-9\-]*" className={`${inputSm} ${init.uuid ? "bg-cream! text-muted" : ""}`} />
          </Field>
          <Field label="Estado" htmlFor={`st-${k}`} hint="Solo lo publicado aparece en la tienda">
            <select id={`st-${k}`} name="status" defaultValue={init.status} className={sel}>{Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </Field>
          <Field label="Descripción" htmlFor={`d-${k}`} className="sm:col-span-2"><textarea id={`d-${k}`} name="description" rows={3} maxLength={600} defaultValue={init.desc} className={textareaSm} /></Field>
          {isProg ? <p className="self-end pb-2 text-sm text-muted">La duración sale de las fases del programa{init.program ? ` (${weeksOf(init.program)} semanas al abrir)` : ""}.</p>
            : <Field label="Duración (días)" htmlFor={`dd-${k}`}><input id={`dd-${k}`} name="days" type="number" required min={1} max={365} value={days} onChange={(e) => resize(Number(e.target.value))} className={inputSm} /></Field>}
          <Field label="Minutos al día" htmlFor={`m-${k}`}><input id={`m-${k}`} name="minutes" type="number" required min={1} max={240} defaultValue={init.minutes} className={inputSm} /></Field>
          <Field label="Dificultad" htmlFor={`df-${k}`}><select id={`df-${k}`} name="difficulty" defaultValue={init.difficulty} className={sel}>{Object.entries(DIFFICULTY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          {!isProg && <Field label="Cómo se cumple" htmlFor={`v-${k}`}><select id={`v-${k}`} name="verify" value={verify} onChange={(e) => setVerify(e.target.value)} className={sel}>{Object.entries(VERIFY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>}
          {!isProg && verify === "steps" && <Field label="Meta de pasos" htmlFor={`sg-${k}`}><input id={`sg-${k}`} name="steps_goal" type="number" min={1000} max={50000} step={500} defaultValue={init.stepsGoal ?? 10000} className={inputSm} /></Field>}
          {!isProg && <Field label="Comodines" htmlFor={`g-${k}`} hint="Días que se pueden fallar"><input id={`g-${k}`} name="grace" type="number" min={0} max={60} defaultValue={init.grace} className={inputSm} /></Field>}
          <Field label="Orden" htmlFor={`o-${k}`} hint="Menor = más arriba"><input id={`o-${k}`} name="sort" type="number" min={0} max={9999} defaultValue={init.sort} className={inputSm} /></Field>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted">Vista previa de portada</p>
          <div className="overflow-hidden rounded-2xl border border-line"><ChallengeCover c={{ cover, icon }} className="h-28" /></div>
          <Field label="Portada" htmlFor={`c-${k}`}><select id={`c-${k}`} name="cover" value={cover} onChange={(e) => setCover(e.target.value as CoverStyle)} className={sel}>{COVERS.map((c) => <option key={c} value={c}>{COVER_LABEL[c]}</option>)}</select></Field>
          <Field label="Ícono" htmlFor={`i-${k}`}><select id={`i-${k}`} name="icon" value={icon} onChange={(e) => setIcon(e.target.value)} className={sel}>{ICONS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink"><input type="checkbox" name="featured" defaultChecked={init.featured} className="size-4 accent-[#1B1505]" />Destacado (aparece primero)</label>
        </div>
      </section>

      <section className={`${panel} grid gap-3 p-4 sm:p-5 sm:grid-cols-2 lg:grid-cols-4`} aria-label="Precio, recompensas e inicio">
        <h2 className="font-extrabold text-ink sm:col-span-2 lg:col-span-4">Precio, recompensas e inicio</h2>
        <Field label="Precio en USD" htmlFor={`p-${k}`} hint="0 = gratis. Mínimo $0.50 si es de pago"><input id={`p-${k}`} name="price_usd" type="number" min={0} max={200} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className={inputSm} /></Field>
        <Field label="ID de precio de ONVO (opcional)" htmlFor={`op-${k}`} hint="Referencia del producto en ONVO; el cobro usa el precio de aquí"><input id={`op-${k}`} name="onvo_price_id" maxLength={80} defaultValue={init.onvoPriceId ?? ""} disabled={!Number(price)} className={inputSm} /></Field>
        <Field label="XP al completar" htmlFor={`x-${k}`} hint={`Máximo ${MAX_CHALLENGE_XP}`}><input id={`x-${k}`} name="xp" type="number" required min={0} max={MAX_CHALLENGE_XP} defaultValue={init.xp} className={inputSm} /></Field>
        <Field label="Medalla" htmlFor={`b-${k}`}><input id={`b-${k}`} name="badge" required minLength={3} maxLength={60} defaultValue={init.badge} className={inputSm} /></Field>
        <Field label="Título de recompensa (opcional)" htmlFor={`rt-${k}`}><input id={`rt-${k}`} name="reward_title" maxLength={40} defaultValue={init.rewardTitle ?? ""} className={inputSm} /></Field>
        <Field label="Inicio" htmlFor={`sm-${k}`}><select id={`sm-${k}`} name="start_mode" value={startMode} onChange={(e) => setStartMode(e.target.value as "libre" | "fecha")} className={sel}><option value="libre">Cuando quieran</option><option value="fecha">Fecha fija</option></select></Field>
        {startMode === "fecha" && <Field label="Fecha de inicio" htmlFor={`sd-${k}`} hint="Inscripciones abiertas sus primeros 3 días"><input id={`sd-${k}`} name="start_date" type="date" required defaultValue={init.startDate ?? ""} className={inputSm} /></Field>}
        <label className="flex min-h-11 items-center gap-2 self-end text-sm text-ink"><input type="checkbox" name="coming_soon" defaultChecked={init.comingSoon} className="size-4 accent-[#1B1505]" />Próximamente (sin inscripciones)</label>
        <Field label="Nota de seguridad (opcional)" htmlFor={`sn-${k}`} className="sm:col-span-2 lg:col-span-4" hint="Se muestra antes del plan. Úsala para retos de peso o alta exigencia"><textarea id={`sn-${k}`} name="safety_note" rows={2} maxLength={600} defaultValue={init.safetyNote ?? ""} className={textareaSm} /></Field>
        {!canSell && Number(price) > 0 && <p className="text-xs text-muted sm:col-span-2 lg:col-span-4">Las ventas y compradores de este reto los ven soporte, admin y superadmin.</p>}
      </section>

      {isProg && <ProgramEditor init={init.program ?? EMPTY_META} sessions={init.sessions} names={init.names} />}

      <section hidden={isProg} className={`${panel} p-4 sm:p-5`} aria-labelledby={`plan-${k}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={`plan-${k}`} className="font-extrabold text-ink">Plan día a día</h2>
          <p className={`text-sm font-semibold tabular-nums ${filled === days ? "text-[#17703A]" : "text-muted"}`}>{filled} de {days} días con tarea</p>
        </div>
        <p className="mt-1 text-sm text-muted">Una tarea por día. Los retos de pago muestran los primeros 3 días antes de comprar. Para publicar, todos los días necesitan tarea.</p>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <fieldset className="rounded-xl border border-line p-3">
            <legend className="px-1 text-xs font-bold text-ink">Progresión</legend>
            <label className="block text-xs text-muted" htmlFor={`tp-${k}`}>Texto ({"{n}"} = número del día)</label>
            <input id={`tp-${k}`} value={tpl} onChange={(e) => setTpl(e.target.value)} className={`${inputSm} mt-1`} />
            <div className="mt-2 grid grid-cols-3 gap-2">
              <input aria-label="Desde" type="number" value={from} onChange={(e) => setFrom(Number(e.target.value))} className={inputSm} />
              <input aria-label="Hasta" type="number" value={to} onChange={(e) => setTo(Number(e.target.value))} className={inputSm} />
              <select aria-label="Tipo" value={tplType} onChange={(e) => setTplType(e.target.value as TaskType)} className={sel}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
            </div>
            <button type="button" onClick={progression} className={`${btnGhost} mt-2 w-full`}><ArrowsLeftRight className="size-4" />Llenar {days} días</button>
          </fieldset>
          <fieldset className="rounded-xl border border-line p-3">
            <legend className="px-1 text-xs font-bold text-ink">Repetir patrón</legend>
            <label className="block text-xs text-muted" htmlFor={`cy-${k}`}>Repite los primeros N días hasta el final</label>
            <input id={`cy-${k}`} type="number" min={1} max={days} value={cycle} onChange={(e) => setCycle(Number(e.target.value))} className={`${inputSm} mt-1`} />
            <button type="button" onClick={repeat} className={`${btnGhost} mt-2 w-full`}><Repeat className="size-4" />Repetir cada {cycle} días</button>
            <button type="button" onClick={fillDown} className={`${btnGhost} mt-2 w-full`}><Copy className="size-4" />Rellenar vacíos con el día anterior</button>
          </fieldset>
          <fieldset className="rounded-xl border border-line p-3">
            <legend className="px-1 text-xs font-bold text-ink">Descansos</legend>
            <label className="block text-xs text-muted" htmlFor={`re-${k}`}>Un descanso cada N días</label>
            <input id={`re-${k}`} type="number" min={2} max={30} value={restEvery} onChange={(e) => setRestEvery(Number(e.target.value))} className={`${inputSm} mt-1`} />
            <input aria-label="Texto del descanso" value={restText} onChange={(e) => setRestText(e.target.value)} className={`${inputSm} mt-2`} />
            <button type="button" onClick={rest} className={`${btnGhost} mt-2 w-full`}><Plus className="size-4" />Poner descansos</button>
          </fieldset>
        </div>

        <ol className="mt-4 divide-y divide-line rounded-xl border border-line">
          {rows.map((r, i) => (
            <li key={i} className="grid grid-cols-[2.5rem_1fr] items-start gap-2 p-2 sm:grid-cols-[2.5rem_9rem_6rem_1fr]">
              <span className="grid h-10 place-items-center rounded-lg bg-cream text-sm font-extrabold tabular-nums text-ink" aria-hidden>{i + 1}</span>
              <select aria-label={`Tipo del día ${i + 1}`} value={r.type} onChange={(e) => set(i, { type: e.target.value as TaskType })} className={sel}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
              <input aria-label={`Meta del día ${i + 1}`} type="number" min={0} value={r.target ?? ""} onChange={(e) => set(i, { target: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="Meta" className={`${inputSm} col-start-2 sm:col-start-auto`} />
              <input aria-label={`Tarea del día ${i + 1}`} value={r.t} maxLength={200} onChange={(e) => set(i, { t: e.target.value })} placeholder="Qué hace la persona este día" className={`${inputSm} col-start-2 sm:col-start-auto`} />
            </li>
          ))}
        </ol>
        <button type="button" onClick={clear} className={`${btnGhost} mt-3`}><Trash className="size-4" />Vaciar plan</button>
      </section>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-line bg-white/95 p-3 shadow-soft backdrop-blur">
        <div className="mr-auto min-w-0 text-sm"><Status state={state} /></div>
        <Submit>{init.uuid ? "Guardar reto" : "Crear reto"}</Submit>
      </div>
    </form>
  );
}
