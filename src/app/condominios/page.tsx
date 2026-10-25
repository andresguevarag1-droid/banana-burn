// Banana Burn para condominios: página oculta para administraciones y juntas directivas (se envía por correo).
// noindex y fuera del sitemap y de la navegación. ?c=<nombre> personaliza el saludo (texto plano, 60 caracteres).
// Reglas de texto (libro de marca): tú, sin emojis, sin rayas largas ni cadenas con "·", sin hablar de inteligencia
// artificial, cifras es-419 y nada que no sea verdad hoy. Paga el condominio, no el residente: los precios públicos
// solo aparecen como precio individual de referencia.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand";
import {
  ArrowRight, Barbell, Buildings, ChatCircle, Check, DeviceMobile, GraduationCap, Heart, House, Lock, PersonSimpleRun, QrCode,
  Scales, ShieldCheck, Sparkle, Medal, TrendUp, Users, UsersThree, WhatsappLogo, type PhosphorIcon,
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

const ART = "https://d8j0ntlcm91z4.cloudfront.net/user_3KlOTMXim7g88SAyF4A03SG6JZ6/";
const IMG = {
  hero: `${ART}hf_20261025_214205_d03095ef-3441-465e-9057-0446029d9e3a.png`,
  guia: `${ART}hf_20261025_214121_538ba51e-8722-41d5-85da-f5951e2e11d5.png`,
  grupo: `${ART}hf_20261025_214121_e0315960-446f-4ba7-9ea6-0b28fb40c7ed.png`,
  afiche: `${ART}hf_20261025_214205_636537cf-3f73-4d61-8903-b0f49949b61b.png`,
  casa: `${ART}hf_20261025_214121_881da3e3-030a-481e-a0b9-aaaffdb70af2.png`,
  platanita: `${ART}hf_20261025_214122_81aa647a-4b3b-41b7-9240-a0a5b93c0fd3.png`,
  reunion: `${ART}hf_20261025_214332_0f623e5a-ab16-4185-8088-b518651d501a.png`,
  residentes: `${ART}hf_20261025_214332_16176338-d80f-45e8-bec1-693a2ee196fe.png`,
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
  [Heart, "Programas de Coach Platanita", "Programas para mujeres con su propia coach, como Pilates en casa, que transforman la app mientras duran."],
  [Medal, "Temporadas deportivas", "Temporadas de 8 semanas para running, raquetas o cross training, armadas alrededor de sus días de deporte."],
  [PersonSimpleRun, "Carreras con GPS", "Registra sus carreras con el GPS del celular: distancia, ritmo por kilómetro y recorrido privado."],
];

const STEPS: [string, string][] = [
  ["Reunión virtual de 30 minutos", "Por videollamada te mostramos la app por dentro, te explicamos cómo se implementa y resolvemos las dudas de la administración o la junta directiva."],
  ["Activamos el condominio", "Creamos el acceso del condominio y te damos su enlace, un afiche con código QR para el gimnasio y un mensaje listo para el grupo de WhatsApp."],
  ["Los residentes se registran", "Cada uno entra con el enlace del condominio desde su celular y tiene el primer mes gratis con todo incluido. Toma 2 minutos y no necesita tarjeta."],
  ["El condominio elige su plan", "Al terminar el mes, el condominio elige el plan que quiere pagar para sus residentes. Los residentes no pagan nada por su cuenta."],
];

const ADMIN_BENEFITS: [PhosphorIcon, string, string][] = [
  [Buildings, "Un amenity que suma valor", "El gimnasio deja de ser un cuarto con máquinas y se convierte en un servicio que los residentes usan y valoran."],
  [Users, "Residentes más contentos", "Cada persona tiene su propio plan, a su nivel y a su ritmo, desde el primer día."],
  [ShieldCheck, "Cero costo de personal", "No hay que contratar entrenadores ni coordinar horarios. La app acompaña a cada residente."],
  [QrCode, "Arranque sencillo", "Te damos el enlace del condominio, un afiche con código QR para el gimnasio y un mensaje listo para el grupo de WhatsApp."],
];

const FAQ: [string, string][] = [
  ["¿Tiene costo el primer mes?", "No. Durante el primer mes, todos los residentes que se registran con el enlace del condominio usan Banana Burn completo, con entreno y nutrición. No paga la administración ni pagan los residentes, y nadie necesita tarjeta."],
  ["¿Quién paga después?", "El condominio. Al terminar el mes gratis, la administración elige el plan para sus residentes y lo paga directamente con nosotros. Los residentes no pagan de forma individual."],
  ["¿Qué necesitan los residentes?", "Solo su celular. Banana Burn es una LinkApp: se abre desde el navegador y se instala en la pantalla de inicio en segundos, sin tiendas de apps."],
  ["¿Sirve en el gimnasio del condominio y en casa?", "Sí. Al registrarse, cada residente indica con qué equipo cuenta y el plan se arma con eso: máquinas y pesas del gimnasio, mancuernas o bandas en casa, o sin equipo."],
  ["¿Qué pasa después del mes gratis?", `El condominio decide. Puede elegir ${ENTRENO.name} o ${COMPLETO.name} para todos sus residentes, con un precio por residente según el volumen que definimos en la reunión. Si el condominio no continúa, cada residente puede seguir con un plan individual o dejar de usar la app, sin ningún cobro automático.`],
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
          <a href={CTA} className="btn-primary h-11! px-4! text-sm! sm:px-5!">Agendar una reunión virtual</a>
        </div>
      </header>

      <main id="contenido">
        {/* Portada */}
        <section className="relative overflow-hidden bg-banana">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pb-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[13px] font-bold text-banana"><Buildings weight="fill" className="size-4" />Banana Burn para condominios</p>
              {condo && <p className="mt-5 text-lg font-bold text-ink">Hola, administración de {condo}.</p>}
              <h1 className={`${condo ? "mt-2" : "mt-5"} text-[2.35rem] font-extrabold leading-[1.04] tracking-tight text-ink text-balance sm:text-5xl lg:text-[3.4rem]`}>
                Un entrenador personal para cada residente, sin contratar a nadie.
              </h1>
              <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-ink/85 text-pretty">
                Banana Burn convierte el gimnasio del condominio en el amenity más usado: cada residente recibe su plan, la técnica de cada ejercicio y un coach 24/7 en su celular.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a href={CTA} className="btn-primary h-14! px-7! text-base!">Agendar una reunión virtual <ArrowRight weight="bold" className="size-5" /></a>
                <a href="#como-funciona" className="tap inline-flex h-12 items-center justify-center gap-1 px-2 font-bold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">Ver cómo funciona</a>
              </div>
              <ul className="mt-7 grid gap-2.5 text-[15px] font-semibold text-ink sm:grid-cols-2">
                {["Primer mes gratis para todos los residentes", "Después, el condominio elige el plan y lo paga", "Los residentes no pagan ni usan tarjeta", "En el gimnasio del condominio o en casa"].map((t) => (
                  <li key={t} className="flex items-start gap-2"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-banana"><Check weight="bold" className="size-3" /></span>{t}</li>
                ))}
              </ul>
            </div>
            <Photo src={IMG.hero} alt="Coach Banana en el gimnasio de un condominio con vista a la piscina y a las montañas, con el celular en la mano" sizes="(min-width: 1024px) 560px, 100vw" priority />
          </div>
        </section>

        {/* El problema */}
        <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
            <Photo src={IMG.guia} alt="Coach Banana guía a una residente en la máquina de remo del gimnasio del condominio" sizes="(min-width: 1024px) 540px, 100vw" className="order-last lg:order-first" />
            <div>
              <Eyebrow>El reto de todo condominio</Eyebrow>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink text-balance sm:text-4xl">El gimnasio está ahí, pero <Marker>casi nadie lo usa.</Marker></h2>
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
            <h2 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Todo lo que haría un entrenador personal, en el celular de cada persona.</h2>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(([I, t, d]) => (
                <li key={t} className="rounded-[1.5rem] bg-white/[.06] p-5 ring-1 ring-white/10">
                  <span className="grid size-11 place-items-center rounded-2xl bg-banana text-ink"><I weight="duotone" className="size-6" /></span>
                  <h3 className="mt-4 text-lg font-extrabold leading-snug">{t}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-white/75 text-pretty">{d}</p>
                </li>
              ))}
            </ul>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <Photo src={IMG.casa} alt="Un residente entrena con mancuernas en su apartamento mientras Coach Banana lo anima" sizes="(min-width: 768px) 540px, 100vw" />
              <Photo src={IMG.platanita} alt="Coach Platanita guía a una residente en un puente de glúteo con banda en el gimnasio del condominio" sizes="(min-width: 768px) 540px, 100vw" />
            </div>
          </div>
        </section>

        {/* Para todos */}
        <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-24">
          <div className="max-w-3xl">
            <Eyebrow>Para todo el condominio</Eyebrow>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink text-balance sm:text-4xl">Desde quien nunca ha entrenado hasta quien ya va todos los días.</h2>
            <p className="mt-4 text-lg text-pretty">Cada plan se arma con la edad, el nivel, la meta y el tiempo de cada residente. Nadie recibe una rutina genérica.</p>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-2">
            <Photo src={IMG.grupo} alt="Residentes de distintas edades hacen sentadillas en el área verde del condominio junto a Coach Banana" sizes="(min-width: 768px) 540px, 100vw" />
            <Photo src={IMG.residentes} alt="Tres residentes revisan su plan en el celular en el gimnasio del condominio mientras Coach Banana choca la mano con uno de ellos" sizes="(min-width: 768px) 540px, 100vw" />
          </div>
        </section>

        {/* Cómo funciona el acuerdo */}
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-20 sm:px-6 sm:pt-24">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
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
              <a href={CTA} className="btn-primary mt-8 h-13! px-6!">Agendar una reunión virtual <ArrowRight weight="bold" className="size-5" /></a>
            </div>
            <Photo src={IMG.reunion} alt="Coach Banana conversa con la administradora del condominio en el lobby" sizes="(min-width: 1024px) 540px, 100vw" className="lg:mt-10" />
          </div>
        </section>

        {/* Beneficios para la administración */}
        <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_.85fr] lg:gap-14">
            <div>
              <Eyebrow>Para la administración</Eyebrow>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink text-balance sm:text-4xl">Más valor para el condominio, sin trabajo extra para ti.</h2>
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
            <Photo src={IMG.afiche} alt="Coach Banana señala un afiche con código QR en la pared del gimnasio del condominio" sizes="(min-width: 1024px) 420px, 100vw" ratio="aspect-[4/5]" className="mx-auto w-full max-w-md" />
          </div>
        </section>

        {/* Inversión */}
        <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-24">
          <div className="rounded-[2rem] bg-cream p-6 ring-1 ring-line sm:p-10">
            <div className="max-w-3xl">
              <Eyebrow>Inversión</Eyebrow>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink text-balance sm:text-4xl">El primer mes es gratis para todos. Después, paga el condominio.</h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] bg-banana p-6">
                <p className="text-sm font-bold text-ink/80">Primer mes</p>
                <p className="mt-1 text-5xl font-extrabold tabular-nums text-ink">$0</p>
                <p className="mt-2 font-semibold text-ink">Para todos los residentes, con la app completa.</p>
              </div>
              {[ENTRENO, COMPLETO].map((p) => (
                <div key={p.id} className="rounded-[1.5rem] bg-white p-6 ring-1 ring-line">
                  <p className="text-sm font-bold text-muted">Opción para el condominio</p>
                  <p className="mt-1 text-xl font-extrabold text-ink">{p.name}</p>
                  <p className="mt-2 font-semibold text-ink">{p.id === "completo" ? "Plan de entreno y plan de comidas para cada residente." : "Plan de entreno, técnica y Coach Banana para cada residente."}</p>
                  <p className="mt-3 text-sm text-muted">Precio por residente según el volumen. Precio individual de referencia: {money(p.price.mes)} al mes.</p>
                </div>
              ))}
            </div>
            <p className="mt-6 flex items-start gap-2 text-[15px] text-ink"><UsersThree weight="duotone" className="mt-0.5 size-5 shrink-0 text-banana-ink" />El condominio elige el plan y lo paga para sus residentes. El precio por residente según el volumen lo definimos juntos en la reunión virtual.</p>
          </div>
        </section>

        {/* Privacidad */}
        <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
          <div className="flex flex-col gap-4 rounded-[1.5rem] bg-white p-6 ring-1 ring-line sm:flex-row sm:items-center">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-ink text-banana"><Lock weight="duotone" className="size-6" /></span>
            <p className="text-pretty"><b className="text-ink">Los datos de cada residente son privados.</b> Su peso, sus entrenos y su comida solo los ve esa persona. La administración no tiene acceso a información personal de nadie.</p>
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
                <li className="flex gap-2.5"><WhatsappLogo weight="duotone" className="size-6 shrink-0" />Te explicamos el enlace, el afiche con QR y el mensaje para los residentes</li>
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
