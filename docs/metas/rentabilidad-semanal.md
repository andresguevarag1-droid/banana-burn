# Presupuesto autofinanciado y reporte semanal de rentabilidad

La meta son **100 usuarios de pago con un negocio rentable**: cada semana, los anuncios se pagan con lo que cobramos, no al revés. Este documento fija cuánto deja cada usuario de pago, cuánto podemos pagar por conseguirlo, la regla que limita el gasto de cada semana y la plantilla del reporte de cada lunes.

**Es solo un documento**: no cambia campañas, presupuestos, correos ni código de la app, y **no propone gasto nuevo**. Cualquier cambio de gasto lo aprueba Andrés. Las cifras salen de `src/lib/plans.ts` y `src/lib/trial.ts`, y las vigila `src/lib/rentabilidad-semanal.test.ts`. Lo que no tiene dato dice "por medir"; lo que tiene que decidir Andrés dice "por confirmar con Andrés".

## 1. Punto de equilibrio por usuario de pago

Lo que deja cada cobro es su precio menos lo que se queda el procesador (Tilopay u ONVO):

**Neto por cobro = precio × (1 − c) − f**

- `c` = comisión porcentual del procesador por cobro: **por confirmar con Andrés** (contrato de Tilopay y de ONVO).
- `f` = cargo fijo por cobro, si el contrato lo tiene: **por confirmar con Andrés**.
- Impuestos por país: **por confirmar con Andrés**. Mientras no se confirmen, ningún neto de este documento los descuenta.

Precios del código: el 50 % del primer mes es `discountedMinor` en `src/lib/trial.ts`, que redondea hacia abajo al centavo (el precio que promete la web). Por eso el primer mes con 50 % es **$4.99** y **$7.49**, no $5.00 y $7.50. El 50 % solo aplica al plan mensual (`promoApplies`) y solo si la persona dejó su tarjeta antes del primer cobro; el anual se cobra completo.

| Cobro | Entreno | Entreno + Nutrición | Neto por cobro |
| --- | ---: | ---: | --- |
| Primer mes con 50 % | $4.99 | $7.49 | precio × (1 − c) − f; c y f por confirmar con Andrés |
| Mes completo (primer mes sin 50 % y meses siguientes) | $9.99 | $14.99 | precio × (1 − c) − f; c y f por confirmar con Andrés |
| Anual (un solo cobro por 12 meses) | $59.99 | $89.99 | precio × (1 − c) − f; c y f por confirmar con Andrés |

Los montos de la tabla son el **techo antes de comisión** (c = 0 y f = 0): el neto real siempre es menor.

**Punto de equilibrio de un usuario de pago:** lo que costó conseguirlo (CAC) es igual a lo que ha dejado hasta ese momento. Con `CAC = gasto en anuncios ÷ usuarios de pago nuevos`, el usuario está en equilibrio cuando **neto acumulado de sus cobros = CAC**.

## 2. Costo máximo por usuario de pago (CAC)

Cuánto podemos pagar por un usuario de pago para recuperar el gasto:

- **En el primer pago:** `CAC máximo = P1 × (1 − c) − f`.
- **En 3 meses:** `CAC máximo = (P1 × (1 − c) − f) + r2 × (P2 × (1 − c) − f) + r3 × (P3 × (1 − c) − f)`, donde `P1`, `P2` y `P3` son los cobros de los meses 1, 2 y 3, y `r2` y `r3` son la parte de los usuarios de pago que sigue pagando en el mes 2 y el mes 3. En el anual los 3 meses están cubiertos por el primer cobro, así que su CAC a 3 meses es el del primer pago.

Renovación en el mes 2 (`r2`) y en el mes 3 (`r3`): **por medir**. Todavía no hay ningún segundo cobro (los primeros cobros son el 8 de noviembre) y `subscriptions` no guarda cada renovación (ver los límites de [tablero-diario.md](tablero-diario.md)).

| Plan y forma de pago | Recuperar en el primer pago, techo antes de comisión | Fórmula | Recuperar en 3 meses si todos renuevan (r2 = r3 = 1), techo antes de comisión | Fórmula | Con la renovación real |
| --- | ---: | --- | ---: | --- | --- |
| Entreno, primer mes con 50 % | $4.99 | 4.99 × (1 − c) − f | $24.97 | 4.99 + 9.99 + 9.99, menos comisión de 3 cobros | por medir |
| Entreno, mensual sin 50 % | $9.99 | 9.99 × (1 − c) − f | $29.97 | 9.99 × 3, menos comisión de 3 cobros | por medir |
| Entreno, anual | $59.99 | 59.99 × (1 − c) − f | $59.99 | 59.99, menos comisión de 1 cobro | no depende de la renovación |
| Entreno + Nutrición, primer mes con 50 % | $7.49 | 7.49 × (1 − c) − f | $37.47 | 7.49 + 14.99 + 14.99, menos comisión de 3 cobros | por medir |
| Entreno + Nutrición, mensual sin 50 % | $14.99 | 14.99 × (1 − c) − f | $44.97 | 14.99 × 3, menos comisión de 3 cobros | por medir |
| Entreno + Nutrición, anual | $89.99 | 89.99 × (1 − c) − f | $89.99 | 89.99, menos comisión de 1 cobro | no depende de la renovación |

Cómo leerla:

- **El CAC que manda es el del primer pago.** La columna de 3 meses supone que todos renuevan, y eso no está medido. Hasta que haya renovación real, un CAC por encima del primer pago es una apuesta, no un negocio rentable.
- El caso más exigente es quien deja la tarjeta en Entreno: su primer pago es $4.99. La mezcla real de planes está por medir. Si la mayoría de los pagos nuevos son de ese tipo, el CAC de la semana tiene que quedar en $4.99 o menos, y menos aún después de la comisión, para que el margen no sea negativo.
- El techo de $14.98 del [acta](100-usuarios-de-pago.md) ($4.99 + $9.99) es la recuperación en 2 meses de Entreno con 50 %, sin comisión y con renovación de 100 %. Este documento es más estricto: la semana tiene que pagarse con los primeros pagos.

## 3. La regla de presupuesto autofinanciado

**El gasto en anuncios de la semana siguiente no pasa de los ingresos nuevos netos de la semana anterior, ni del tope semanal que fija Andrés.**

**Gasto máximo de la semana N + 1 = mínimo(ingresos nuevos netos de la semana N, tope semanal)**

- **Semana:** de lunes a domingo, hora de Costa Rica, igual que el tablero diario.
- **Ingresos nuevos netos:** suma de los primeros pagos cobrados en la semana (cobro de la prueba o de la beta en `trial_charges` con `status = 'succeeded'`, y pagos en el muro de planes), menos comisión: `ingresos brutos × (1 − c) − f × pagos nuevos`. Las renovaciones no cuentan para la regla: se reportan aparte cuando se puedan medir.
- **Tope semanal:** **por confirmar con Andrés**. Lo fija él y puede bajarlo cuando quiera. La regla nunca lo sube.
- **Mientras la comisión esté por confirmar,** los ingresos netos quedan "por medir" y el reporte usa los ingresos brutos solo como techo: la decisión puede ser "mantener" o "pausar", nunca "subir".
- **Si una semana no tiene ingresos nuevos,** el máximo de la semana siguiente es $0.00. La regla no presta contra cobros futuros, ni siquiera los programados para el 8 de noviembre.
- **Desde cuándo:** Andrés decide el primer lunes en que se aplica. Este documento no cambia el gasto que ya está aprobado.

La regla solo pone un techo. Llegar al techo no es obligatorio, y cualquier aumento lo aprueba Andrés antes de tocar Meta Ads.

## 4. Reporte de cada lunes

### De dónde sale cada dato

1. **Gasto de la semana:** Andrés corre [tablero-diario.sql](tablero-diario.sql) con `desde` = lunes y `hasta` = domingo de la semana anterior, con el gasto de Meta Ads de cada día en `gasto_manual` (ver [tablero-diario.md](tablero-diario.md)). Gasto de la semana = suma de `gasto_usd` de los 7 días. Si falta un día, el gasto queda "por medir": no se completa con promedios.
2. **Pagos nuevos por plan e ingresos:** Andrés corre [rentabilidad-semanal.sql](rentabilidad-semanal.sql) en Supabase > SQL Editor con `lunes` = el lunes de la semana anterior. Es una sola consulta SELECT de solo lectura: no crea tablas ni escribe datos. Devuelve, por plan, forma de pago y 50 % del primer mes, los `pagos_nuevos` y los `ingresos_brutos_usd`, más una fila `total`. Usa las mismas reglas de pago del tablero: excluye cortesías vigentes y cuenta a cada persona una sola vez.
3. **Conciliación:** los ingresos se comparan con los portales de Tilopay y ONVO antes de decidir, como en la etapa 6 del [embudo](../../marketing/estrategia/embudo-noviembre.md).

Diferencia con el tablero: el tablero agrupa por **día de creación de la cuenta** (cohorte); este reporte agrupa por **semana de pago**. Con la prueba de 7 días, una cuenta creada un domingo paga la semana siguiente. Para la regla se usa la semana de pago (el dinero que entró); el costo por cohorte (`costo_cliente_pago_total_usd` del tablero) se anota al lado para ver qué semanas de anuncios trajeron pagos.

Límites de `rentabilidad-semanal.sql`: la fecha del cobro automático es `last_attempt_at` (o `updated_at` si falta), no `charge_at`. El pago en el muro de planes se fecha con la primera fila de `subscriptions` de la persona y se valora al precio de lista de `src/lib/plans.ts`, porque `subscriptions` no guarda el importe; y solo aparece si la suscripción sigue vigente al correr la consulta. Por eso se concilia con los procesadores.

### Plantilla

Se copia cada lunes. Cada campo sin dato dice "por medir"; ningún número se completa a mano sin su fuente.

```
Reporte de rentabilidad: semana del lunes [fecha] al domingo [fecha], hora de Costa Rica
Preparado por: Martín. Datos de: Andrés (tablero-diario.sql y rentabilidad-semanal.sql, corridos el [fecha]).

1. Gasto en Meta Ads de la semana (G): $ por medir
   Fórmula: suma de gasto_usd de los 7 días en tablero-diario.sql.

2. Pagos nuevos por plan (rentabilidad-semanal.sql):
   Entreno, primer mes con 50 % ($4.99):            por medir
   Entreno, mensual sin 50 % ($9.99):               por medir
   Entreno, anual ($59.99):                         por medir
   Entreno + Nutrición, primer mes con 50 % ($7.49): por medir
   Entreno + Nutrición, mensual sin 50 % ($14.99):  por medir
   Entreno + Nutrición, anual ($89.99):             por medir
   Total de pagos nuevos (N):                       por medir

3. Ingresos de la semana
   Brutos (B): $ por medir. Fórmula: ingresos_brutos_usd de la fila total.
   Comisión del procesador: c = por confirmar con Andrés, f = por confirmar con Andrés.
   Netos (I): $ por medir. Fórmula: B × (1 − c) − f × N.
   Conciliado con Tilopay y ONVO: sí / no.

4. CAC de la semana: $ por medir. Fórmula: G ÷ N. Si N = 0, no hay CAC: el gasto no trajo pagos.
   Ingreso neto promedio por pago nuevo: $ por medir. Fórmula: I ÷ N.
   CAC por cohorte del tablero (costo_cliente_pago_total_usd): $ por medir.

5. Margen de la semana: $ por medir. Fórmula: I − G.
   Margen positivo o cero equivale a CAC ≤ ingreso neto promedio por pago nuevo.

6. Renovaciones del mes 2 y 3 (r2, r3): por medir.

7. Gasto máximo de la semana siguiente: $ por medir. Fórmula: mínimo(I, tope semanal).
   Tope semanal: por confirmar con Andrés.

8. Decisión propuesta: subir / mantener / pausar. Motivo: [regla que aplica].
   Aprobación de Andrés: pendiente. Nada cambia en Meta Ads antes de su sí.
```

### Cómo se decide

Se revisa en este orden y se aplica la primera que se cumpla:

| Orden | Decisión | Cuándo |
| --- | --- | --- |
| 1 | **Pausar** | Margen negativo (I < G), o hay gasto y N = 0. |
| 2 | **Mantener** | Falta un dato (gasto de algún día, comisión o conciliación), o el gasto de la semana ya está en el máximo de la sección 3. Mantener nunca pasa del máximo. |
| 3 | **Subir** | Margen positivo o cero, todos los datos completos y conciliados, y el máximo de la semana siguiente es mayor que el gasto de esta semana. Se propone subir hasta ese máximo, nunca más; Andrés aprueba el monto. |

Si la decisión es "pausar", el reporte dice qué paso del embudo falló según el tablero (registro, tarjeta o cobro) para que el siguiente issue sea sobre ese paso, no sobre más anuncios.

## 5. Qué paso del embudo mueve y por qué no agrega costo

- **Paso:** pago, y después renovación. La regla obliga a que cada semana de anuncios se pague con primeros pagos, y el reporte separa los pagos por plan y por 50 % para ver qué plan financia los anuncios.
- **Cómo se mide:** pagos nuevos e ingresos de `rentabilidad-semanal.sql`, gasto de `gasto_manual` en `tablero-diario.sql`, CAC = gasto ÷ pagos nuevos y margen = ingresos netos − gasto, cada lunes. La renovación se mide cuando haya segundos cobros (por medir).
- **Por qué no agrega costo:** son dos consultas de solo lectura que Andrés corre en Supabase y una plantilla de texto. No crea campañas, no sube presupuestos, no envía correos ni publica nada. Lo único que puede hacer la regla es poner un techo al gasto.
