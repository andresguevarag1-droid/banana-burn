# Ficha de lanzamiento: campañas del 9 de noviembre (Costa Rica y Colombia)

> **ACTIVA por decisión de Andrés (9 nov 2026, 12:57 a. m.):** «Traer registros está bien porque en 7 días pagan». Reemplaza el aviso de pausa hasta 30 % de activación (#215). Estado en Meta: «BB | Registro web | Por país | desde 9 nov», Colombia + Guatemala US$5.50 al día y Costa Rica US$2.50 al día hasta el 20 nov a las 11:59 p. m.; Estados Unidos (solo español) US$2 al día hasta el 15 nov. Anuncios: Cuánto peso, Gym del condominio y Casa gym parque; el relevo «Copiar al de al lado» queda en pausa. Tope de noviembre: US$200. Para saber si se paga sola hace falta que los cobros lleguen al píxel como `Subscribe` (#293).

La configuración exacta para que, **si Andrés aprueba el lunes 9 de noviembre**, la campaña de [campana-conversion-noviembre.md](campana-conversion-noviembre.md) se cree en Ads Manager en pocos minutos y **quede en pausa** hasta que él la encienda. Es una ficha, no un gasto: **nada se crea ni se activa en Meta** con este documento, no se publica ni se envía nada y no cambia código.

- La condición para usarla es la de la sección 1 de [campana-conversion-noviembre.md](campana-conversion-noviembre.md): la semana del 2 al 8 de noviembre cumple la regla de [rentabilidad-semanal.md](rentabilidad-semanal.md). Si no la cumple, el gasto de la semana del 9 al 15 es $0.00 y esta ficha no se usa.
- Lo que el repositorio no puede verificar dice **"por confirmar en Ads Manager"**. Lo que decide Andrés dice "decisión de Andrés". Lo que no tiene dato dice "por medir".
- Las cifras salen de `src/lib/plans.ts`, `src/lib/trial.ts` y de la fórmula del neto de la regla, y las vigila `src/lib/campanas-9-noviembre-ficha.test.ts`.

## 1. Antes de crear nada

Se marca cada punto. Si uno queda en "no", el conjunto afectado no se crea.

| Punto | Dónde se verifica | Estado |
| --- | --- | --- |
| La regla se cumple con la semana del 2 al 8 de noviembre y Andrés lo aprueba por escrito | Reporte del lunes 9 ([rentabilidad-semanal.md](rentabilidad-semanal.md)) | decisión de Andrés |
| Nivel de presupuesto elegido (sección 5) | Andrés | decisión de Andrés |
| Tilopay encendido en producción para las tarjetas de fuera de Costa Rica. Sin esto el conjunto de Colombia **no se crea**: sus pagos caerían en ONVO y no se podría leer el país | Andrés | por confirmar con Andrés |
| El píxel "Banana Burn" (dataset `1544502257509303`) recibe `CompleteRegistration` en los últimos 7 días | Events Manager > Banana Burn > Resumen | por confirmar en Ads Manager |
| La cuenta publicitaria y la página de Facebook e Instagram @bananaburnapp que se usaron en octubre | Ads Manager > Configuración | por confirmar en Ads Manager |
| El Reel "Cuánto peso" de octubre sigue disponible en la cuenta (id del anuncio o del video) | Ads Manager > Anuncios de octubre | por confirmar en Ads Manager |

## 2. Objetivo y evento (verificado en el código)

| Campo | Valor |
| --- | --- |
| Objetivo de la campaña | Ventas |
| Ubicación de la conversión | Sitio web |
| Píxel | "Banana Burn", dataset `1544502257509303` (`DEFAULT_PIXEL_ID` en `src/lib/meta-pixel.ts`) |
| Evento de optimización | **`CompleteRegistration`** (prueba iniciada) |
| Presupuesto | En cada conjunto (sin Advantage+ campaign budget), para que cada país gaste solo lo aprobado |

Por qué `CompleteRegistration` es la prueba iniciada, según el repositorio:

- La prueba de 7 días empieza al crear la cuenta, sin tarjeta (`TRIAL_DAYS` = 7 en `src/lib/plans.ts`).
- Al terminar `/bienvenida`, la app registra `onboarding_done` (`src/app/bienvenida/wizard.tsx`), y `toMetaEvent` en `src/lib/meta-pixel.ts` lo traduce a **`CompleteRegistration`** con el parámetro `status` = `"trial"` si la cuenta tiene prueba y `"registered"` si no.
- El mismo evento llega desde el navegador (píxel) y desde el servidor (`sendCapi` en `src/lib/meta-capi.ts`, si existe `META_CAPI_TOKEN`) con el mismo `event_id`, y Meta lo deduplica. Si la API de Conversiones está encendida en producción: por confirmar en Ads Manager (Events Manager muestra "Servidor" como fuente del evento).
- No existe un evento `StartTrial` en el código: no se elige en Meta.
- `Subscribe` no se usa para optimizar esta semana: llega 7 días después del registro o más, y el del cobro automático (`sendChargeSubscribe`) sale como `system_generated` sin cookies de Meta, así que puede no unirse al anuncio.

Conversión personalizada opcional: "BB prueba iniciada" = `CompleteRegistration` con `status` = `trial`. Sirve si Meta permite optimizar con ella en esta cuenta; si no, se usa el evento estándar. Disponibilidad: por confirmar en Ads Manager.

## 3. Campaña y conjuntos

### Campaña

| Campo | Valor |
| --- | --- |
| Nombre | `BB Conv Nov26` |
| Categoría especial de anuncios | Ninguna |
| Estado al crear | **En pausa** (se guarda como borrador o se apaga antes de publicar) |
| Límite de gasto de la campaña | El máximo de la regla para la semana, como mucho el total del nivel elegido (sección 5) |
| Prueba A/B de Meta | No: los anuncios compiten dentro de cada conjunto |

### Conjuntos de anuncios

Un conjunto por país, con la misma configuración salvo el país y el presupuesto.

| Campo | Costa Rica | Colombia |
| --- | --- | --- |
| Nombre | `BB Conv Nov26 CR` | `BB Conv Nov26 CO` |
| Ubicación | Costa Rica (personas que viven en el país) | Colombia (personas que viven en el país) |
| Edad | 18 a 55 años | 18 a 55 años |
| Género | Todos | Todos |
| Idioma | Español | Español |
| Público | Advantage+ audience sin intereses ni sugerencias | Advantage+ audience sin intereses ni sugerencias |
| Exclusiones | BB registrados y BB suscriptores (sección 3.2) | BB registrados y BB suscriptores (sección 3.2) |
| Ubicaciones | Manuales, solo celular (sección 3.1) | Manuales, solo celular (sección 3.1) |
| Presupuesto diario | Según el nivel (sección 5) | Según el nivel (sección 5) |
| Inicio | Lunes 9 de noviembre (o el día que Andrés apruebe), 00:00, hora de Costa Rica | Igual |
| Fin | Domingo 15 de noviembre, 23:59, hora de Costa Rica. No se renueva sola | Igual |
| Atribución | 7 días después del clic y 1 día después de ver el anuncio (la predeterminada; si la cuenta muestra otra, por confirmar en Ads Manager) | Igual |
| Página de llegada | `https://www.bananaburn.app/` | `https://www.bananaburn.app/` |

Edad: Meta exige 18 como mínimo en anuncios de peso y es nuestra regla. Con Advantage+ audience, el 18 queda como control fijo y el 55 puede quedar como sugerencia que Meta amplía; si la cuenta permite fijar 55 como máximo en los controles de público: por confirmar en Ads Manager.

### 3.1 Ubicaciones: solo Instagram y Facebook, en celular

- **Ubicaciones manuales.** Plataformas: solo Instagram y Facebook.
- **Dispositivos: solo celulares** (en "Dispositivos y sistemas operativos móviles específicos": todos los celulares, sin computadoras).
- Dentro de cada plataforma, solo los espacios verticales 9:16, donde el Reel se ve completo:
  - Instagram: Reels, Stories, Explorar.
  - Facebook: Reels, Stories.
- Fuera: Audience Network, Messenger, Threads, columna derecha, videos in-stream, Marketplace y resultados de búsqueda.
- Igual que en [meta-ads-noviembre.md](../../marketing/estrategia/meta-ads-noviembre.md).

### 3.2 Públicos que se excluyen

| Público personalizado | Fuente | Ventana | ID en Meta |
| --- | --- | --- | --- |
| BB registrados | Píxel "Banana Burn": `CompleteRegistration` | 180 días | por confirmar en Ads Manager |
| BB suscriptores | Píxel "Banana Burn": `Subscribe` | 180 días | por confirmar en Ads Manager |
| BB lista de usuarios (opcional) | Lista de correos de cuentas existentes, que Meta sube con hash | Se actualiza el 9 de noviembre | por confirmar en Ads Manager; decisión de Andrés, porque son datos de clientes |

- **Los IDs no están en el repositorio.** El issue pide los de `marketing/plan-ads-octubre-2026.md`, y ese archivo **no existe** (ni en su historial). Ningún otro documento guarda IDs de públicos. Por eso cada ID queda "por confirmar en Ads Manager" (Públicos > columna "ID"), y se anota aquí al crear el conjunto.
- Si un público no existe, se crea con ese nombre, fuente y ventana. No se editan los públicos que use una campaña activa.
- **Límite conocido:** el `Subscribe` del cobro automático sale desde el servidor solo con el id con hash (`chargePayload` en `src/lib/meta-capi.ts`), y el píxel no corre dentro de la app nativa (`isNativeApp` en `src/components/meta-pixel.tsx`). "BB suscriptores" puede no incluir a todos los que pagan; la lista de usuarios los cubre.

## 4. Anuncios: "Cuánto peso" y sus variantes CP2 a CP4

Los mismos anuncios en los dos conjuntos. **Al crear el 9 de noviembre solo existe "Cuánto peso"**: CP2, CP3 y CP4 están en guion y proyecto (`marketing/videos/CP2-CP4_medicion.md`), sin MP4 todavía, porque falta el PNG oficial de Coach Banana señalando. Cada variante se agrega al conjunto **solo cuando exista su MP4 de 11 s y Andrés lo apruebe**, sin reiniciar el conjunto. Fecha prevista en su paquete: 16 de noviembre.

| Anuncio en Costa Rica | Anuncio en Colombia | Creatividad | Archivo | Estado |
| --- | --- | --- | --- | --- |
| `BB Conv Nov26 CR Cuanto peso` | `BB Conv Nov26 CO Cuanto peso` | Reel "Cuánto peso" de octubre, el mismo video | El de la campaña de octubre: por confirmar en Ads Manager | Se crea el 9 |
| `BB Conv Nov26 CR CP2 11s` | `BB Conv Nov26 CO CP2 11s` | CP2, otra persona en el gym del condominio | `CP2_otra-persona-condominio_11s.mp4` | Pendiente de render y aprobación |
| `BB Conv Nov26 CR CP3 11s` | `BB Conv Nov26 CO CP3 11s` | CP3, "¿Con cuánto peso empiezo?" desde el primer cuadro | `CP3_con-cuanto-empiezo_11s.mp4` | Pendiente de render y aprobación |
| `BB Conv Nov26 CR CP4 11s` | `BB Conv Nov26 CO CP4 11s` | CP4, el peso indicado en la pantalla de la app | `CP4_peso-en-pantalla_11s.mp4` | Pendiente de render y aprobación |

- El Reel "El Nuevo" sigue pausado desde el 31 de octubre y no entra.
- CP2 muestra el gym de un condominio, pero **no ofrece el mes gratis de condominios**: esa oferta solo existe en Costa Rica y no aparece en ningún anuncio de esta campaña.
- Ningún anuncio habla de GLP-1. Si después entra uno de GLP-1, su texto lleva "No sustituye la indicación de tu médico." y va a `/glp1`.
- Formato: 9:16, 1080 × 1920. CP2 a CP4 van sin audio, como dice su paquete.

### Texto (igual en todos los anuncios)

Es el texto aprobado para principiantes en [meta-ads-noviembre.md](../../marketing/estrategia/meta-ads-noviembre.md):

- Texto principal: "Si no sabes cuánto peso usar, empieza aquí. Rutina a tu nivel y técnica de cada ejercicio. 7 días gratis, sin tarjeta."
- Título: "Empieza 7 días gratis"
- Descripción: "Sin tarjeta. Cancelas cuando quieras."
- Botón: Registrarte
- Mejoras automáticas de Advantage+ creative (texto, música, plantillas): apagadas, para que Meta no cambie el texto aprobado.
- Nada de urgencia, contadores, testimonios ni antes y después.

### UTMs (minúsculas, sin acentos)

| Anuncio | URL final |
| --- | --- |
| Costa Rica, Cuánto peso | https://www.bananaburn.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=bb-conv-nov26&utm_content=cr-conv-a-15s |
| Costa Rica, CP2 | https://www.bananaburn.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=bb-conv-nov26&utm_content=cr-conv-cp2-11s |
| Costa Rica, CP3 | https://www.bananaburn.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=bb-conv-nov26&utm_content=cr-conv-cp3-11s |
| Costa Rica, CP4 | https://www.bananaburn.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=bb-conv-nov26&utm_content=cr-conv-cp4-11s |
| Colombia, Cuánto peso | https://www.bananaburn.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=bb-conv-nov26&utm_content=co-conv-a-15s |
| Colombia, CP2 | https://www.bananaburn.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=bb-conv-nov26&utm_content=co-conv-cp2-11s |
| Colombia, CP3 | https://www.bananaburn.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=bb-conv-nov26&utm_content=co-conv-cp3-11s |
| Colombia, CP4 | https://www.bananaburn.app/?utm_source=meta&utm_medium=paid_social&utm_campaign=bb-conv-nov26&utm_content=co-conv-cp4-11s |

Los de "Cuánto peso" son los de [campana-conversion-noviembre.md](campana-conversion-noviembre.md) (anuncio A); que el video de octubre dure 15 s: por confirmar en Ads Manager. Los UTM sirven para leer Ads Manager y la analítica web; **la app no los guarda** sin `?ref=` (`src/components/ref-capture.tsx`), así que no unen un pago a un anuncio.

## 5. Presupuesto según la regla

**Gasto máximo de la semana del 9 al 15 = mínimo(ingresos nuevos netos de la semana del 2 al 8, $70.00, $200.00 − gasto de noviembre)**, para los dos conjuntos juntos ([rentabilidad-semanal.md](rentabilidad-semanal.md), sección 3). El nivel elegido tiene que caber en ese máximo; si no cabe ninguno, se sigue la última fila de la tabla de la sección 5 de [campana-conversion-noviembre.md](campana-conversion-noviembre.md).

| Nivel | Costa Rica por día | Colombia por día | Costa Rica, 7 días | Colombia, 7 días | Límite de la campaña | Pagos para recuperar Costa Rica (Entreno con 50 %, $3.87) | Pagos para recuperar Colombia (Entreno con 50 %, $3.85) | Requisito |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | $2.50 | $2.50 | $17.50 | $17.50 | $35.00 | 5 | 5 | Máximo de la regla de $35.00 o más |
| 2 | $3.50 | $3.50 | $24.50 | $24.50 | $49.00 | 7 | 7 | Máximo de la regla de $49.00 o más |
| 3 | $5.00 | $5.00 | $35.00 | $35.00 | $70.00 | 10 | 10 | Máximo de la regla de $70.00 o más |

- **Recomendación: nivel 1**, como en la propuesta. Nivel elegido: decisión de Andrés.
- Pagos para recuperar = gasto del conjunto ÷ neto del primer pago más bajo de su procesador, redondeado hacia arriba. Con Entreno + Nutrición con 50 % ($5.99 con ONVO, $5.96 con Tilopay) hacen falta 3, 5 o 6 pagos por conjunto según el nivel.
- Si Meta pide un presupuesto diario mínimo mayor que el del nivel para optimizar por conversión: por confirmar en Ads Manager. Si lo pide, no se sube el presupuesto: se avisa a Andrés.
- El límite de la campaña y la fecha de fin quedan configurados en Meta, para que el gasto no pase del nivel aunque nadie apague nada.
- El gasto del 1 al 8 de noviembre y el de cualquier otra línea aprobada (boost orgánico, otra campaña) suman al tope de noviembre y al máximo de la semana.

## 6. Pasos en Ads Manager (unos 10 minutos)

1. Confirmar los 6 puntos de la sección 1.
2. Públicos: buscar "BB registrados" y "BB suscriptores"; crearlos si no existen; anotar sus IDs en la sección 3.2.
3. Crear la campaña `BB Conv Nov26` con objetivo Ventas, presupuesto en el conjunto y el límite de gasto del nivel.
4. Crear `BB Conv Nov26 CR` con la tabla de la sección 3 y el presupuesto del nivel.
5. Crear el anuncio `BB Conv Nov26 CR Cuanto peso` con el video de octubre, el texto y la URL de la sección 4.
6. Duplicar el conjunto como `BB Conv Nov26 CO`: cambiar solo el país, el nombre del anuncio y su `utm_content`. Solo si Tilopay está confirmado.
7. Revisar la vista previa en celular, en Reels y Stories de Instagram y de Facebook.
8. Dejar todo **en pausa** y avisar a Andrés. Solo él lo enciende.

## 7. Cómo leer cada país el lunes 16 de noviembre

Andrés corre las consultas después de la medianoche del domingo 15 (hora de Costa Rica) y exporta Ads Manager por conjunto y por anuncio, de lunes 9 a domingo 15.

| Dato | Costa Rica | Colombia | De dónde |
| --- | --- | --- | --- |
| Gasto del conjunto (G) | G de Costa Rica | G de Colombia | Ads Manager, export por conjunto |
| Pruebas iniciadas | `CompleteRegistration` del conjunto | `CompleteRegistration` del conjunto | Ads Manager |
| Costo por prueba iniciada | G de Costa Rica ÷ pruebas | G de Colombia ÷ pruebas | Ads Manager |
| Hook rate de cada anuncio | Reproducciones de 3 s ÷ impresiones | Igual | Ads Manager, export por anuncio |
| Pagos nuevos (N) | `pagos_nuevos` del subtotal `onvo` | `pagos_nuevos` del subtotal `tilopay` | `rentabilidad-semanal.sql` con `lunes` = `date '2026-11-09'` |
| Ingresos netos (I) | `ingresos_netos_usd` del subtotal `onvo` | `ingresos_netos_usd` del subtotal `tilopay` | `rentabilidad-semanal.sql` |
| Costo por usuario de pago | G de Costa Rica ÷ N de ONVO | G de Colombia ÷ N de Tilopay | Las dos filas de arriba |
| CAC máximo | I ÷ N del subtotal `onvo` | I ÷ N del subtotal `tilopay` | `rentabilidad-semanal.sql` |
| Margen del país | I de ONVO − G de Costa Rica | I de Tilopay − G de Colombia | Las filas de arriba |

Todos los valores de la semana: por medir.

Cómo leerlo:

- **El país se lee por el procesador**: ONVO cobra las tarjetas de Costa Rica y Tilopay las de fuera (`providerFor` en `src/lib/pay-provider.ts`). Es una aproximación: incluye pagos orgánicos y, en Tilopay, a todos los países que no son Costa Rica.
- **El lunes 16 todavía no se ve el pago de la gente que trajo el anuncio.** Quien se registra entre el 9 y el 15 termina su prueba de 7 días entre el 16 y el 22. Los pagos del 16 son del reintento del 9 y de las cuentas creadas del 2 al 8. La cohorte de la campaña se lee provisional el lunes 23 y cerrada el miércoles 25 (`pago_cerrado` en `embudo-de-pago.sql`), como dice la sección 7 de [campana-conversion-noviembre.md](campana-conversion-noviembre.md).
- Por eso el lunes 16 cada conjunto se juzga con dos cosas: **el margen del país** (el dinero que entró pagó lo gastado) y **el costo por prueba iniciada** contra el caso más exigente: **$1.36 en Costa Rica y $1.35 en Colombia** ($3.87 y $3.85 × 35.2 %, la meta de registro a pago del [acta](100-usuarios-de-pago.md)).
- Se propone **pausar un conjunto** si gastó $15 o más y su costo por prueba iniciada pasa de **$2.72 en Costa Rica** o **$2.70 en Colombia** (el doble del caso más exigente), o si su país tiene gasto y N = 0. El otro conjunto sigue con su presupuesto, sin recibir el del pausado.
- Entre anuncios, con este presupuesto la comparación es direccional: se mira hook rate y costo por prueba de cada anuncio, no se declara un ganador.
- La decisión de la semana del 16 al 22 (subir, mantener o pausar, por conjunto) sale del reporte de [rentabilidad-semanal.md](rentabilidad-semanal.md). Aprobación de Andrés: pendiente.

## 8. Qué paso del embudo mueve y cuánto dinero neto puede mover

- **Paso:** visita > registro (prueba iniciada) > primer pago, en cuentas nuevas de Costa Rica y Colombia. El resultado que cuenta es el primer pago (`trial_charges` con `status = 'succeeded'` y suscripciones vigentes), no la prueba ni el `Subscribe` de Meta.
- **Cómo se mide:** costo por usuario de pago y margen de cada país cada lunes (sección 7), y costo por usuario de pago de la cohorte del 9 al 15 en `tablero-diario.sql` el 23 y el 25 de noviembre.
- **Cuánto dinero neto deja cada pago**, con los precios de `src/lib/plans.ts` y `src/lib/trial.ts` y neto = cobro ÷ 1.13 − (cobro × c + $0.35):

| Primer pago | Cobro | Neto en Costa Rica (ONVO, 3.9 %) | Neto en Colombia (Tilopay, 4.25 %) |
| --- | ---: | ---: | ---: |
| Entreno, primer mes con 50 % | $4.99 | $3.87 | $3.85 |
| Entreno + Nutrición, primer mes con 50 % | $7.49 | $5.99 | $5.96 |
| Entreno, mes completo | $9.99 | $8.10 | $8.07 |
| Entreno + Nutrición, mes completo | $14.99 | $12.33 | $12.28 |
| Entreno, anual | $59.99 | $50.40 | $50.19 |
| Entreno + Nutrición, anual | $89.99 | $75.78 | $75.46 |

- Cuántos pagos trae la campaña: por medir. Lo que se fija es el mínimo para no perder: con el nivel 1, 5 pagos de Entreno con 50 % por país recuperan los $17.50 de cada conjunto.
- **Riesgo de dinero:** como máximo el nivel aprobado durante una semana ($70.00 como mucho, $200.00 en todo noviembre), nunca más que lo que se cobró la semana anterior, y $0.00 si Andrés no aprueba.
