// Banana Burn para condominios: página oculta para administraciones y juntas directivas (se envía por correo).
// noindex y fuera del sitemap y de la navegación. ?c=<nombre> personaliza el saludo (texto plano, 60 caracteres).
// Reglas de texto (libro de marca): tú, sin emojis, sin rayas largas ni cadenas con "·", sin hablar de inteligencia
// artificial, cifras es-419 y nada que no sea verdad hoy. Después del mes gratis cada residente decide si sigue y
// paga su propio plan; la administración y el condominio nunca pagan.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand";
import {
  ArrowRight, Barbell, Buildings, ChatCircle, Check, DeviceMobile, GraduationCap, House, Lock, QrCode,
  Scales, ShieldCheck, Sparkle, TrendUp, Users, UsersThree, type PhosphorIcon,
} from "@/components/icons";
import { PLANS } from "@/lib/plans";
import { money } from "@/lib/copy";
import { TECHNIQUE_COUNT } from "@/lib/exercise-frames";
import { condoName } from "@/lib/condominios";
import { Faq, Marker } from "../(marketing)/parts";
import { LeadForm } from "./lead-form";

export const metadata: Metadata = {
  title: { absolute: "Banana Burn para condominios" },
  description: "Un entrenador personal en el celular para cada residente. El primer mes es gratis para todo el condominio.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const [ENTRENO, COMPLETO] = PLANS;
const CTA = "#reunion";

const PROBLEMS: [PhosphorIcon, string, string][] = [
  [Barbell, "Máquinas que nadie sabe usar", "La mayoría entra, ve los aparatos y no sabe por dónde empezar. Al final usan la caminadora o no vuelven."],
  [Scales, "Un entrenador cuesta caro", "Pagar un entrenador personal todos los meses no está al alcance de todos los residentes, y tampoco es fácil de coordinar."],
  [TrendUp, "Sin plan, la gente deja de ir", "Entrenar sin saber qué hacer ni cuánto peso usar aburre rápido. Sin progreso visible, el gimnasio se queda vacío."],
];

const FEATURES: [PhosphorIcon, string, string][] = [
  [TrendUp, "Un plan que se ajusta solo", "Cada residente recibe su rutina de la semana con series, repeticiones y el peso de cada serie. Si cumple, la próxima vez sube."],
  [Sparkle, "Técnica animada en cada ejercicio", `${TECHNIQUE_COUNT} técnicas animadas por Coach Banana, con los pasos de cada movimiento. Nadie entrena a ciegas.`],
  [ChatCircle, "Coach Banana 24/7", "Un chat que conoce su plan, su peso y sus entrenos. Responde dudas a cualquier hora, sin esperar al entrenador."],
  [GraduationCap, "Aprende a entrenar desde cero", "Un primer entrenamiento guiado y 10 lecciones cortas: qué es una serie, cuánto peso usar, cuánto descansar."],
  [House, "En el gimnasio del condominio o en casa", "El plan se arma con el equipo que hay: máquinas, mancuernas, bandas o sin equipo, en el apartamento."],
];

const STEPS: [string, string][] = [
  ["Reunión virtual de 30 minutos", "Por videollamada te mostramos la app por dentro, te explicamos cómo se implementa y resolvemos las dudas de la administración o la junta directiva."],
  ["Activamos el condominio", "Creamos el acceso del condominio y te damos su enlace, un afiche A4 con código QR para el gimnasio y un mensaje listo para el grupo de residentes."],
  ["Los residentes se registran", "Cada uno entra con el enlace del condominio desde su celular y tiene el primer mes gratis con entreno y nutrición para todos los residentes. Sus 30 días empiezan cuando activa el beneficio, sin tarjeta."],
  ["Cada residente decide", "Al terminar el mes, cada residente decide si sigue y con qué plan, por su cuenta. La administración y el condominio no pagan nada."],
];

const ADMIN_BENEFITS: [PhosphorIcon, string, string][] = [
  [Buildings, "Un gimnasio con un plan para usarlo", "Cada residente sabe qué hacer con el equipo disponible. Un beneficio concreto para presentar a la junta, sin prometer cifras de uso."],
  [Users, "Residentes más contentos", "Cada persona tiene su propio plan, a su nivel y a su ritmo, desde el primer día."],
  [ShieldCheck, "Cero costo de personal", "No hay que contratar entrenadores ni coordinar horarios. La app acompaña a cada residente."],
  [QrCode, "Arranque sencillo", "Te damos el enlace del condominio, un afiche con código QR para el gimnasio y un mensaje listo para el grupo de residentes."],
];

const FAQ: [string, string][] = [
  ["No tengo tiempo para implementarlo. ¿Qué me toca hacer?", "Banana Burn activa el condominio y prepara su enlace exclusivo, el afiche A4 con QR y el mensaje para residentes. Tu parte es compartir el mensaje y colocar el afiche; no cobras ni gestionas planes."],
  ["¿Y si la junta tiene que aprobarlo?", "Puedes invitarla a la reunión. Te dejamos una presentación corta y un resumen de una página para que revise la propuesta antes de decidir."],
  ["¿Y si ya tenemos entrenador?", "La app acompaña al residente con su plan y la técnica de cada ejercicio también los días y horas en que el entrenador no está."],
  ["¿Tiene costo el primer mes?", "No. Durante el primer mes, todos los residentes que se registran con el enlace del condominio usan Banana Burn completo, con entreno y nutrición. No paga la administración ni pagan los residentes, y nadie necesita tarjeta."],
  ["¿Quién paga después?", "Nadie de la administración. Al terminar el mes gratis, cada residente decide si sigue con un plan individual y lo paga por su cuenta. La administración y el condominio nunca pagan."],
  ["¿Qué necesitan los residentes?", "Solo su celular. Banana Burn es una LinkApp: se abre desde el navegador y se instala en la pantalla de inicio en segundos, sin tiendas de apps."],
  ["¿Sirve en el gimnasio del condominio y en casa?", "Sí. Al registrarse, cada residente indica con qué equipo cuenta y el plan se arma con eso: máquinas y pesas del gimnasio, mancuernas o bandas en casa, o sin equipo."],
  ["¿Qué pasa después del mes gratis?", `Cada residente decide. Puede seguir con ${ENTRENO.name} o ${COMPLETO.name}, o dejar de usar la app. No hay ningún cobro automático: nadie deja tarjeta durante el mes gratis.`],
  ["¿Hay contrato de permanencia?", "No pedimos permanencia, igual que en los planes normales. Los detalles del acuerdo con el condominio los dejamos por escrito en la reunión."],
  ["¿Qué pasa con los datos de los residentes?", "Los datos de cada residente son privados: su peso, sus entrenos y su comida solo los ve esa persona. La administración solo recibe cuántos residentes se registraron y cuántos entrenaron en la semana, nunca información personal."],
  ["¿Para qué edades sirve?", "Para personas adultas de cualquier nivel, desde quien nunca ha entrenado hasta quien ya va al gimnasio. Cada plan se ajusta a su nivel."],
];

function Photo({ src, alt, className = "", sizes, priority = false, ratio = "aspect-[3/2]" }: { src: string; alt: string; className?: string; sizes: string; priority?: boolean; ratio?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-[1.75rem] bg-cream shadow-lift ${ratio} ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export default async function Condominios({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const condo = condoName(sp.c);
  return (
    <div className="min-h-dvh bg-paper text-body">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo href="/condominios" compact />
          <a href={CTA} className="btn-primary h-11! px-4! text-sm! sm:px-5!">Agendar reunión de 30 minutos</a>
        </div>
      </header>

      <main id="contenido">
        {/* Portada */}
        <section className="relative overflow-hidden bg-banana">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-6 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pb-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[13px] font-bold text-banana"><Buildings weight="fill" className="size-4" />Condominios en Costa Rica</p>
              {condo && <p className="mt-5 text-lg font-bold text-ink">Hola, administración de {condo}.</p>}
              <h1 className={`${condo ? "mt-2" : "mt-5"} text-[2rem] font-extrabold leading-[1.04] tracking-tight text-ink text-balance sm:text-5xl lg:text-[3.4rem]`}>
                Dale uso al gimnasio de tu condominio.
              </h1>
              <p className="mt-4 max-w-[34rem] text-base leading-relaxed text-ink/85 text-pretty">
                Cada residente recibe una rutina con el equipo que ya tienen y la técnica de cada ejercicio en su celular. La administración y el condominio nunca pagan nada.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a href={CTA} className="btn-primary h-14! px-7! text-base!">Agendar reunión de 30 minutos <ArrowRight weight="bold" className="size-5" /></a>
                <a href="#como-funciona" className="tap inline-flex h-12 items-center justify-center gap-1 px-2 font-bold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">Ver cómo funciona</a>
              </div>
              <ul className="mt-7 grid gap-2.5 text-[15px] font-semibold text-ink sm:grid-cols-2">
                {["Primer mes gratis con entreno y nutrición, sin tarjeta", "Después, cada residente decide si sigue", "Sin costo para la administración ni el condominio", "En el gimnasio del condominio o en casa"].map((t) => (
                  <li key={t} className="flex items-start gap-2"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-banana"><Check weight="bold" className="size-3" /></span>{t}</li>
                ))}
              </ul>
            </div>
            <Photo src="/landing/entreno.png" alt="Captura real de Entreno: repeticiones, peso y técnica de cada ejercicio en una cuenta de ejemplo" sizes="(min-width: 1024px) 360px, 100vw" className="mx-auto w-full max-w-[360px]" priority ratio="aspect-[780/1688]" />
          </div>
        </section>

        {/* Cómo funciona el acuerdo */}
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-20 sm:px-6 sm:pt-24">
          <div className="grid items-start gap-10 lg:grid-cols-1 lg:gap-14">
            <div>
              <Eyebrow>Cómo funciona</Eyebrow>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink text-balance sm:text-4xl">Del primer correo a residentes entrenando, en 4 pasos.</h2>
              <ol className="mt-8 space-y-5">
                {STEPS.map(([t, d], i) => (
                  <li key={t} className="flex gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-base font-extrabold tabular-nums text-banana">{i + 1}</span>
                    <div><h3 className="text-lg font-extrabold text-ink">{t}</h3><p className="mt-0.5 text-pretty">{d}</p></div>
                  </li>
                ))}
              </ol>
              <a href={CTA} className="btn-primary mt-8 h-13! px-6!">Agendar reunión de 30 minutos <ArrowRight weight="bold" className="size-5" /></a>
            </div>
          </div>
        </section>

        {/* Privacidad */}
        <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
          <div className="flex flex-col gap-4 rounded-[1.5rem] bg-white p-6 ring-1 ring-line sm:flex-row sm:items-center">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-ink text-banana"><Lock weight="duotone" className="size-6" /></span>
            <p className="text-pretty"><b className="text-ink">Los datos de cada residente son privados.</b> Su peso, sus entrenos y su comida solo los ve esa persona. Te compartimos solo dos conteos: cuántos residentes se unieron y cuántos entrenaron en la semana. Sin nombres, datos personales ni detalles de sus entrenamientos. La administración no accede al panel interno de Banana Burn.</p>
          </div>
        </section>

        {/* El problema */}
        <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-24">
          <div className="grid items-center gap-10 lg:grid-cols-1 lg:gap-14">
            <div>
              <Eyebrow>El reto de todo condominio</Eyebrow>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink text-balance sm:text-4xl">El gimnasio está ahí. <Marker>Ayuda a que sepan usarlo.</Marker></h2>
              <div className="mt-7 space-y-4">
                {PROBLEMS.map(([I, t, d]) => (
                  <div key={t} className="flex gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-banana-soft text-banana-ink"><I weight="duotone" className="size-6" /></span>
                    <div><h3 className="font-extrabold text-ink">{t}</h3><p className="mt-0.5 text-pretty">{d}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Lo que reciben los residentes */}
        <section className="mt-20 bg-ink py-20 text-white sm:mt-24 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-[12px] font-bold uppercase tracking-[.14em] text-banana">Lo que recibe cada residente</p>
            <h2 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Una guía para saber qué entrenar y cómo hacerlo.</h2>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(([I, t, d]) => (
                <li key={t} className="rounded-[1.5rem] bg-white/[.06] p-5 ring-1 ring-white/10">
                  <span className="grid size-11 place-items-center rounded-2xl bg-banana text-ink"><I weight="duotone" className="size-6" /></span>
                  <h3 className="mt-4 text-lg font-extrabold leading-snug">{t}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-white/75 text-pretty">{d}</p>
                </li>
              ))}
            </ul>
            <figure className="mx-auto mt-10 max-w-[300px]">
              <Photo src="/landing/hoy2.png" alt="Captura real de Hoy con el entrenamiento del día" sizes="300px" ratio="aspect-[780/1688]" />
              <figcaption className="mt-3 text-sm text-white/80">Captura real de la app. Datos de una cuenta de ejemplo.</figcaption>
            </figure>
          </div>
        </section>

        {/* Beneficios para la administración */}
        <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-24">
          <div className="grid items-center gap-10 lg:grid-cols-1 lg:gap-14">
            <div>
              <Eyebrow>Para la administración</Eyebrow>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink text-balance sm:text-4xl">Nosotros preparamos el material. Tú lo compartes.</h2>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {ADMIN_BENEFITS.map(([I, t, d]) => (
                  <li key={t} className="card p-5">
                    <span className="grid size-11 place-items-center rounded-2xl bg-banana-soft text-banana-ink"><I weight="duotone" className="size-6" /></span>
                    <h3 className="mt-3 text-lg font-extrabold text-ink">{t}</h3>
                    <p className="mt-1 text-[15px] text-pretty">{d}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Inversión */}
        <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-24">
          <div className="rounded-[2rem] bg-cream p-6 ring-1 ring-line sm:p-10">
            <div className="max-w-3xl">
              <Eyebrow>Inversión</Eyebrow>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink text-balance sm:text-4xl">El primer mes es gratis para todos. Después, cada residente decide.</h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] bg-banana p-6">
                <p className="text-sm font-bold text-ink/80">Primer mes</p>
                <p className="mt-1 text-5xl font-extrabold tabular-nums text-ink">$0</p>
                <p className="mt-2 font-semibold text-ink">Para todos los residentes, con la app completa.</p>
              </div>
              {[ENTRENO, COMPLETO].map((p) => (
                <div key={p.id} className="rounded-[1.5rem] bg-white p-6 ring-1 ring-line">
                  <p className="text-sm font-bold text-muted">Plan individual del residente</p>
                  <p className="mt-1 text-xl font-extrabold text-ink">{p.name}</p>
                  <p className="mt-2 font-semibold text-ink">{p.id === "completo" ? "Plan de entreno y plan de comidas para cada residente." : "Plan de entreno, técnica y Coach Banana para cada residente."}</p>
                  {!p.nutrition && <p className="mt-2 text-sm text-muted"><span className="sr-only">No incluye: </span><s>Plan de comidas</s></p>}
                  <p className="mt-3 text-sm text-muted">{money(p.price.mes)} al mes, solo si el residente decide seguir.</p>
                </div>
              ))}
            </div>
            <p className="mt-6 flex items-start gap-2 text-[15px] text-ink"><UsersThree weight="duotone" className="mt-0.5 size-5 shrink-0 text-banana-ink" />La administración y el condominio no pagan nada, ni durante el mes gratis ni después. Cada residente decide por su cuenta si sigue.</p>
          </div>
        </section>

        <Faq items={FAQ} id="preguntas" />

        {/* Formulario */}
        <section id="reunion" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20 pt-20 sm:px-6 sm:pt-24">
          <div className="grid gap-8 rounded-[2rem] bg-banana p-6 sm:p-10 lg:grid-cols-[.9fr_1.1fr] lg:gap-12">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-ink text-balance sm:text-4xl">Agenda una reunión virtual de 30 minutos.</h2>
              <p className="mt-4 text-lg text-ink/85 text-pretty">Déjanos tus datos y el día y la hora que prefieres. Te confirmamos en menos de 24 horas hábiles y te enviamos el enlace de la videollamada.</p>
              <ul className="mt-6 space-y-3 font-semibold text-ink">
                <li className="flex gap-2.5"><DeviceMobile weight="duotone" className="size-6 shrink-0" />Te mostramos el sistema y cómo se implementa</li>
                <li className="flex gap-2.5"><Barbell weight="duotone" className="size-6 shrink-0" />Vemos cómo aprovechar el gimnasio que ya tienen</li>
                <li className="flex gap-2.5"><QrCode weight="duotone" className="size-6 shrink-0" />Te explicamos el enlace, el afiche con QR y el mensaje para los residentes</li>
              </ul>
              <p className="mt-6 text-sm text-ink/75">¿Prefieres escribirnos? <a href="mailto:hola@bananaburn.app?subject=Banana%20Burn%20para%20condominios" className="font-bold text-ink underline underline-offset-2">hola@bananaburn.app</a></p>
            </div>
            <LeadForm condo={condo} />
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Banana Burn es un producto de Atlas Resources SRL, Costa Rica.</p>
          <p className="flex gap-4"><Link href="/privacidad" className="tap underline underline-offset-2">Privacidad</Link><Link href="/terminos" className="tap underline underline-offset-2">Términos</Link></p>
        </div>
      </footer>
    </div>
  );
}
