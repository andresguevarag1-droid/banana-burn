# Revisión de marca para noviembre

Revisión del 30 de octubre de 2026 para #96. Referencia: manual de marca, landing y UX; tokens de `src/app/globals.css`. Las líneas indican la versión corregida de esta entrega. Todas las filas siguientes están corregidas.

## Hallazgos

| Archivo | Línea | Qué decía | Qué debería decir / corrección aplicada | Gravedad |
| --- | ---: | --- | --- | --- |
| `src/app/(marketing)/precios/page.tsx` | 38 | FAQ importada: «para que lo que bajes sea grasa y no músculo» | «combina entrenamiento de fuerza y seguimiento de proteína», con «No sustituye la indicación de tu médico.» también en JSON-LD. No garantiza composición del peso perdido. | Alta |
| `src/app/(marketing)/temporadas/page.tsx` | 24 | «para correr con menos lesiones» | «para complementar tus carreras»; no hay evidencia de reducción de lesiones en usuarios del producto. | Alta |
| `src/app/(marketing)/temporadas/page.tsx` | 24 | «para una zancada más eficiente» | «Ejercicios de potencia y trabajo de tobillo para tu carrera». Describe el trabajo, sin asegurar el resultado. | Media |
| `src/app/(marketing)/temporadas/page.tsx` | 24 | «quedan libres de piernas pesadas» | «Fuerza organizada alrededor de tus carreras largas y clave». El calendario no garantiza ausencia de fatiga. | Media |
| `src/app/(marketing)/temporadas/page.tsx` | 25 | «frenadas más rápidos», «más fuertes», «golpear con más potencia» | «Trabajo de desplazamientos laterales y frenadas», «Ejercicios de hombro, codo y muñeca» y «Trabajo de rotación del tronco». | Media |
| `src/app/(marketing)/temporadas/page.tsx` | 99 | `info.tagline`: «más rápido y con menos lesiones» / «brazo sano» | Texto local en `SPORT_COPY` (líneas 29 a 33): entrenamiento complementario de carrera o partidos. No se altera el catálogo compartido ni los datos de temporada. | Alta |
| `src/app/(marketing)/temporadas/page.tsx` | 39 | «tu opinión arma la siguiente» | «puedes compartir tu opinión al terminar». La opinión no garantiza una futura entrega. | Media |
| `src/app/(marketing)/temporadas/page.tsx` | 50 | «La siguiente temporada llega con ejercicios nuevos…» | «Puedes revisar tus entrenos y los cambios de carga que registraste durante la temporada». No promete contenido futuro. | Media |
| `src/app/(marketing)/temporadas/page.tsx` | 114 | Fondo literal `bg-[#FFEDD5]` en el panel editorial de Running | `bg-banana-soft`, token de marca para el panel. Los acentos de las tarjetas deportivas se conservan como excepción explícita de Temporadas. | Baja |
| `src/app/(app)/app/suscripcion/card-panel.tsx` | 175 | «Versión de prueba» | «Acceso anticipado» en el mismo estado beta, sin cambiar fechas ni condiciones. | Media |
| `src/app/(app)/app/suscripcion/card-panel.tsx` | 121 | «nunca cobramos dos veces» | «No intentes pagar de nuevo mientras lo confirmamos». No se puede garantizar de forma absoluta el comportamiento del procesador externo. | Alta |
| `src/app/(app)/app/suscripcion/page.tsx` | 131 | «No incluidas», sin tachado para Nutrición y Banana Shield | `<s>No incluidas</s>` en la misma condición de acceso; solo cambia la presentación. | Media |
| `src/components/pricing.tsx` | 121 | «Sin riesgo y sin letra pequeña» | «Conoce las condiciones de tu plan». Evita una garantía absoluta en el componente que renderizan las rutas revisadas. | Media |
| `src/components/pricing.tsx` | 122 | Términos «escritos para leerse en cinco minutos» | «para consultar antes de elegir tu plan». No se midió el tiempo de lectura. | Baja |

## Cobertura y comprobaciones de contenido

Se leyeron todos los archivos de las tres carpetas, incluido el test de precios y los estados de carga, tarjeta guardada, cobro pendiente, pago rechazado, cancelación, regalos y muro de planes. Se revisaron además las fuentes visibles: `Pricing`, FAQ compartidas, planes, temporadas, aviso opcional de tarjeta, copy y formateadores numéricos.

- Sin hallazgos de emojis, rayas largas, «banano», menciones comerciales de IA ni trato de usted en el texto estático revisado. Los identificadores, comentarios técnicos y nombres de API no son texto comercial.
- No se encontraron miles con punto ni decimales con coma. Importes usan los formateadores existentes basados en `nfmt`; los pesos del muro usan `es-419`. Fechas y últimos cuatro dígitos de tarjeta no son cantidades decimales.
- Paper, banana e ink coinciden con el manual; Plus Jakarta Sans se hereda del CSS global. Peel, bad, sky y ember se usan como tokens semánticos, no como una marca alternativa. Los acentos naranja, verde azulado y gris de las tarjetas deportivas vienen de `SPORTS`, excepción autorizada por la skill de landing. El rosado corresponde a Coach Platanita.
- Los 7 días, descuentos y ahorros proceden de `plans.ts`, `trial.ts` y sus funciones; las 8 semanas, fechas, pagos únicos y opciones de 2 a 4 sesiones de 30, 45 o 60 minutos corresponden a `seasons.ts` y `season-plan.ts`. No se cambiaron sus valores.
- `/precios` mantiene el aviso médico en su FAQ y bloque GLP-1. «Continuar sin tarjeta» sigue visible en ambas landings y en el aviso de tarjeta de Mi plan durante la prueba. Los botones de pago y recuperación conservan sus acciones y etiquetas específicas del cobro.
- No se añadieron testimonios, contadores ni urgencia. El cierre de inscripciones se basa en fechas reales. Las capturas existentes son archivos reales en `public/landing`; no se añadieron imágenes, dependencias ni solicitudes de red.

Los mensajes de regalos y datos privados que lleguen de la base no se pueden certificar leyendo el repositorio. No se editaron esos datos. No se midieron LCP, contraste renderizado ni pantallas en navegador en esta revisión de código; no se afirma una validación visual. Para actualizar el material visual, recapturar `/app/suscripcion` en estado beta, procesamiento y plan sin nutrición; `/precios` (FAQ/condiciones) y `/temporadas` (tarjetas y panel Running).

## Rentabilidad y medición

Paso del embudo: prueba a pago, con apoyo a visita a registro desde las landings. El cambio aclara qué se compra y elimina garantías que pueden generar expectativas equivocadas. La meta es contribuir a 100 usuarios de pago activos y un negocio rentable; no se atribuye una mejora de conversión sin datos.

Medir la proporción de personas que inician prueba y llegan a un primer cobro real con `trial_charges.status = 'succeeded'`, deduplicadas por usuario, y comprobar suscripciones vigentes para contar usuarios activos. Comparar cohortes equivalentes antes y después de un eventual despliegue autorizado, con ventana de seguimiento suficiente para terminar los 7 días. Como apoyo, revisar los eventos existentes de CTA y vistas de Mi plan; un clic o Meta Subscribe no demuestra por sí solo el cobro automático. Sin nueva instrumentación, campañas, servicios ni costo variable: solo texto y estilos locales.

No se publica, envía, despliega ni modifica campañas o dinero. Esa decisión corresponde a Andrés. Esta entrega no cambia lógica de acceso, precios, cálculos, endpoints ni flujo de cobro.

## Validación técnica

Checks terminados con código de salida 0:

- `npx tsc --noEmit -p .`
- `npx eslint src scripts --quiet`
- `npx vitest run`: 155 archivos y 1,824 tests aprobados, incluidos los tests existentes de precios y Temporadas.
- `npm run build`: compilación y generación de las 29 páginas estáticas completadas.
- `git diff --check`: sin errores.

El build muestra avisos de caché de webpack y tres advertencias de lint preexistentes en `src/app/actions/meals.ts`, `src/app/admin/contenido/page.tsx` y `src/components/programas/program-week.tsx`, fuera de los archivos modificados. No impiden la compilación.
