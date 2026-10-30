Este tablero permite detectar fugas en registro > primer entreno > tarjeta guardada > primer pago y priorizar acciones hacia 100 usuarios de pago. Aporta medición diaria; no implica una mejora de conversión ya observada. Sirve a Andrés y al equipo para decidir qué paso requiere atención.

Cómo se mide: Andrés ejecuta `docs/metas/tablero-diario.sql` cada mañana en Supabase siguiendo `docs/metas/tablero-diario.md`. La consulta es de solo lectura y devuelve una fila por cohorte diaria de creación de cuenta, con su avance observado al ejecutar:

- Registro: personas con bienvenida terminada (`onboarding_done`), separado de cuentas creadas; meta de 285 registros completos.
- Primer entreno: cuentas con al menos un `workouts.finished_at` no nulo.
- Tarjeta guardada: existencia de una fila en `trial_charges`, como en la etapa 5 de `marketing/estrategia/embudo-noviembre.md`.
- Primer pago: usuarios únicos con `trial_charges.status = 'succeeded'` o suscripción pagada vigente, sin duplicar ambas fuentes y excluyendo cortesías vigentes.
- Prueba a pago: registros completos que pagan ÷ registros completos × 100; meta de 35 % (modelo del embudo: 40 % de tarjetas × 88 % de cobros = 35.2 %).
- Costo por cliente que paga: gasto de Meta ingresado manualmente para el período de adquisición ÷ usuarios de pago de esas cohortes; meta de US$14.98 o menos. Es una lectura total, incluido orgánico, sin atribución por anuncio. Datos faltantes quedan pendientes, no se inventan.

Los registros completos anteriores al 28 de octubre quedan pendientes por falta de cobertura de eventos. Las cohortes con pruebas en curso aún no tienen conversión final. El conteo acredita primer pago; no equivale a suscriptores activos retenidos.

Validación: QA reportó 1,816 pruebas aprobadas, TypeScript y ESLint correctos y 10 pruebas SQL de ejecución de solo lectura, incluidas las tres añadidas en `4a808f2`, que se conservan. Sigue pendiente ejecutar en Supabase real y conciliar con Tilopay y ONVO. Playwright quedó bloqueado por la descarga de Chromium (HTTP 403).

Closes #67

Worked by Martín (marketing-y-ads, ChatGPT gpt-6.1-sol) in AI Office ([live view](http://localhost:3045/floors/banana-burn/agents/2c0d9099-42f9-4fba-956d-77ceab489aac)).
