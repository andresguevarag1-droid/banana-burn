# Presupuesto autofinanciado y reporte semanal de rentabilidad

La meta son **100 usuarios de pago con un negocio rentable**: cada semana, los anuncios se pagan con lo que cobramos, no al revés. Este documento fija cuánto deja cada usuario de pago, cuánto podemos pagar por conseguirlo, la regla que limita el gasto de cada semana y la plantilla del reporte de cada lunes.

**Es solo un documento**: no cambia campañas, presupuestos, correos ni código de la app, y **no propone gasto nuevo**. Cualquier cambio de gasto lo aprueba Andrés. Las cifras salen de `src/lib/plans.ts`, `src/lib/trial.ts` y de las comisiones y topes que confirmó Andrés el 31 de octubre de 2026, y las vigila `src/lib/rentabilidad-semanal.test.ts`. Lo que no tiene dato dice "por medir".

## 1. Punto de equilibrio por usuario de pago

Lo que deja cada cobro es su precio sin el IVA, menos lo que se queda el procesador:

**Neto por cobro = cobro ÷ 1.13 − (cobro × c + f)**

- **IVA:** 13 %, incluido en el precio. Lo paga Atlas Resources SRL, así que de cada cobro se queda cobro ÷ 1.13.
- **ONVO** (tarjetas de Costa Rica): c = 3.9 % y f = $0.35 por cobro.
- **Tilopay** (tarjetas de fuera de Costa Rica): c = 4.25 % y f = $0.35 por cobro.
- La comisión se calcula sobre el cobro completo, con IVA. Confirmado por Andrés el 31 de octubre de 2026.

Precios del código: el 50 % del primer mes es `discountedMinor` en `src/lib/trial.ts`, que redondea hacia abajo al centavo (el precio que promete la web). Por eso el primer mes con 50 % es **$4.99** y **$7.49**, no $5.00 y $7.50. El 50 % solo aplica al plan mensual (`promoApplies`) y solo si la persona dejó su tarjeta antes del primer cobro; el anual se cobra completo.

| Cobro | Precio | Neto con ONVO | Neto con Tilopay | Diferencia |
| --- | ---: | ---: | ---: | ---: |
| Entreno, primer mes con 50 % | $4.99 | $3.87 | $3.85 | $0.02 |
| Entreno + Nutrición, primer mes con 50 % | $7.49 | $5.99 | $5.96 | $0.03 |
| Entreno, mes completo | $9.99 | $8.10 | $8.07 | $0.03 |
| Entreno + Nutrición, mes completo | $14.99 | $12.33 | $12.28 | $0.05 |
| Entreno, anual | $59.99 | $50.40 | $50.19 | $0.21 |
| Entreno + Nutrición, anual | $89.99 | $75.78 | $75.46 | $0.32 |

Ejemplo con el primer cobro más bajo: 4.99 ÷ 1.13 − (4.99 × 0.039 + 0.35) = 4.4159 − 0.5446 = **$3.87**. Los netos se redondean al centavo solo al final. "Mes completo" es el primer mes sin 50 % y cada mes siguiente.

**Punto de equilibrio de un usuario de pago:** lo que costó conseguirlo (CAC) es igual a lo que ha dejado hasta ese momento. Con `CAC = gasto en anuncios ÷ usuarios de pago nuevos`, el usuario está en equilibrio cuando **neto acumulado de sus cobros = CAC**.

## 2. Costo máximo por usuario de pago (CAC)

Cuánto podemos pagar por un usuario de pago para recuperar el gasto, con `neto(P)` = P ÷ 1.13 − (P × c + f):

- **En el primer pago:** `CAC máximo = neto(P1)`.
- **En 3 meses:** `CAC máximo = neto(P1) + r2 × neto(P2) + r3 × neto(P3)`, donde `P1`, `P2` y `P3` son los cobros de los meses 1, 2 y 3, y `r2` y `r3` son la parte de los usuarios de pago que sigue pagando en el mes 2 y el mes 3. En el anual los 3 meses están cubiertos por el primer cobro, así que su CAC a 3 meses es el del primer pago.

Renovación en el mes 2 (`r2`) y en el mes 3 (`r3`): **por medir**. Todavía no hay ningún segundo cobro (los primeros cobros son el 8 de noviembre) y `subscriptions` no guarda cada renovación (ver los límites de [tablero-diario.md](tablero-diario.md)).

| Plan y forma de pago | Recuperar en el primer pago, con ONVO | Fórmula | Recuperar en 3 meses si todos renuevan (r2 = r3 = 1), con ONVO | Fórmula | Con Tilopay: primer pago / 3 meses | Con la renovación real |
| --- | ---: | --- | ---: | --- | --- | --- |
| Entreno, primer mes con 50 % | $3.87 | neto(4.99) | $20.07 | neto(4.99) + 2 × neto(9.99) | $3.85 / $19.99 | por medir |
| Entreno, mensual sin 50 % | $8.10 | neto(9.99) | $24.30 | 3 × neto(9.99) | $8.07 / $24.20 | por medir |
| Entreno, anual | $50.40 | neto(59.99) | $50.40 | neto(59.99) | $50.19 / $50.19 | no depende de la renovación |
| Entreno + Nutrición, primer mes con 50 % | $5.99 | neto(7.49) | $30.65 | neto(7.49) + 2 × neto(14.99) | $5.96 / $30.52 | por medir |
| Entreno + Nutrición, mensual sin 50 % | $12.33 | neto(14.99) | $36.99 | 3 × neto(14.99) | $12.28 / $36.84 | por medir |
| Entreno + Nutrición, anual | $75.78 | neto(89.99) | $75.78 | neto(89.99) | $75.46 / $75.46 | no depende de la renovación |

Cómo leerla:

- **El CAC que manda es el del primer pago.** La columna de 3 meses supone que todos renuevan, y eso no está medido. Hasta que haya renovación real, un CAC por encima del primer pago es una apuesta, no un negocio rentable.
- **Cada país se mide con su procesador:** Costa Rica con los netos de ONVO y Colombia con los de Tilopay (sección 3).
- El caso más exigente es quien deja la tarjeta en Entreno: su primer pago deja **$3.87 con ONVO y $3.85 con Tilopay**. La mezcla real de planes está por medir. Si la mayoría de los pagos nuevos son de ese tipo, el CAC de la semana tiene que quedar en ese neto o menos para que el margen no sea negativo.
- El techo de $14.98 del [acta](100-usuarios-de-pago.md) ($4.99 + $9.99) es la recuperación en 2 meses de Entreno con 50 %, sin IVA ni comisión y con renovación de 100 %. Este documento es más estricto: la semana tiene que pagarse con los netos de los primeros pagos.

## 3. La regla de presupuesto autofinanciado

**El gasto en anuncios de la semana siguiente no pasa de los ingresos nuevos netos de la semana anterior, ni del tope semanal, ni de lo que queda del tope del mes.**

**Gasto máximo de la semana N + 1 = mínimo(ingresos nuevos netos de la semana N, tope semanal, tope del mes − gasto del mes)**

- **Semana:** de lunes a domingo, hora de Costa Rica, igual que el tablero diario.
- **Ingresos nuevos netos (I):** suma del neto de cada primer pago cobrado en la semana (cobro de la prueba o de la beta en `trial_charges` con `status = 'succeeded'`, y pagos en el muro de planes). Es la columna `ingresos_netos_usd` de la fila `total` de [rentabilidad-semanal.sql](rentabilidad-semanal.sql): `I = B ÷ 1.13 − (0.039 × B de ONVO + 0.0425 × B de Tilopay) − 0.35 × N`. Las renovaciones no cuentan para la regla: se reportan aparte cuando se puedan medir.
- **Tope semanal:** **$70.00** para todo el gasto en Meta Ads de la semana, aprobado por Andrés el 31 de octubre de 2026. Puede bajarlo cuando quiera. La regla nunca lo sube.
- **Tope del mes:** **$200.00** en noviembre, sumando todo el gasto en Meta Ads del 1 al 30 de noviembre (hora de Costa Rica). En una semana que cruza de mes, el día 30 de noviembre cuenta para noviembre. Diciembre no tiene tope aprobado: sin un tope nuevo de Andrés, el gasto desde el 1 de diciembre es $0.00.
- **Si falta un dato** (el gasto de algún día o la conciliación), los ingresos netos quedan "por medir" y el reporte usa los ingresos brutos solo como techo: la decisión puede ser "mantener" o "pausar", nunca "subir".
- **Si una semana no tiene ingresos nuevos,** el máximo de la semana siguiente es $0.00. La regla no presta contra cobros futuros, ni siquiera los programados para el 8 de noviembre.
- **Desde cuándo:** Andrés decide el primer lunes en que se aplica. Este documento no cambia el gasto que ya está aprobado.

### Costa Rica y Colombia por separado

Desde el 9 de noviembre los anuncios van a **Costa Rica y Colombia, cada país en su propio conjunto de anuncios**, con su propio presupuesto. La regla de arriba es para la suma de los dos: el máximo y los topes son para todo el gasto de la semana, no para cada país. Cada conjunto se mide con su propio costo por usuario de pago:

| Conjunto | Gasto | Pagos nuevos | Costo por usuario de pago | CAC máximo |
| --- | --- | --- | --- | --- |
| Costa Rica | Gasto del conjunto en Ads Manager (G de Costa Rica) | `pagos_nuevos` del subtotal `onvo` (N de ONVO) | G de Costa Rica ÷ N de ONVO | Ingreso neto promedio por pago con ONVO: `ingresos_netos_usd` ÷ `pagos_nuevos` del subtotal `onvo` |
| Colombia | Gasto del conjunto en Ads Manager (G de Colombia) | `pagos_nuevos` del subtotal `tilopay` (N de Tilopay) | G de Colombia ÷ N de Tilopay | Ingreso neto promedio por pago con Tilopay: `ingresos_netos_usd` ÷ `pagos_nuevos` del subtotal `tilopay` |

- **El país se lee por el procesador**, porque la app no guarda los UTM de los anuncios: la app cobra con ONVO las tarjetas de Costa Rica y con Tilopay las de fuera (`providerFor` en `src/lib/pay-provider.ts`). Es una aproximación: incluye pagos orgánicos, Tilopay junta a todos los países que no son Costa Rica y la persona puede elegir el otro procesador en el formulario de la tarjeta.
- Si un conjunto tiene gasto y su país no trae pagos, o su costo por usuario de pago pasa de su CAC máximo, se propone pausar ese conjunto aunque la suma de los dos cumpla la regla.

La regla solo pone un techo. Llegar al techo no es obligatorio, y cualquier aumento lo aprueba Andrés antes de tocar Meta Ads.

## 4. Reporte de cada lunes

### De dónde sale cada dato

1. **Gasto de la semana:** Andrés corre [tablero-diario.sql](tablero-diario.sql) con `desde` = lunes y `hasta` = domingo de la semana anterior, con el gasto de Meta Ads de cada día en `gasto_manual` (ver [tablero-diario.md](tablero-diario.md)). Gasto de la semana = suma de `gasto_usd` de los 7 días. Si falta un día, el gasto queda "por medir": no se completa con promedios.
2. **Gasto por país:** el gasto de cada conjunto (Costa Rica y Colombia) de los 7 días, exportado de Ads Manager por conjunto. La suma de los dos es el gasto de la semana.
3. **Pagos nuevos por plan e ingresos:** Andrés corre [rentabilidad-semanal.sql](rentabilidad-semanal.sql) en Supabase > SQL Editor con `lunes` = el lunes de la semana anterior. Es una sola consulta SELECT de solo lectura: no crea tablas ni escribe datos. Devuelve, por procesador, plan, forma de pago y 50 % del primer mes, los `pagos_nuevos`, los `ingresos_brutos_usd` y los `ingresos_netos_usd` (con la fórmula de la sección 1), más un subtotal por procesador (`plan` = `subtotal`) y una fila `total`. Usa las mismas reglas de pago del tablero: excluye cortesías vigentes y cuenta a cada persona una sola vez.
4. **Conciliación:** los ingresos se comparan con los portales de Tilopay y ONVO antes de decidir, como en la etapa 6 del [embudo](../../marketing/estrategia/embudo-noviembre.md).

Diferencia con el tablero: el tablero agrupa por **día de creación de la cuenta** (cohorte); este reporte agrupa por **semana de pago**. Con la prueba de 7 días, una cuenta creada un domingo paga la semana siguiente. Para la regla se usa la semana de pago (el dinero que entró); el costo por cohorte (`costo_cliente_pago_total_usd` del tablero) se anota al lado para ver qué semanas de anuncios trajeron pagos.

Límites de `rentabilidad-semanal.sql`: la fecha del cobro automático es `last_attempt_at` (o `updated_at` si falta), no `charge_at`. `trial_charges` no guarda el procesador: se toma el de la tarjeta guardada hoy en `payment_methods` (ONVO si no hay), así que si la persona cambió de tarjeta después del cobro puede caer en el otro procesador. El pago en el muro de planes se fecha con la primera fila de `subscriptions` de la persona y se valora al precio de lista de `src/lib/plans.ts`, porque `subscriptions` no guarda el importe; y solo aparece si la suscripción sigue vigente al correr la consulta. Por eso se concilia con los procesadores.

### Plantilla

Se copia cada lunes. Cada campo sin dato dice "por medir"; ningún número se completa a mano sin su fuente.

```
Reporte de rentabilidad: semana del lunes [fecha] al domingo [fecha], hora de Costa Rica
Preparado por: Martín. Datos de: Andrés (tablero-diario.sql y rentabilidad-semanal.sql, corridos el [fecha]).

1. Gasto en Meta Ads de la semana (G): $ por medir
   Fórmula: suma de gasto_usd de los 7 días en tablero-diario.sql.
   Costa Rica (conjunto propio): $ por medir. Colombia (conjunto propio): $ por medir.
   Gasto de noviembre hasta el domingo (para el tope de $200.00): $ por medir.

2. Pagos nuevos por plan (rentabilidad-semanal.sql):
   Entreno, primer mes con 50 % ($4.99):            por medir
   Entreno, mensual sin 50 % ($9.99):               por medir
   Entreno, anual ($59.99):                         por medir
   Entreno + Nutrición, primer mes con 50 % ($7.49): por medir
   Entreno + Nutrición, mensual sin 50 % ($14.99):  por medir
   Entreno + Nutrición, anual ($89.99):             por medir
   Total de pagos nuevos (N):                       por medir
   Con ONVO, Costa Rica (subtotal onvo):            por medir
   Con Tilopay, fuera de Costa Rica (subtotal tilopay): por medir

3. Ingresos de la semana
   Brutos (B): $ por medir. Fórmula: ingresos_brutos_usd de la fila total.
   IVA de 13 % incluido en el precio. Comisión: ONVO c = 3.9 %, Tilopay c = 4.25 %, f = $0.35 por cobro en los dos.
   Netos (I): $ por medir. Fórmula: ingresos_netos_usd de la fila total = B ÷ 1.13 − (0.039 × B de ONVO + 0.0425 × B de Tilopay) − 0.35 × N.
   Conciliado con Tilopay y ONVO: sí / no.

4. CAC de la semana: $ por medir. Fórmula: G ÷ N. Si N = 0, no hay CAC: el gasto no trajo pagos.
   Ingreso neto promedio por pago nuevo: $ por medir. Fórmula: I ÷ N.
   CAC por cohorte del tablero (costo_cliente_pago_total_usd): $ por medir.
   Costa Rica: CAC $ por medir (G de Costa Rica ÷ N de ONVO); máximo $ por medir (neto promedio por pago con ONVO).
   Colombia: CAC $ por medir (G de Colombia ÷ N de Tilopay); máximo $ por medir (neto promedio por pago con Tilopay).

5. Margen de la semana: $ por medir. Fórmula: I − G.
   Margen positivo o cero equivale a CAC ≤ ingreso neto promedio por pago nuevo.

6. Renovaciones del mes 2 y 3 (r2, r3): por medir.

7. Gasto máximo de la semana siguiente: $ por medir. Fórmula: mínimo(I, tope semanal, tope del mes − gasto del mes).
   Tope semanal: $70.00. Tope de noviembre: $200.00. Desde el 1 de diciembre: $0.00 sin un tope nuevo de Andrés.

8. Decisión propuesta: subir / mantener / pausar. Motivo: [regla que aplica].
   Por conjunto: Costa Rica mantener / pausar; Colombia mantener / pausar.
   Aprobación de Andrés: pendiente. Nada cambia en Meta Ads antes de su sí.
```

### Cómo se decide

Se revisa en este orden y se aplica la primera que se cumpla:

| Orden | Decisión | Cuándo |
| --- | --- | --- |
| 1 | **Pausar** | Margen negativo (I < G), o hay gasto y N = 0. |
| 2 | **Mantener** | Falta un dato (gasto de algún día o conciliación), o el gasto de la semana ya está en el máximo de la sección 3. Mantener nunca pasa del máximo. |
| 3 | **Subir** | Margen positivo o cero, todos los datos completos y conciliados, y el máximo de la semana siguiente es mayor que el gasto de esta semana. Se propone subir hasta ese máximo, nunca más; Andrés aprueba el monto. |

Si la decisión es "pausar", el reporte dice qué paso del embudo falló según el tablero (registro, tarjeta o cobro) para que el siguiente issue sea sobre ese paso, no sobre más anuncios.

## 5. Qué paso del embudo mueve y por qué no agrega costo

- **Paso:** pago, y después renovación. La regla obliga a que cada semana de anuncios se pague con primeros pagos, y el reporte separa los pagos por plan y por 50 % para ver qué plan financia los anuncios.
- **Cómo se mide:** pagos nuevos e ingresos netos de `rentabilidad-semanal.sql`, gasto de `gasto_manual` en `tablero-diario.sql`, CAC = gasto ÷ pagos nuevos y margen = ingresos netos − gasto, cada lunes, para la suma y para cada país (Costa Rica con ONVO, Colombia con Tilopay). La renovación se mide cuando haya segundos cobros (por medir).
- **Por qué no agrega costo:** son dos consultas de solo lectura que Andrés corre en Supabase y una plantilla de texto. No crea campañas, no sube presupuestos, no envía correos ni publica nada. Lo único que puede hacer la regla es poner un techo al gasto.
