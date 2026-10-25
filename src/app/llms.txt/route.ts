import { faq } from "@/app/(marketing)/content";
import { offer } from "@/lib/offer";
import { SITE_URL } from "@/lib/env";
import { PLANS, PREMIUM_RETOS_NOTE } from "@/lib/plans";
import { money } from "@/lib/copy";

// Se regenera cada hora como las páginas públicas: el texto de la prueba cambia solo con el fin de la beta (offer.ts).
export const revalidate = 3600;

/** Resumen factual para asistentes de IA (GEO): qué es, para quién, precios reales y preguntas frecuentes. */
export function GET() {
  const plans = PLANS.map((p) => `- ${p.name}: ${money(p.price.mes)} USD al mes o ${money(p.price.anual)} USD al año. ${p.tagline}. Incluye: ${p.feats.join("; ")}.${p.excluded.length ? ` No incluye: ${p.excluded.join("; ")}.` : ""}`).join("\n");
  const o = offer();
  const faqText = faq().map(([q, a]) => `### ${q}\n${a}`).join("\n\n");
  const body = `# Banana Burn

> App de recomposición corporal en español que reemplaza al entrenador personal, pensada para personas que bajaron rápido de peso. Rutina de gym, casa o sin equipo ajustada a tu nivel, el peso sugerido de cada serie, técnica animada, Coach Banana para tus dudas y nutrición con comida latina. ${o.llms}

Banana Burn es una LinkApp (marca registrada en Costa Rica, usada con permiso): una app que se abre desde el navegador y se instala en la pantalla de inicio de iPhone o Android en segundos, sin tiendas de apps. Instalada, envía recordatorios de entreno y avisos del coach. La opera Atlas Resources SRL desde San José, Costa Rica, para usuarios de México, Centroamérica, el Caribe, Sudamérica, hispanos en Estados Unidos y España.

## Qué hace
- Arma tu rutina del día según tu objetivo (bajar grasa, recomposición o ganar fuerza), días por semana (3 a 6), minutos por sesión (15 a 60), equipo (gym, casa o sin equipo) y nivel.
- Sugiere el peso de cada serie y lo ajusta con doble progresión según tus series y tu esfuerzo.
- Muestra la técnica de cada ejercicio con una animación del mono Banana Burn, tempo y claves.
- Coach Banana responde tus dudas en español y conoce tu plan, tu peso y tus entrenos.
- Registro de agua, pasos y sueño; progreso de peso, medidas, fuerza y fotos.
- Retos gratis, rachas, niveles y comunidad.
- Programas para chicas con Coach Platanita (por ejemplo Pilates en casa 30 días), que guía la técnica y responde en el chat.
- Primer mes del plan mensual con 50 % de descuento si la persona deja su tarjeta lista antes de su primer cobro (una vez por cuenta).
- En el plan Entreno + Nutrición: metas de calorías y macros, registro de comidas con platos típicos de Latinoamérica, recetas y ajuste semanal según el peso real.
- En el plan Entreno + Nutrición: Banana Shield, programa para quienes usan medicamentos GLP-1 (Ozempic, Wegovy, Mounjaro) que prioriza fuerza y proteína para cuidar el músculo. No da indicaciones sobre el medicamento.

## Precios (USD)
${plans}
- ${PREMIUM_RETOS_NOTE}
- ${o.llms} Pago con tarjeta de crédito o débito procesado por ONVO Pay (Costa Rica) o Tilopay (otros países). Se cancela cuando quieras.

## Enlaces
- Inicio: ${SITE_URL}/
- Precios: ${SITE_URL}/precios
- Banana Shield (GLP-1): ${SITE_URL}/glp1
- Términos: ${SITE_URL}/terminos
- Privacidad: ${SITE_URL}/privacidad
- Contacto: hola@bananaburn.app

## Preguntas frecuentes
${faqText}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
