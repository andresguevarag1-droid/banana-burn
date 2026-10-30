# Simulacro de cobros del 8 de noviembre

`scripts/simular-cobros.ts` corre la lógica del cron `/api/cron/cobros` en modo simulación (dryRun) con la fecha del
8 de noviembre de 2026 a las 06:20 UTC (00:20 en Costa Rica, fin de los 7 días de la beta) y lista, sin cobrar, a quién se
cobraría, cuánto y con qué procesador.

Qué garantiza:

- No llama a ONVO ni a Tilopay y no necesita sus llaves.
- No escribe nada en la base: los barridos usan un cliente de solo lectura que lanza ante cualquier insert, update, upsert,
  delete o rpc (ni avisos, ni reclamos de filas, ni el latido del monitor).
- El reporte identifica a cada persona solo por su id de cuenta (nunca correo, nombre ni datos de tarjeta).
- Corre el simulacro dos veces seguidas y sale con error si las corridas no coinciden, si algún cobro se haría dos veces
  (usuario, periodo, procesador) o si algún barrido falló.

## Correrlo contra producción

1. Aplica la migración `0062_llaves_cobro.sql` en Supabase (SQL editor). Sin ella el simulacro marca los cobros como
   `sin_llaves_0062` y el cron real no cobra (falla cerrado).
2. Crea `.env.simulacro` en la raíz del repositorio (los `.env*` están ignorados por git) con solo dos variables:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service_role de producción>
   ```

   No pongas `NEXT_PUBLIC_BETA_ENDS_AT`: producción usa la fecha fija de la base.
3. Corre:

   ```bash
   npm ci
   npx --yes tsx --conditions=react-server --env-file=.env.simulacro scripts/simular-cobros.ts
   ```

   Opciones: `--fecha 2026-11-08T12:00:00Z` para otra fecha y `--salida <carpeta>` para otra carpeta.
4. Borra `.env.simulacro` al terminar.

Deja `simulacro-cobros/cobros-<fecha>.json` y `.csv` (carpeta ignorada por git) y un resumen en la consola: total a
cobrar, por procesador, mensual y anual, primer mes con 50 % ($4.99 y $7.49), temporadas incluidas en el plan anual,
cobros en vuelo (solo consulta), omitidos por motivo, cortesías y duplicados.

También se puede pedir al cron desplegado: `GET /api/cron/cobros?dryRun=1&at=2026-11-08T06:20:00Z` con
`Authorization: Bearer <CRON_SECRET>`. Tiene el límite de 60 segundos de la función; con muchas cuentas usa el script.

## Comparar con el panel admin

Cada fila trae `userId` y `fila` (id de `trial_charges` o de `subscriptions`) para buscarla en el panel. Columnas:

| Columna | Qué es |
|---|---|
| `origen` | `fin_beta`, `prueba`, `inmediato`, `reintento`, `primer_mes_normal` (ONVO después del 50 %), `cambio_tarjeta` (ONVO) o `renovacion` (Tilopay) |
| `accion` | `cobrar` (llamaría al procesador), `consultar` (cobro en vuelo: solo se consulta) u `omitir` |
| `motivo` | Por qué se omite: `tester`, `condominio`, `beta_aun_no`, `compra_en_curso`, `ya_paga`, `sin_tarjeta`, `monto_no_coincide`, `llave_ocupada`, `sin_llaves_0062` |
| `montoMinor` / `montoEsperadoMinor` | Centavos de USD que se mandarían y los que calcula el servidor con `plans.ts`. Si difieren, revisa la fila |
| `cortesia` | Tiene una cortesía, regalo o recompensa vigente que hoy no frena el cobro (solo la de condominio lo frena) |
| `temporadaIncluida` | Plan anual: incluye una temporada para canjear, sin cobro aparte. Las temporadas no las cobra el cron |
| `periodo` | Periodo de la llave única: `primer_cobro` o el inicio del periodo en ISO UTC |

## Llave única de cobro (0062)

`charge_keys` guarda una llave por usuario, periodo y procesador. El cron la reserva justo antes de llamar a ONVO o
Tilopay; el índice único parcial deja una sola reservada, así que el mismo cobro nunca se manda dos veces. Se libera solo
cuando se sabe que no se cobró (rechazo o intento devuelto), para que el reintento del mismo periodo pueda reservarla. Si
una llave quedó reservada por un cobro que no se hizo, el cobro de esa persona queda aplazado con alerta (`pagos/llave-ocupada`
en /admin/salud) hasta revisarla.
