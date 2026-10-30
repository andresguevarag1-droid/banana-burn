# /glp1: de visita a prueba

El cambio mueve visita → registro → prueba: beneficio concreto arriba, 7 días gratis sin tarjeta, funciones actuales de Banana Shield y planes con anual seleccionado primero. El objetivo comercial sigue siendo llegar a 100 usuarios de pago rentables.

Medición con lo existente: vistas `page_view` en `/glp1`, clics `cta_click` con `glp1-hero`, `glp1-sticky`, `glp1-banda`, `glp1-final` y `pricing-*`; esos CTA generan Lead en Meta. `onboarding_done` genera CompleteRegistration, con `trial` indicando el inicio de prueba. Comparar tasas semanales antes y después, no confundir clics con pruebas. La atribución de UTM en Supabase requiere enlaces con `?ref=` válido; sin ese parámetro el sistema actual no guarda UTM. No se cambia esa captura ni el píxel. Los eventos de embudo guardan la ruta sin parámetros.

Para evaluar rentabilidad, seguir primeros pagos reales en `trial_charges` con estado `succeeded` y suscripciones vigentes; el cobro automático de prueba no emite Meta Subscribe. Meta de prueba a pago: 35 %, como objetivo, no resultado observado. Comparar ingresos nuevos semanales con gasto publicitario semanal y costo por usuario de pago. Los agregados de eventos por ruta no permiten por sí solos atribuir todos los pagos a esta landing; usar la atribución disponible sin inventar una cohorte exacta.

No agrega costo: reutiliza precios, comparador, captura real WebP, analítica y CTA fijo existentes; no incorpora proveedores, campañas, dependencias ni solicitudes adicionales de seguimiento. Solo se usa una pose local de Coach Banana, en el hero; no se repite ni se inventan poses ausentes.

Validación visual pendiente en dispositivo: viewport de 375 × 667, beneficio, prueba y botón arriba; foco, enlaces sin tarjeta y barra fija al desplazar. Las imágenes tienen espacio reservado y formatos WebP. El objetivo de LCP móvil es menor a 2.5 s y requiere medición en navegador; un build no demuestra ese tiempo.

No se publica ni se modifican campañas, presupuesto o dinero. El despliegue requiere la aprobación de Andrés. No sustituye la indicación de tu médico.
