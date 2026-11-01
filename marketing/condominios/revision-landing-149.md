# Revisión de la landing para administraciones

La página prioriza una reunión virtual de 30 minutos para mostrar cómo aprovechar el gimnasio existente. Mantiene la oferta del one-pager, el guion y las respuestas de Harvey: primer mes con entreno y nutrición para todos los residentes, sin tarjeta, solo en Costa Rica. La administración nunca paga; después cada residente decide.

Los cuatro pasos y la privacidad aparecen antes del catálogo de funciones. Banana Burn prepara el enlace, el afiche A4 con QR y el mensaje; la administración comparte el material. Los conteos compartidos son personas que se unieron y personas que entrenaron en la semana, sin acceso al panel interno ni datos personales. Las imágenes son capturas reales de una cuenta de ejemplo, con espacio reservado por proporción; Next Image las optimiza.

## Embudo y dinero

Mueve el paso de prueba: visita de la administración → solicitud de reunión → reunión realizada → condominio activado → residentes que activan sus 30 días. El ingreso llega después, cuando el residente elige y paga su plan.

Medir solicitudes recibidas en /admin/condominios, reuniones agendadas y realizadas, condominios activados, residentes vinculados y quienes entrenaron en la semana. Para atribuir pago al canal, usar la cohorte vinculada al condominio y la consulta de marketing/condominios/fin-mes-gratis.md; contar pagos confirmados y suscripciones vigentes, no solo registros ni el evento del píxel. La conversión final es residentes que pagan dividido entre residentes de la cohorte. Los conteos de entreno no demuestran presencia física en el gimnasio.

Precios de src/lib/plans.ts: Entreno $9.99 mensual o $59.99 anual; Entreno + Nutrición $14.99 mensual o $89.99 anual. Por cada 10 residentes adicionales que pagan mensual, el ingreso bruto sería $99.90 o $149.90 según el plan; si eligen anual, $599.90 o $899.90 por año cobrado. Son cálculos condicionales, no una proyección ni una garantía. Sin datos de conversión y costos no se puede afirmar rentabilidad.

No se incorpora gasto ni se cambia la medición, el píxel, los metadatos SEO o la lógica de cobro. La publicación y cualquier envío quedan sujetos a la aprobación de Andrés.

## Revisión visual pendiente

El encabezado conserva el CTA de 44 px con duración explícita, antes del contenido, para que aparezca sin desplazamiento a 375 px de ancho. Revisar en navegador a 375 × 667 y 375 × 812, también con un nombre de condominio de 60 caracteres: botón completo, sin desbordamiento, enlace al formulario y foco visible. No se dispone de navegador en este entorno; no se afirma una medición de LCP. Verificar LCP menor a 2.5 s en móvil antes de publicar.

## Controles de código

Pasaron `npx tsc --noEmit -p .`, `npx eslint src scripts --quiet`, `npx vitest run` (203 archivos, 2,272 pruebas) y `npx next build`. La compilación informa advertencias existentes en archivos ajenos a esta revisión. Los metadatos SEO se compararon con la versión anterior y permanecen idénticos.
