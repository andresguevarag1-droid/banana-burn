# Acta del kickoff: 100 usuarios de pago

Andrés fijó la meta número 1 de la oficina: **100 usuarios de pago**. Este documento es el acta del arranque: la cuenta hacia atrás, las fechas que cobran pronto, qué hace cada Agente esta semana, quién depende de quién y cómo nos comunicamos. Los Agentes no se reúnen en vivo: se coordinan por los issues, los PRs y este documento.

**Es solo un documento**: no cambia código, campañas, correos ni presupuestos. Revisado contra `main` el viernes 30 de octubre de 2026. Las cifras las vigila `src/lib/metas-100-usuarios-de-pago.test.ts`.

## 1. La meta y la cuenta

**Usuario de pago:** una cuenta con al menos un cobro exitoso, sin testers ni cortesías. En la base: cobro automático con `status = 'succeeded'` en `trial_charges` o suscripción vigente en `subscriptions` (pago a mano en el muro de planes). Los registros y los seguidores no cuentan.

**Conteo actual: [PENDIENTE].** Sale del tablero diario (`docs/metas/tablero-diario.sql`), con instrucciones en [tablero-diario.md](tablero-diario.md). Hasta que Andrés lo corra, nadie pone un número en un PR.

### Cuenta hacia atrás

| Paso | Cifra | Cálculo | Fuente |
| --- | ---: | --- | --- |
| Usuarios de pago | 100 | Meta de la oficina | Andrés |
| Conversión de registro a pago | 35.2 % | 40 % deja la tarjeta × 88 % se cobra bien | `marketing/estrategia/embudo-noviembre.md`, "Resumen" |
| Tarjetas guardadas | 114 | 285 × 40 % | `embudo-noviembre.md`, etapa 5 |
| Registros completos | 285 | 100 ÷ 35.2 % = 284.1, hacia arriba | `embudo-noviembre.md`, etapa 4 |
| Gasto en anuncios al costo real | $287.85 (unos $290) | 285 × $1.01 | Costo por registro de unos $1.01, promedio de la campaña el 28 oct (`embudo-noviembre.md`, "Lo que dice el costo por registro real") |
| Gasto con el mejor anuncio | $182.40 | 285 × $0.64 | Reel "Cuánto peso", misma fuente |
| Costo por cliente que paga al costo real | $2.87 | $1.01 ÷ 35.2 % | `embudo-noviembre.md` |
| Techo por cliente que paga | $14.98 | $4.99 (primer mes de Entreno con 50 %) + $9.99 (segundo mes) | `embudo-noviembre.md` con precios de `src/lib/plans.ts` y `src/lib/trial.ts` |
| Gasto máximo para 100 clientes | $1,498.00 | 100 × $14.98 | Techo, no presupuesto |

Cómo leerla:

- "Registro" es lo mismo que en el embudo: la bienvenida terminada (`CompleteRegistration`), no la cuenta creada.
- El costo de unos $1.01 por registro es de un solo día (28 oct) y lo pasó Andrés desde Ads Manager; no está guardado en el repositorio. Se recalcula con las cifras de noviembre.
- **El riesgo está abajo del embudo, no arriba.** Al costo real, el anuncio se paga aunque solo 6.7 % de los registros llegue a pagar (`embudo-noviembre.md`). Pero sin 40 % de tarjetas y 88 % de cobros, 285 registros no dan 100 clientes.
- $1,498.00 es el máximo que aguanta la meta, no un presupuesto aprobado. El presupuesto lo fija Andrés.

## 2. Fechas que cobran pronto

| Fecha (hora de Costa Rica) | Qué pasa | Fuente |
| --- | --- | --- |
| Dom 1 nov | Lanzamiento: termina la beta. Las cuentas nuevas entran a la prueba de 7 días. | `BETA_ENDS_AT` en `src/lib/plans.ts` |
| Jue 5 nov | Correo de la oferta del 50 % a las cuentas de la beta sin tarjeta (6:00 p. m.). | `marketing/estrategia/correos/08-oferta-50-tarjeta.md` |
| Vie 6 nov | Aviso de 48 horas antes del cobro. | `marketing/estrategia/correos/09-aviso-48h-cobro.md`, `REMINDER_DAYS_BEFORE` en `src/lib/trial.ts` |
| Dom 8 nov | Primer cobro de las cuentas de la beta que dejaron la tarjeta (con el 50 % el primer mes). | `BETA_GRACE_UNTIL` en `src/lib/plans.ts`, `docs/simulacro-cobros.md` |
| Lun 9 nov | Reintento de los cobros rechazados. Empieza la Temporada 1 (8 semanas, hasta el 3 de enero). | `RETRY_AFTER_DAYS` en `src/lib/trial.ts`, `T1_START` en `src/lib/seasons.ts` |
| Dom 22 nov | Cierran las inscripciones a la Temporada 1. | `enrollUntil` en `src/lib/seasons.ts` |
| Todo noviembre | Condominios en Costa Rica: primer mes gratis para los residentes con `/c/<código>`; después cada residente paga su plan. Solo Costa Rica. | `marketing/condominios/kit-implementacion.md` |

## 3. Meta, métrica y tareas de esta semana por Agente

Semana del viernes 30 de octubre al domingo 8 de noviembre. La columna "En main hoy" dice qué ya existe; lo demás es trabajo por hacer y se pide como issue.

| Agente | Paso del embudo | Meta | Métrica | Tareas de la semana | En main hoy |
| --- | --- | --- | --- | --- | --- |
| Martín (Marketing y Ads) | Registros y primer pago | Costo por cliente que paga de $14.98 o menos, y 285 registros | Gasto de Meta ÷ clientes que pagan; registros completos | Tablero diario `docs/metas/tablero-diario.sql` (consultas de solo lectura del embudo y conteo de usuarios de pago) | `marketing/estrategia/embudo-noviembre.md`, `meta-ads-noviembre.md`, `variantes-ab-noviembre.md`. Tablero disponible con instrucciones en docs/metas/tablero-diario.md; falta ejecutarlo en Supabase. |
| Adrian (Coder) | Primer pago y registros | Pagos y referidos medibles | Cobros automáticos que llegan a Meta; registros por referido con su UTM | `Subscribe` desde el servidor en el cobro automático (`src/lib/trial-billing.ts`) y conservar los UTM en `/r/<código>` (`src/app/r/[code]/route.ts`) | Simulacro de cobros (`docs/simulacro-cobros.md`). Hoy el cobro automático no manda evento y `/r/<código>` descarta los UTM. |
| Lucía (Diseño App) | Tarjeta | Tarjeta guardada en 40 % de los registros | Tarjetas en `trial_charges` ÷ registros | Aviso de los días 5 a 7 de la prueba, sin presión, con "Continuar sin tarjeta" siempre visible | El aviso de la beta (`src/components/card-banner.tsx`). El de los días 5 a 7 aún no existe. |
| Mateo (Diseño Landing y Marca) | Visitas y primer pago | Inscripciones a la Temporada 1 antes del 22 de noviembre | Compras de temporada | Mejorar `/temporadas` | `src/app/(marketing)/temporadas/page.tsx` |
| Camila (Ventas B2B Condominios) | Registros | 3 condominios activados en Costa Rica en noviembre | Condominios en estado "Mes gratis" en `/admin/condominios` | Lista de 30 prospectos de Costa Rica para Harvey | Kit en `marketing/condominios/`. La lista aún no existe. |
| Valeria (Instagram) | Visitas | Clics desde Instagram con UTM | Visitas con UTM de Instagram. El UTM orgánico aún no está definido en el repo y la app hoy no guarda UTM sin `?ref=` (`src/components/ref-capture.tsx`): se mide cuando Adrian guarde los UTM de cada visita | Carrusel K16 | K13 a K15 en `marketing/instagram/`. K16 aún no existe. |
| Bruno (Creador de Contenido) | Visitas e inscripciones | Hook rate de 30 % e inscripciones a la Temporada 1 | Reproducciones de 3 s ÷ impresiones | Reel R12 "Últimos días para la Temporada 1" | Guion en `marketing/kit-reels-noviembre-2026.md` y R04 en `marketing/videos/R04_temporada-1/`. R12 aún no está producido. |
| Sofía (Community Manager) | Primer entreno y retención | Primer entreno, retención en la semana 1 y referidos | Cuentas con primer entreno; activas en la semana 1; registros por referido | Plan de comunidad del 1 al 8 de noviembre | Primer entreno corto (`src/lib/engine/index.ts`), piezas de referidos (`marketing/estrategia/referidos/`). El plan aún no existe. |
| Grace (QA) | Registros y primer pago | 0 fallos en el registro y los cobros | Fallos encontrados antes del 1 y el 8 de noviembre | Checklists del 1 y del 8 de noviembre | Formato de checklist en `docs/qa/running-dispositivos.md`. Los dos checklists aún no existen. |
| Linus (Reviewer) y Diego (Revisor de marca) | Todos | Que nada que salga ponga en riesgo un cobro ni la marca | PRs aprobados sin regresiones en cobros ni en marca | Revisar cada PR de la semana contra el código, este documento y el libro de marca | Las pruebas de vitest de cada documento. |

## 4. Quién depende de quién

Solo traspasos que se pueden revisar en `main`. Donde la pieza aún no existe, se dice.

| De | Para | Qué pasa | Qué hay en main |
| --- | --- | --- | --- |
| Adrian | Sofía y Martín | Los referidos de Sofía y el conteo de Martín necesitan los UTM de `/r/<código>`. | Los enlaces de `marketing/estrategia/referidos/compartir.md` llevan `utm_source=referido`, pero `src/app/r/[code]/route.ts` descarta los parámetros al redirigir y `src/components/ref-capture.tsx` solo guarda UTM con `?ref=`. Hoy esos UTM se pierden. |
| Adrian | Martín | Sin `Subscribe` en el cobro automático, Meta no ve los pagos del 8 de noviembre y optimiza a ciegas. | `src/lib/trial-billing.ts` no manda evento (lo vigila `src/lib/embudo-noviembre.test.ts`). Hasta que cambie, Martín cuenta pagos en `trial_charges`. |
| Adrian | Grace | Los checklists del 1 y el 8 de noviembre usan el simulacro de cobros. | `docs/simulacro-cobros.md` y `scripts/simular-cobros.ts`. |
| Martín | Lucía | El aviso de tarjeta de Lucía dice lo mismo que el correo de la oferta del 50 %. | El aviso de la beta (`src/components/card-banner.tsx`) y `marketing/estrategia/correos/08-oferta-50-tarjeta.md` abren con la misma frase: "Deja tu tarjeta lista y paga 50 % menos tu primer mes." El aviso nuevo de los días 5 a 7 tiene que seguirla. |
| Martín | Todos | Las metas de cada paso (40 % de tarjetas, 88 % de cobros, techos por etapa) salen del embudo. | `marketing/estrategia/embudo-noviembre.md`. |
| Valeria y Bruno | Mateo | K16 y R12 llevan a `/temporadas`. | La página existe (`src/app/(marketing)/temporadas/page.tsx`) y R04 ya habla de la Temporada 1. K16 y R12 aún no existen. |
| Valeria y Bruno | Martín | Las piezas alimentan los anuncios. | Ojo: `marketing/estrategia/meta-ads-noviembre.md` deja fuera de los anuncios a R04 y R12 (Temporadas no es uno de los tres públicos). Usarlos en anuncios cambia el plan y necesita el sí de Andrés. |
| Camila | Harvey | La lista de prospectos usa el kit de condominios; la propuesta por correo la manda solo Harvey. | `marketing/condominios/kit-implementacion.md`, `mensajes-sin-correo.md`, `one-pager-junta.pdf` y `presentacion-junta.pdf`. |
| Grace | Linus y Diego | Los checklists dicen qué revisar antes de aprobar lo que toca registro y cobros. | Aún no existen. |

## 5. Cómo se comunica el equipo

- **Cada PR dice qué paso del embudo mueve** (visitas, registros, primer entreno, tarjeta, primer pago o retención), cómo se va a medir y a qué compañero o pieza le sirve.
- **Si una tarea necesita algo de otro Agente**, lo dice en su PR (qué, para qué y para cuándo) y el Manager crea el issue. Nadie trabaja en la parte de otro.
- **Los datos compartidos salen siempre del código o de los documentos de `main`**: precios (`src/lib/plans.ts`, `src/lib/trial.ts`, `src/lib/seasons.ts`), fechas (`BETA_ENDS_AT`, `BETA_GRACE_UNTIL`, `T1_START`), reglas de la prueba (`src/lib/trial.ts`) y de referidos (`src/lib/referrals.ts`, `marketing/estrategia/referidos/reglas.md`). Nunca se copian a mano con otros números; cada documento con cifras tiene su prueba de vitest.
- **Cada lunes**, Andrés corre el tablero diario y el Manager arma los issues de la semana sobre el paso del embudo más débil.

## 6. Reglas que no cambian

- Nada se publica, se envía, se fusiona ni toca campañas o presupuestos sin aprobación de Andrés.
- Nada de testimonios inventados, escasez falsa ni menciones de IA.
- La oferta de condominios (primer mes gratis para todos los residentes) solo en Costa Rica.

## 7. Lo que el equipo necesita de Andrés

1. **El conteo actual de pagos**: correr el tablero diario cuando esté en main.
2. **Las cifras de Ads Manager** del 25 de octubre en adelante: gasto, clics en el enlace, vistas de la página de destino y registros completados por anuncio.
3. **El presupuesto aprobado** de noviembre (el techo de $1,498.00 para 100 clientes no es un presupuesto).
4. **La aprobación de los PRs pendientes**, empezando por lo que toca el registro y el cobro del 8 de noviembre.
