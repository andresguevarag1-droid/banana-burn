import { FAQ } from "@/app/(marketing)/content";
import { SITE_URL } from "@/lib/env";
import { PLANS, PREMIUM_RETOS_NOTE } from "@/lib/plans";
import { TRIAL_DAYS, money } from "@/lib/copy";

export const dynamic = "force-static";

/** Resumen factual para asistentes de IA (GEO): qué es, para quién, precios reales y preguntas frecuentes. */
export function GET() {
  const plans = PLANS.map((p) => `- ${p.name}: ${money(p.price.mes)} USD al mes o ${money(p.price.anual)} USD al año. ${p.tagline}. Incluye: ${p.feats.join("; ")}.${p.excluded.length ? ` No incluye: ${p.excluded.join("; ")}.` : ""}`).join("\n");
  const faq = FAQ.map(([q, a]) => `### ${q}\n${a}`).join("\n\n");
  const body = `# Banana Burn

> Entrenador personal con IA en español para toda Latinoamérica. Rutina de gym, casa o sin equipo ajustada a tu nivel, el peso sugerido de cada serie, técnica animada, coach con IA y nutrición con comida latina. Prueba gratis de ${TRIAL_DAYS} días sin tarjeta.

Banana Burn es una app web (PWA) que se instala desde el navegador en iPhone, Android o computadora. La opera Atlas Resources SRL desde San José, Costa Rica, para usuarios de México, Centroamérica, el Caribe, Sudamérica, hispanos en Estados Unidos y España.

## Qué hace
- Arma tu rutina del día según tu objetivo (bajar grasa, recomposición o ganar fuerza), días por semana (3 a 6), minutos por sesión (15 a 60), equipo (gym, casa o sin equipo) y nivel.
- Sugiere el peso de cada serie y lo ajusta con doble progresión según tus series y tu esfuerzo.
- Muestra la técnica de cada ejercicio con una animación del mono Banana Burn, tempo y claves.
- Coach con IA en español que conoce tu plan, tu peso y tus entrenos.
- Registro de agua, pasos y sueño; progreso de peso, medidas, fuerza y fotos.
- Retos gratis, rachas, niveles y comunidad.
- En el plan Entreno + Nutrición: metas de calorías y macros, registro de comidas con platos típicos de Latinoamérica, recetas y ajuste semanal según el peso real.
- En el plan Entreno + Nutrición: Banana Shield, programa para quienes usan medicamentos GLP-1 (Ozempic, Wegovy, Mounjaro) que prioriza fuerza y proteína para cuidar el músculo. No da indicaciones sobre el medicamento.

## Precios (USD)
${plans}
- ${PREMIUM_RETOS_NOTE}
- Prueba gratis de ${TRIAL_DAYS} días con todo incluido, sin tarjeta. Pago con tarjeta de crédito o débito procesado por ONVO Pay. Se cancela cuando quieras.

## Enlaces
- Inicio: ${SITE_URL}/
- Precios: ${SITE_URL}/precios
- Banana Shield (GLP-1): ${SITE_URL}/glp1
- Términos: ${SITE_URL}/terminos
- Privacidad: ${SITE_URL}/privacidad
- Contacto: hola@bananaburn.app

## Preguntas frecuentes
${faq}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
