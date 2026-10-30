# Embudo de registro a pago: noviembre de 2026

Cómo medimos el camino desde el clic en un anuncio hasta el primer pago del 8 de noviembre, qué meta tiene cada paso y cuánto podemos pagar por cada uno. **Es solo un plan de medición**: no cambia campañas, presupuestos ni código. Lo que pide cambios en la app va como propuesta para el equipo de la app y Andrés lo aprueba.

- **Métrica principal: costo por cliente que paga.** Techo: **US$14.98** (cálculo abajo).
- **Cohorte que se mide:** las cuentas creadas del domingo 25 al sábado 31 de octubre (hora de Costa Rica, UTC-6: de `2026-10-25 06:00 UTC` a `2026-11-01 06:00 UTC`). Son cuentas de la beta: siguen gratis hasta el final del 7 de noviembre y su primer cobro es el **domingo 8 de noviembre** (`BETA_GRACE_UNTIL` en `src/lib/plans.ts`).
- Se relaciona con `marketing/estrategia/meta-ads-noviembre.md` (campaña del 5 al 30 de noviembre) y usa el mismo techo de US$15.

## Resumen

| # | Etapa | Evento o fuente | Partida (25 al 31 oct) | Meta respecto de la etapa anterior | Costo máximo por etapa |
| --- | --- | --- | --- | --- | ---: |
| 1 | Clic en el anuncio | Meta Ads (no hay evento del píxel) | [PENDIENTE] Ads Manager | CTR del enlace de 1.0 % o más (sobre impresiones) | $0.70 por clic |
| 2 | Llegada a la web | Píxel `PageView` y vistas de la página de destino de Meta; `page_view` en `funnel_events` | [PENDIENTE] Ads Manager y Supabase | 75 % de los clics | $0.94 por llegada |
| 3 | "Crear mi plan gratis" | Píxel `Lead` (`cta_click`) | [PENDIENTE] Events Manager y Supabase | 30 % de las llegadas | $3.16 por clic en el botón |
| 4 | Registro | Píxel y API de Conversiones `CompleteRegistration` (`onboarding_done`); Supabase `profiles` | Costo real: **$0.64** (Reel "Cuánto peso") y **unos $1.01** de promedio el 28 oct. Cantidad: [PENDIENTE] | 60 % de los clics en el botón | **$5.27 por registro** |
| 5 | Tarjeta agregada | Píxel `AddPaymentInfo` (`card_saved`); Supabase `trial_charges` | [PENDIENTE] Supabase | 40 % de los registros | $13.18 por tarjeta |
| 6 | Primer pago del 8 de noviembre | Sin evento para el cobro automático; Supabase `trial_charges` y reportes de Tilopay y ONVO | [PENDIENTE] hasta el 8 nov (proyección hoy con la consulta 6) | 88 % de las tarjetas | **$14.98 por cliente que paga** |

De registro a pago, la meta es 40 % × 88 % = **35.2 %**, igual a la meta del equipo de 35 % de prueba a pago.

## Costo máximo por cliente que paga

Precios de `src/lib/plans.ts` y descuento de `src/lib/trial.ts`:

| Plan | Mensual | Primer mes con tarjeta guardada (50 %) | Anual |
| --- | ---: | ---: | ---: |
| Entreno | $9.99 | $4.99 | $59.99 |
| Entreno + Nutrición | $14.99 | $7.49 | $89.99 |

`discountedMinor` redondea hacia abajo al centavo: $9.99 da $4.99 y $14.99 da $7.49. El 50 % solo aplica al plan mensual y solo en el primer cobro (`promoApplies`).

**Regla: el anuncio se paga con los dos primeros cobros del cliente que menos deja.** Ese cliente es el de Entreno mensual que dejó la tarjeta y ganó el 50 %:

> primer mes $4.99 + segundo mes $9.99 = **$14.98**

Por qué esta regla:

- Es el caso más bajo de todos. Entreno + Nutrición deja $7.49 + $14.99 = $22.48, quien paga sin tarjeta en el muro de planes deja $9.99 + $9.99 = $19.98, y el anual cobra $59.99 o $89.99 de una vez. Si el techo cubre al cliente más barato, cubre a todos.
- Dos cobros y no uno: con un solo cobro el techo sería $4.99 y dejaría fuera casi cualquier campaña de pago. Con dos cobros todavía recuperamos el anuncio antes del tercer mes.
- Coincide con el techo de $15.00 de `meta-ads-noviembre.md`; aquí se fija al centavo: **$14.98**.

Zona verde: **$4.99 o menos** por cliente que paga. Ahí el anuncio se recupera con el primer cobro, aunque el cliente cancele después.

Lo que este cálculo no descuenta y hay que revisar cuando llegue el dato: la comisión de Tilopay y de ONVO por cobro [PENDIENTE: contrato de cada procesador] y los impuestos por país. Si la comisión es, por ejemplo, 5 %, el techo baja a $14.23.

### Del techo a cada etapa

El costo máximo de cada etapa es el techo multiplicado por las metas de las etapas que vienen después (redondeado hacia abajo al centavo):

| Etapa | Cálculo | Máximo |
| --- | --- | ---: |
| 6. Cliente que paga | techo | $14.98 |
| 5. Tarjeta | $14.98 × 88 % | $13.18 |
| 4. Registro | $13.18 × 40 % | $5.27 |
| 3. Clic en "Crear mi plan gratis" | $5.27 × 60 % | $3.16 |
| 2. Llegada | $3.16 × 30 % | $0.94 |
| 1. Clic en el anuncio | $0.94 × 75 % | $0.70 |

### Lo que dice el costo por registro real

| Anuncio | Costo por registro | Si 35.2 % paga | Conversión de registro a pago mínima para no pasar $14.98 | Para quedar en la zona verde ($4.99) |
| --- | ---: | ---: | ---: | ---: |
| Reel "Cuánto peso" | $0.64 | $1.82 por cliente que paga | 4.3 % | 12.8 % |
| Promedio de la campaña el 28 oct | unos $1.01 | $2.87 por cliente que paga | 6.7 % | 20.2 % |

Fuente: Ads Manager, campaña activa, columna "Costo por resultado" con resultado = registros completados (`CompleteRegistration`); cifras que pasó Andrés en la solicitud de esta tarea. No están guardadas en el repositorio.

Lectura: el costo por registro está 5 a 8 veces por debajo de su máximo ($5.27). **El riesgo no está en la parte de arriba del embudo, está en la de abajo**: tarjeta y cobro. Si menos de 6.7 % de los registros del 28 de octubre llega a pagar, el promedio de la campaña pasa el techo aunque el registro salga barato.

## Qué evento se dispara de verdad y dónde

Revisado en `src/lib/meta-pixel.ts`, `src/lib/meta-capi.ts`, `src/components/analytics.tsx`, `src/components/meta-pixel.tsx` y `src/app/api/track/route.ts`.

Cómo viaja un evento: `track()` lo manda al píxel (navegador) y a `/api/track` con el mismo `event_id`. `/api/track` lo guarda en `funnel_events` (migración 0061) y, si existe `META_CAPI_TOKEN`, lo reenvía a la API de Conversiones; Meta deduplica por `event_id`. **En la app nativa no va nada a Meta** (ni píxel ni API de Conversiones), pero sí queda en `funnel_events`.

| Etapa | Evento del embudo | Evento de Meta | Dónde se dispara | Lo que hay que saber |
| --- | --- | --- | --- | --- |
| 1 | ninguno | ninguno | Solo Meta Ads | No hay evento propio. Se mide con clics en el enlace del Ads Manager. |
| 2 | `page_view` | `PageView` | `src/components/meta-pixel.tsx` (cada ruta, menos /admin, /auth y /api); `page_view` en `src/app/(marketing)/layout.tsx` | El píxel carga cuando el navegador queda libre (hasta 3 s después de la carga): quien se va antes no cuenta. `funnel_events` guarda la ruta sin los UTM, así que en Supabase no se separa lo pagado de lo orgánico. |
| 3 | `cta_click` | `Lead` | Clic en cualquier elemento con `data-cta` que cumpla `LEAD_CTA` | **Cuenta de más:** `LEAD_CTA` también acepta `registro-*`, los botones del formulario de registro (`/entrar?modo=registro`). Una persona que toca "Crear mi plan gratis" y luego "Empezar mi prueba gratis" da 2 `Lead`. **Y cuenta de menos:** los botones `lo-mejor` y `pasos` (los dos dicen "Crear mi plan gratis") y `oferta` ("Empezar gratis") llevan al registro pero no están en `LEAD_CTA`, así que no disparan `Lead`. |
| 4 | `onboarding_done` | `CompleteRegistration` | `src/app/bienvenida/wizard.tsx`, al terminar el cuestionario de bienvenida | Se dispara al **terminar la bienvenida**, no al crear la cuenta. Quien crea la cuenta y deja el cuestionario a medias no cuenta como registro en Meta. Por eso el costo por registro de Meta es costo por cuestionario terminado. |
| 5 | `card_saved` | `AddPaymentInfo` | `src/app/(app)/app/suscripcion/card-panel.tsx`, al guardar la tarjeta | Se dispara también cuando el banco rechaza (`outcome: rechazado`) y en modo demo. La cifra buena es la de `trial_charges`. |
| 6 | `purchase_success` | `Subscribe` | Solo `src/app/pago/exito/page.tsx` | **El cobro del 8 de noviembre no tiene evento.** Lo hace el servidor (`attemptCharge` en `src/lib/trial-billing.ts`) sin que la persona abra /pago/exito, así que ni el píxel ni la API de Conversiones se enteran. `Subscribe` solo sale cuando alguien paga a mano en la página de pago. Además, `Subscribe` manda el precio completo aunque el cobro lleve el 50 %. |

Otros dos límites de las fuentes:

- `funnel_events` existe desde la migración 0061 (28 de octubre). Para la semana del 25 al 31 solo tiene **del 28 al 31**. Del 25 al 27 se usan Meta y `profiles`.
- La app guarda los UTM solo cuando la visita trae `?ref=` (`src/components/ref-capture.tsx`). Un registro que llega de un anuncio no queda con su `utm_campaign` en Supabase. Por eso el costo por cliente que paga se calcula **en total** (gasto de Meta ÷ clientes que pagan), no por anuncio.

## Las 6 etapas

Todas las consultas de Supabase van en el SQL Editor del proyecto (rol de servicio; `funnel_events` y `trial_charges` no se leen con la llave pública). Solo leen: no cambian nada.

### 1. Clic en el anuncio

- **Fuente:** Meta Ads. No hay evento del píxel.
- **Partida:** [PENDIENTE]. Ads Manager > Campañas > campaña activa > fechas del 25 al 31 de octubre > desglose por anuncio. Columnas: Importe gastado, Impresiones, Clics en el enlace, CTR (porcentaje de clics en el enlace), CPC (costo por clic en el enlace), Reproducciones de video de 3 segundos.
- **Meta:** CTR del enlace de **1.0 %** o más.
- **Costo máximo:** **$0.70** por clic en el enlace.
- **Si queda por debajo** (CTR menor a 1.0 % o clic sobre $0.70): el problema es el gancho, no la página. Primero mirar el hook rate (3 s ÷ impresiones, meta 30 %); si está bajo 20 %, cambiar los primeros 2 segundos del Reel. Si el hook rate está bien y el CTR no, cambiar el cierre del Reel y el título del anuncio para que digan qué pasa al tocar ("Empieza 7 días gratis"). Mueve el **CTR** y el **costo por clic**. Se propone pausar el anuncio, no se pausa sin Andrés.

### 2. Llegada a la web

- **Fuente:** Ads Manager, columna "Vistas de la página de destino" (cuenta las visitas del anuncio que cargaron el píxel). Total del sitio en Supabase (incluye orgánico).
- **Partida:** [PENDIENTE]. Ads Manager, mismo reporte de la etapa 1 con la columna "Vistas de la página de destino". Del 28 al 31 de octubre, también:

  ```sql
  -- Etapa 2: vistas de la landing por día (hora de Costa Rica). Total del sitio, no solo anuncios.
  select (created_at at time zone 'America/Costa_Rica')::date as dia, path, count(*) as vistas
  from public.funnel_events
  where name = 'page_view'
    and path in ('/', '/glp1')
    and created_at >= '2026-10-25 06:00+00' and created_at < '2026-11-01 06:00+00'
  group by 1, 2 order by 1, 2;
  ```

- **Meta:** **75 %** de los clics en el enlace llegan (vistas de la página de destino ÷ clics en el enlace).
- **Costo máximo:** **$0.94** por llegada.
- **Si queda por debajo:** la página tarda en cargar o el clic fue accidental. Pedir al equipo de la app que mida la carga de `/` y `/glp1` en un celular de gama media con 4G (meta: contenido visible en menos de 2.5 s) y revisar en Ads Manager si los clics vienen de una ubicación con clics accidentales (sacar Audience Network y la columna derecha, como dice `meta-ads-noviembre.md`). Mueve la **tasa de llegada** y el **costo por llegada**.

### 3. "Crear mi plan gratis" (Lead)

- **Evento:** `Lead` del píxel 1544502257509303 (y API de Conversiones), que sale de `cta_click`.
- **Partida:** [PENDIENTE]. Events Manager > conjunto de datos "Banana Burn" (1544502257509303) > Información general > evento `Lead` > del 25 al 31 de octubre. Ojo: esa cifra incluye los botones del formulario de registro (ver arriba), así que sale inflada. La cifra limpia, del 28 al 31:

  ```sql
  -- Etapa 3: clics en los botones de la landing que llevan al registro. Incluye lo-mejor, pasos y oferta,
  -- que Meta no ve como Lead. Excluye los botones del formulario de registro (registro-*).
  select props->>'cta' as boton, count(*) as clics
  from public.funnel_events
  where name = 'cta_click'
    and props->>'cta' ~ '^(hero|final|nav|sticky|lo-mejor|pasos|oferta|glp1-(hero|final|sticky|banda))$'
    and created_at >= '2026-10-25 06:00+00' and created_at < '2026-11-01 06:00+00'
  group by 1 order by 2 desc;
  ```

- **Meta:** **30 %** de las llegadas tocan el botón.
- **Costo máximo:** **$3.16** por clic en el botón.
- **Si queda por debajo:** la promesa del anuncio no coincide con lo que se ve arriba en la página. Para los anuncios de GLP-1, revisar que /glp1 repita en el primer pantallazo lo que dice el Reel; para los demás, que el hero de / hable del mismo dolor que el gancho (por ejemplo, el Reel "Cuánto peso" y el peso sugerido en el hero). Probar una variante del título del hero con el texto del gancho del anuncio que mejor convierte. Mueve la **tasa de clic en el botón**. Además, pedir al equipo de la app que el `Lead` cuente solo los botones de la landing (sacar `registro-*` de `LEAD_CTA` y sumar `lo-mejor`, `pasos` y `oferta`): sin eso esta etapa no se puede leer en Meta.

### 4. Registro (CompleteRegistration)

- **Evento:** `CompleteRegistration` del píxel y de la API de Conversiones, que sale de `onboarding_done` al terminar la bienvenida. Es el evento con el que optimiza la campaña.
- **Costo por registro real:** **US$0.64** con el Reel "Cuánto peso" y **unos US$1.01** de promedio de la campaña el 28 de octubre (Ads Manager, "Costo por resultado"). Máximo: **$5.27**.
- **Partida (cantidad):** [PENDIENTE]. Tres cifras que se leen juntas:
  1. Meta: Ads Manager, columna "Resultados" (registros completados) del 25 al 31 de octubre, por anuncio.
  2. Cuentas creadas (todas, de cualquier origen):

     ```sql
     -- Etapa 4a: cuentas creadas por día y país en la semana.
     select (created_at at time zone 'America/Costa_Rica')::date as dia, coalesce(country, 's/d') as pais, count(*) as cuentas
     from public.profiles
     where created_at >= '2026-10-25 06:00+00' and created_at < '2026-11-01 06:00+00'
     group by 1, 2 order by 1, 2;
     ```

  3. Bienvenidas terminadas (lo mismo que cuenta Meta), del 28 al 31:

     ```sql
     -- Etapa 4b: personas que terminaron la bienvenida (= CompleteRegistration).
     select count(distinct user_id) as bienvenidas_terminadas
     from public.funnel_events
     where name = 'onboarding_done'
       and created_at >= '2026-10-28 06:00+00' and created_at < '2026-11-01 06:00+00';
     ```

- **Meta:** **60 %** de los clics en el botón terminan el registro y la bienvenida.
- **Si queda por debajo:** hay dos fugas distintas. Si muchos tocan el botón y pocas cuentas se crean (4a), el freno es el formulario: proponer que "Continuar con Google" vaya primero en el celular y que el texto del botón diga qué pasa ("Empezar mi prueba gratis", ya está). Si se crean cuentas pero pocas terminan la bienvenida (4b ÷ 4a bajo 80 %), el freno es el cuestionario: pedir al equipo de la app el paso donde más se van (falta un evento por paso de la bienvenida) y acortar ese paso. Mueve la **tasa de registro** y el **costo por registro**.

### 5. Tarjeta agregada (AddPaymentInfo)

- **Evento:** `AddPaymentInfo` del píxel (sale de `card_saved`). Cuenta también rechazos y demos, y no ve la app nativa: la cifra buena es la de `trial_charges` (una fila por cuenta, se crea al guardar la tarjeta en `saveVerifiedCard`).
- **Partida:** [PENDIENTE]:

  ```sql
  -- Etapa 5: de las cuentas creadas en la semana, cuántas dejaron la tarjeta y con qué plan.
  select t.plan, t.billing, count(*) as tarjetas,
         count(*) filter (where t.promo = 'primer_mes_50') as con_50,
         count(*) filter (where t.status = 'canceled') as canceladas
  from public.trial_charges t
  join public.profiles p on p.id = t.user_id
  where p.created_at >= '2026-10-25 06:00+00' and p.created_at < '2026-11-01 06:00+00'
  group by 1, 2 order by 1, 2;
  ```

- **Meta:** **40 %** de los registros dejan la tarjeta.
- **Costo máximo:** **$13.18** por tarjeta.
- **Si queda por debajo:** la gente no sabe que existe el 50 % o no le ve el valor antes de dejar la tarjeta. Proponer: mostrar el precio exacto del primer mes ($4.99 o $7.49) en el aviso de tarjeta dentro de la app, el día 2 de la prueba (después del primer entreno, no antes); que el correo de la oferta del 50 % salga ese mismo día con un solo botón a `/app/suscripcion#tarjeta`; y repetir siempre "Hoy no te cobramos" y la fecha del cobro. Mueve la **tasa de tarjeta guardada**. Sin escasez falsa: la oferta vale hasta el primer cobro y se dice así.

### 6. Primer pago del 8 de noviembre (Subscribe)

- **Evento:** **ninguno para el cobro automático.** `Subscribe` solo sale en /pago/exito. El cobro del 8 lo hace el servidor y Meta no se entera. Fuente: Supabase `trial_charges` y los reportes de los procesadores.
- **Partida:** [PENDIENTE] hasta el 8 de noviembre. Hoy ya se puede proyectar cuánto se va a cobrar:

  ```sql
  -- Etapa 6, proyección (antes del 8 nov): cobros programados de la cohorte para el 8 de noviembre.
  -- Después del 8 nov, la misma consulta da los cobros hechos (status = 'succeeded').
  select t.status, t.plan, t.billing, count(*) as personas, sum(t.amount_minor) / 100.0 as usd
  from public.trial_charges t
  join public.profiles p on p.id = t.user_id
  where p.created_at >= '2026-10-25 06:00+00' and p.created_at < '2026-11-01 06:00+00'
    and t.charge_at = '2026-11-08 06:00+00'
  group by 1, 2, 3 order by 1, 2, 3;
  ```

  Quien no dejó tarjeta y paga a mano en el muro de planes entra por `subscriptions` (y sí dispara `Subscribe`):

  ```sql
  -- Etapa 6b: pagos a mano de la cohorte del 8 al 14 de noviembre (sin tarjeta guardada antes).
  select s.provider, count(distinct s.user_id) as clientes
  from public.subscriptions s
  join public.profiles p on p.id = s.user_id
  where p.created_at >= '2026-10-25 06:00+00' and p.created_at < '2026-11-01 06:00+00'
    and s.status = 'active'
    and s.created_at >= '2026-11-08 06:00+00' and s.created_at < '2026-11-15 06:00+00'
    and not exists (select 1 from public.trial_charges t where t.user_id = s.user_id and t.status = 'succeeded')
  group by 1;
  ```

  Para cuadrar con el dinero real: portal de Tilopay > Transacciones > 8 de noviembre > aprobadas (Guatemala, Colombia y el resto) y panel de ONVO > Pagos > 8 de noviembre (Costa Rica). La suma de los dos tiene que dar el total `usd` de la consulta con `status = 'succeeded'`.
- **Meta:** **88 %** de las tarjetas se cobran bien (sin cancelar ni rechazo después del reintento del día 9).
- **Costo máximo:** **$14.98** por cliente que paga = gasto de Meta del 25 al 31 de octubre ÷ (cobros `succeeded` de la cohorte + pagos a mano 6b).
- **Si queda por debajo:**
  - Muchos `canceled`: el aviso de 48 horas antes (6 de noviembre) tiene que decir el monto exacto, la fecha y cómo cancelar, sin presión. Una cancelación honesta es mejor que un contracargo. Si cancelan por precio, proponer a Andrés que el aviso recuerde que Entreno cuesta $4.99 el primer mes y se puede cambiar de plan antes del cobro (`canChangePlan`). Mueve la **tasa de cobro**.
  - Muchos `failed` o `retry_scheduled`: el banco rechaza. Que el correo y la notificación del rechazo lleven un solo botón para cambiar la tarjeta antes del reintento del día 9. Mueve la **tasa de cobro**.
  - Para todos: pedir al equipo de la app que el cobro automático aprobado mande `Subscribe` a la API de Conversiones desde el servidor (con el monto real cobrado). Sin eso Meta optimiza a ciegas sobre el pago y el reporte de Meta va a mostrar menos clientes de los reales.

## Calendario de lectura

| Fecha | Qué se lee |
| --- | --- |
| Dom 1 nov | Cierra la semana del 25 al 31: etapas 1 a 4 completas y etapa 5 parcial. |
| Vie 6 nov | Sale el aviso de 48 horas. Etapa 5 casi final y proyección de la etapa 6 (consulta 6). |
| Dom 8 nov | Primer cobro. Etapa 6 con `succeeded`, `failed` y `retry_scheduled`. |
| Lun 9 nov | Reintento de los rechazados. Etapa 6 casi final. |
| Dom 15 nov | Cierre: pagos a mano (6b) incluidos. Costo por cliente que paga de la cohorte y comparación con el techo de $14.98. |

## Pedidos al equipo de la app (para que Andrés los apruebe)

Ninguno es parte de este documento. Ordenados por lo que mueven en la métrica principal:

1. **`Subscribe` desde el servidor en el cobro automático** (etapa 6). Sin esto, Meta no ve los pagos del 8 de noviembre.
2. **Guardar los UTM de cada visita, no solo con `?ref=`** (etapas 2 a 6). Sin esto el costo por cliente que paga no se puede calcular por anuncio.
3. **Corregir `LEAD_CTA`**: sacar `registro-*` y sumar `lo-mejor`, `pasos` y `oferta` (etapa 3).
4. **Un evento por paso de la bienvenida** (etapa 4), para saber dónde se van.
5. **`AddPaymentInfo` solo cuando la tarjeta queda guardada de verdad** (sin rechazos ni demo) (etapa 5).
