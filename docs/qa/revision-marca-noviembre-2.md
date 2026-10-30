# Revisión de marca para noviembre (segunda entrega)

Revisión del 30 de octubre de 2026 para #118. Referencia: manual de marca, landing y UX; tokens de `src/app/globals.css`. Las líneas indican la versión corregida de esta entrega. Se distingue la corrección aplicada de las pendientes de recursos visuales.

## Hallazgos

| Archivo | Línea | Qué decía | Qué debería decir / corrección aplicada | Gravedad |
| --- | ---: | --- | --- | --- |
| `src/app/(app)/app/suscripcion/plan-wall.tsx` | 58 | «Incluye Banana Shield, que usaste en tu prueba» | «Incluye Banana Shield para acompañar tu entrenamiento». El perfil GLP-1 no acredita uso del programa. Corregido sin cambiar la recomendación. | Media |
| `src/app/(app)/app/suscripcion/plan-wall.tsx` | 80 | «Cambia tu tarjeta en Mi plan y sigues hoy, sin perder nada.» | «Revisa tu tarjeta y el estado del pago en Mi plan. Tu progreso queda guardado.» No garantiza acceso inmediato antes de confirmar el pago. | Alta |
| `src/app/(app)/app/suscripcion/plan-wall.tsx` | 85 | `<Pricing compact recommended={rec} loggedIn reason={reason} />` sin aviso médico visible fuera del detalle desplegable | Se añade debajo «Banana Shield para GLP-1: No sustituye la indicación de tu médico.» (línea 86), visible sin abrir detalles. | Alta |
| `src/app/(app)/app/suscripcion/trial-banner.tsx` | 10 | `border-ember/30 bg-ember/5`, icono `text-ember-ink` | `border-banana/60 bg-banana-soft`, icono `text-banana-ink`. El último día usa banana; ember se reserva para los usos del manual. No cambian días, mensajes ni eventos. | Baja |
| `docs/emails/secuencia-prueba.md` | 53 | «Elige hoy cómo quieres seguir» | «Elige cómo quieres seguir»; cuerpo «Revisa qué opción se adapta a ti» (59) y variante A coherente (93). Evita presión de decidir ese día cuando el vencimiento depende de la cuenta. | Media |
| `src/app/(marketing)/glp1/page.tsx` | 56 | `src="/brand/mascota-sola.webp"` en hero; las secciones posteriores no tienen poses | Pendiente visual: el hero usa la pose local de pie, no flex; faltan poses distintas en las otras secciones según la guía. Se requieren los originales oficiales y revisión de composición; no se inventan ni repiten personajes. Esta entrega no añade imágenes. | Baja |

## Cobertura y comprobaciones de contenido

Se revisó el único archivo de `/glp1`, ambos componentes de suscripción y la secuencia completa, además de sus fuentes visibles `Pricing`, `Phone`, FAQ, `copy.ts`, `plans.ts` y tokens globales.

- `/glp1` conserva CTA «Empieza 7 días gratis», enlaces visibles «Continuar sin tarjeta», ausencia de tarjeta obligatoria y aviso médico en hero, método, hábitos, planes, cierre y FAQ/JSON-LD. Las acciones de pago y de usuarios ya registrados conservan sus etiquetas específicas; no se ofrece otra prueba desde el muro bloqueado.
- La captura `/landing/entreno-top.webp` es de la app y se rotula como ejemplo que no muestra Banana Shield (línea 65). No se sustituye por una interfaz inventada. `Phone` reserva proporción 390/844 y la mascota tiene dimensiones fijas. No se añadieron archivos pesados ni solicitudes externas.
- Paper #FFF8E3, banana #FFD60A e ink #1B1505 coinciden con CSS; Plus Jakarta Sans se hereda globalmente. Los colores semánticos de éxito y error se conservan. Los excluidos de Entreno están tachados por `Pricing`, también en su detalle compacto.
- No se encontraron emojis, menciones comerciales de IA, testimonios, escasez inventada, rayas largas, trato de usted ni formatos monetarios con coma decimal en los textos revisados. Las cuentas regresivas del banner proceden de días reales de prueba, no de un contador comercial ficticio.
- Los correos usan acciones para una cuenta existente: Ver mi entreno, Ver qué incluye mi plan y Revisar mi plan. No corresponde reemplazarlas por un CTA de registro. Conservan la convivencia con transaccionales, la baja y la aprobación previa de Andrés; no se implementan envíos.
- Precios, ahorro anual y temporada incluida concuerdan con `plans.ts`. No cambian lógica, condiciones, precios, endpoints, fechas, selección de plan, cobro ni instrumentación.

La revisión es de código y contenido. No se midieron LCP móvil ni contraste renderizado, ni se verificaron estados en navegador; no se certifica LCP < 2.5 s. Pendiente actualizar capturas de `/app/suscripcion` con muro GLP-1 y pago rechazado, y del aviso del último día en las pantallas que lo muestran. La pendiente de poses requiere recursos oficiales antes de una revisión visual completa.

## Rentabilidad y medición

Paso principal: prueba a pago; apoyo a plan más alto y anual desde `/glp1` y el correo del día 6. La corrección busca una decisión informada sobre lo incluido y el estado del pago. No se atribuye un aumento de conversión sin datos.

Medir usuarios únicos de cada cohorte de prueba que llegan a primer cobro confirmado, con `trial_charges.status = 'succeeded'` para fin de prueba, conciliando pagos directos con proveedor y suscripción. Esperar a que termine la prueba y madure la ventana de 14 días propuesta en la secuencia. Comparar cohortes equivalentes antes/después de un despliegue autorizado; contar suscripciones vigentes para la meta de 100 usuarios de pago activos. Desglosar Entreno/Entreno + Nutrición y mensual/anual. `plan_wall_view`, `trial_banner_view` y clics son señales auxiliares; no equivalen a dinero ni prueban causalidad. La secuencia sigue siendo una propuesta sin atribución implementada.

Escenarios aritméticos a precios regulares de `src/lib/plans.ts`, no previsiones ni ingresos netos:

| Movimiento | Importe regular en USD, IVA incluido |
| --- | --- |
| Un nuevo pago mensual | Entreno $9.99; Entreno + Nutrición $14.99 |
| Un nuevo pago anual | Entreno $59.99; Entreno + Nutrición $89.99 |
| Elegir el plan más alto | Diferencia de $5.00 por mes o $30.00 por año |
| 100 usuarios mensuales, todos en el mismo plan | $999.00 o $1,499.00 por mes |
| 100 pagos anuales, todos en el mismo plan | $5,999.00 o $8,999.00 cobrados por año; no es ingreso mensual |

El anual ahorra al cliente $59.89 o $89.89 frente a 12 mensualidades regulares: adelanta el cobro a cambio de menor importe anual. Estos escenarios excluyen promociones; el primer mes con tarjeta puede tener descuento y los ingresos reales deben salir de cobros confirmados. No se conoce aquí el gasto total ni comisiones, impuestos netos, cancelaciones o devoluciones, así que estas cifras no demuestran rentabilidad ni cuánto cubrirían de gasto.

Sin nuevas dependencias, campañas ni gasto contratado. Nada se publica, envía ni despliega; esas decisiones corresponden a Andrés.

## Validación técnica

Checks terminados con código de salida 0:

- `npx tsc --noEmit -p .`
- `npx eslint src scripts --quiet`
- `npx vitest run`: 176 archivos y 2,017 pruebas aprobados.
- `npm run build`: compilación, validación de tipos y generación de páginas completadas.
- `git diff --check`: sin errores.

El build muestra avisos de caché de webpack y advertencias de lint en `src/app/actions/meals.ts`, `src/app/admin/contenido/page.tsx` y `src/components/programas/program-week.tsx`, archivos sin cambios en esta entrega. No impiden la compilación.
