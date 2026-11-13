# Simulacro del 1 de diciembre: registro con tarjeta obligatoria (ONVO y Tilopay)

Desde el **1 de diciembre de 2026 a las 00:00 de Costa Rica** (`CARD_REQUIRED_FROM` en `src/lib/card-required.ts`, la
misma fecha que `public._card_required_from()` de la migración 0071) toda cuenta nueva deja su tarjeta para empezar sus
7 días gratis. Si algo de esa cadena falla ese día, no entra ningún registro.

La cadena completa ya está probada con ONVO y Tilopay simulados en `src/lib/simulacro-1-diciembre.test.ts` (#313). Esta
guía es para probarla **en producción** el 1 de diciembre a las 00:05, con una tarjeta real de Costa Rica y otra de
otro país, y cancelar después sin que se cobre nada.

Corre: Andrés (es el único con acceso a Vercel, Supabase, ONVO, Tilopay y el panel admin). Revisa: Grace. Arregla lo que
necesite código: Adrian, con un PR que Andrés aprueba.

## Antes (30 de noviembre, en la tarde)

| # | Dónde | Qué revisar | Si falla | Resultado |
| --- | --- | --- | --- | --- |
| A1 | Supabase, SQL editor | `select public._card_required_from();` devuelve `2026-12-01 06:00:00+00`. | Corre `supabase/migrations/0071_tarjeta_desde_diciembre.sql`. Sin ella, la base daría la prueba sin tarjeta todo diciembre. | |
| A2 | Vercel, Settings, variables de entorno (Production) | Existen `ONVO_SECRET_KEY`, `NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY`, `ONVO_WEBHOOK_SECRET`, las cuatro `ONVO_PRICE_*`, `TILOPAY_API_USER`, `TILOPAY_API_PASSWORD`, `TILOPAY_KEY`, `TILOPAY_STATE_SECRET`, `CRON_SECRET`, `META_CAPI_TOKEN`. Revisa solo que existan, sin copiar valores. | Agrégala y haz Redeploy. | |
| A3 | Vercel, variable `TILOPAY_ENABLED` | Vale `1`. Con `staff` solo el equipo ve "¿Tu tarjeta es de otro país?": desde el 1 de diciembre una persona con tarjeta extranjera **no podría registrarse**. | Cámbiala a `1` y haz Redeploy. | |
| A4 | Vercel, Crons | Está `/api/cron/cobros` a las `20 6 * * *` (00:20 de Costa Rica). | Revisa `vercel.json` en main. | |
| A5 | Dos correos nuevos | Tienes dos correos que nunca se registraron en Banana Burn (uno por tarjeta). | Crea dos alias (por ejemplo `+cr` y `+ext`). | |

## El 1 de diciembre a las 00:05

Usa una ventana privada distinta para cada cuenta. Anota solo el id de cuenta (Admin > Usuarios), nunca correos ni datos
de tarjeta.

### 1. Tarjeta de Costa Rica (ONVO)

| # | Paso | Qué debe pasar | Resultado |
| --- | --- | --- | --- |
| C1 | Abre `bananaburn.app/entrar?modo=registro` y crea la cuenta con el primer correo. | Entra a la bienvenida. La portada y /precios ya no dicen "sin tarjeta". | |
| C2 | Completa la bienvenida hasta "Crear mi plan". | Aparece "Deja tu tarjeta para empezar tus 7 días gratis", sin "Empezar gratis sin tarjeta" ni forma de saltar el paso. El texto dice cuándo y cuánto se cobra ($4.99 Entreno o $7.49 Entreno + Nutrición, el 8 de diciembre). | |
| C3 | Abre `bananaburn.app/app` en otra pestaña sin dejar la tarjeta. | Te devuelve a la bienvenida (sin tarjeta no hay prueba). | |
| C4 | Deja la tarjeta de Costa Rica y toca "Empezar mis 7 días gratis". | Entra a la app. Hoy no se cobra nada: en ONVO no aparece ningún cargo. Llega el correo "Tarjeta lista: tu primer mes con 50 % se cobra el 8 de diciembre". | |
| C5 | Abre Mi plan (`/app/suscripcion`). | Dice prueba gratis, 7 días, y el cobro programado del 8 de diciembre con el monto del paso C2. | |
| C6 | Admin > Pagos. | No hay ningún "pago fallido" de esta cuenta. | |

### 2. Tarjeta de otro país (Tilopay)

| # | Paso | Qué debe pasar | Resultado |
| --- | --- | --- | --- |
| E1 | En otra ventana privada, crea la cuenta con el segundo correo y llega al paso de la tarjeta. | Igual que C2. | |
| E2 | Toca "¿Tu tarjeta es de otro país?" y continúa. | Abre la página segura de Tilopay. | |
| E3 | Deja la tarjeta extranjera en Tilopay. | Vuelve a Mi plan con "Listo, tu tarjeta quedó guardada." y la prueba activa. Hoy no se cobra nada: en el portal de Tilopay no aparece ningún cargo. | |
| E4 | Vuelta sin sesión (#298), solo si se puede reproducir: con un tercer correo, empieza en el navegador de Instagram, o en un navegador donde la página de Tilopay abra en otro navegador, y deja la tarjeta. | Si al volver pide entrar, después de entrar Mi plan muestra la tarjeta guardada y la prueba activa (antes de #313 la tarjeta se perdía aquí). Si no se puede reproducir, lo cubre la prueba automática. | |

### 3. Tarjeta rechazada

| # | Paso | Qué debe pasar | Resultado |
| --- | --- | --- | --- |
| R1 | Con la cuenta de Costa Rica antes de C4 (o una cuenta nueva), pon una tarjeta vencida o sin fondos. | Mensaje claro en el mismo paso (por ejemplo "Tu banco no aprobó la tarjeta para pagos recurrentes. Prueba con otra."). Sigue en el paso de la tarjeta y puede reintentar. | |
| R2 | Admin > Pagos. | Aparece un pago fallido de esa cuenta con su motivo. | |
| R3 | Reintenta con la tarjeta buena. | Entra a la app con su prueba activa. | |

## Cancelar después (el mismo 1 de diciembre)

Para cada cuenta de prueba:

1. Entra con esa cuenta y abre Mi plan (`/app/suscripcion`).
2. Toca **Cancelar sin costo** y confirma. Debe decir que no se cobrará y hasta qué día sigue el acceso.
3. Admin > Usuarios > esa cuenta: el cobro de la prueba está **Cancelado** y no hay ningún cobro programado.
4. Si quieres quitar la tarjeta del todo, quítala en Mi plan. Para borrar la cuenta: Perfil > Borrar mi cuenta.

Si algo se cobró por error, se reembolsa desde el portal de ONVO o de Tilopay y se anota aquí el id de la fila.

## El 8 de diciembre (si no cancelaste alguna)

A las 00:20 el cron de cobros cobra el primer mes con 50 %. Para verlo sin cobrar, antes de esa hora: `GET
/api/cron/cobros?dryRun=1&at=2026-12-08T06:20:00Z` con `CRON_SECRET` (ver `docs/simulacro-cobros.md`). En Meta Events
Manager debe aparecer un Subscribe por cada cobro aprobado.

## Qué cubre la prueba automática

`src/lib/simulacro-1-diciembre.test.ts`, con una cuenta creada el `2026-12-01T06:01Z`:

1. ONVO: bienvenida sin forma de saltar la tarjeta, `/api/pagos/tarjeta` (preparar y guardar), prueba activa, cobro de
   $4.99 el día 8 por el cron (una sola vez), webhook de ONVO del mismo cobro sin duplicar y un Subscribe por CAPI.
2. Tilopay: salida a la página de Tilopay, vuelta **sin sesión** que guarda la tarjeta, prueba activa y cobro de $7.49 el
   día 8 con Subscribe. Tilopay no manda webhook: el cobro se confirma con su respuesta servidor a servidor.
3. Tarjeta rechazada: mensaje claro, sigue en el paso de la tarjeta, `payment_failed` registrado y reintento que sí entra.
4. Condominio: la tarjeta desde `/c/<código>` programa el primer cobro al terminar su mes gratis, a precio normal; el día
   8 no cobra nada.
5. Cuenta del 30 de noviembre a las 23:59: prueba de 7 días sin tarjeta, como antes.

Arreglo que salió del simulacro (#313): la vuelta de Tilopay sin sesión solo confirmaba compras directas; una tarjeta
guardada sin sesión se perdía, y desde el 1 de diciembre eso dejaba sin prueba a quien se registra con tarjeta extranjera.
Ahora se guarda con el estado firmado, igual que con sesión.
