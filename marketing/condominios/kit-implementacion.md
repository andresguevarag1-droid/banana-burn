# Kit de implementación para el condominio que dijo que sí

Qué hacer después de la reunión virtual con una administración que aceptó sumarse, en orden. Cada paso trae el correo listo para copiar. Los correos los envía solo Harvey, desde hola@bananaburn.app y con la aprobación de Andrés: este documento es el texto para que Andrés lo revise y lo pegue en harvey-config.

La oferta no cambia: primer mes gratis para todos los residentes, con todo incluido y sin tarjeta; la administración y el condominio nunca pagan nada; al terminar el mes, cada residente decide si sigue y paga su propio plan.

## Cómo funciona por dentro (verificado en el código)

- Panel: Admin, Condominios, sección "Condominios afiliados" (`src/app/admin/condominios/page.tsx`). Ahí se crea el condominio, se copia su enlace, se copia el mensaje para el grupo y se abre el afiche con QR.
- Enlace de los residentes: `https://www.bananaburn.app/c/codigo` (`src/app/c/[code]/`). No confundir con `bananaburn.app/condominios?c=Nombre%20del%20Condominio`, que es la página para administraciones antes de la reunión.
- Cada residente que entra con el enlace recibe 30 días del plan completo (entreno y nutrición) desde el día en que lo activa, no desde el día en que se creó el condominio (`CONDO_FREE_DAYS` en `src/lib/condos.ts`). Un mes gratis por cuenta y una cuenta en un solo condominio.
- El enlace funciona mientras el condominio esté en estado "Mes gratis". En "Terminado" deja de servir.
- La administración solo recibe conteos: "Residentes vinculados" y "Entrenaron esta semana" (últimos 7 días). Nunca nombres, pesos, entrenos ni comidas. Esos dos números son los únicos que van en los correos.

## Lo que el sistema ya envía (no duplicarlo ni contradecirlo)

El cron diario (`src/app/api/cron/recordatorios/route.ts`, `sweepCondos` en `src/lib/condos-server.ts`) hace esto con los condominios:

- Al activar el enlace, el residente recibe un aviso en la app: "Tu condominio [nombre] te regala el primer mes".
- 3 días antes de que terminen sus propios 30 días, el residente recibe un correo ("Tu mes gratis del condominio termina pronto") y un aviso en la app. Le dice que, si quiere seguir, elige su plan individual en Mi plan, que no se le cobra nada automáticamente y que su historial queda guardado.
- A la administración el sistema no le envía nada. Por eso existen los correos de los pasos 5 y 6.

Consecuencias para este kit: nadie le escribe a los residentes por su cuenta sobre el fin del mes (ya lo hace el sistema, con la fecha de cada uno), y a la administración no se le pide publicar un aviso de cierre en el grupo, porque cada residente termina en una fecha distinta.

## Calendario

| Paso | Cuándo | Quién |
| --- | --- | --- |
| 1. Crear el condominio en Admin | El día de la reunión, con el nombre confirmado | Equipo de Banana Burn |
| 2. Enviar el enlace /c/ | El mismo día de la creación (día 0) | Harvey |
| 3. Imprimir y colocar el afiche | Día 0 o día 1 | Harvey envía el PDF; la administración imprime y coloca |
| 4. Publicar el mensaje en el grupo de residentes | Cuando el afiche esté colocado (día 1 o 2) | Harvey envía el texto; la administración lo publica |
| 5. Recordatorio a los 7 días | 7 días después del paso 4 | Harvey |
| 6. Aviso 3 días antes de que termine el mes | Día 27: 3 días antes de la fecha final de "Mes gratis" que muestra el panel | Harvey |

Firma de todos los correos (la de Harvey, sin teléfonos ni WhatsApp):

```
Andrés Guevara
Fundador, Banana Burn
bananaburn.app
```

En los textos, lo que va entre corchetes se reemplaza antes de aprobar: [Nombre del condominio], [codigo], [N], [M].

---

## Paso 1. Crear el condominio en Admin

Primero se confirma el nombre exacto, porque sale en el afiche, en la página del enlace y en el aviso que recibe cada residente.

Correo a la administración, el mismo día de la reunión:

```
Asunto: datos del condominio

Hola, administración de [Nombre del condominio].

Gracias por el tiempo de hoy. Para activar el condominio necesito dos datos: el nombre tal como lo conocen los residentes, porque es el que aparece en el afiche y en el enlace, y el número aproximado de unidades.

¿Me los confirmas en este correo?

Andrés Guevara
Fundador, Banana Burn
bananaburn.app
```

Con la respuesta, en el panel:

1. Admin, Condominios, sección "Condominios afiliados", abrir "Crear un condominio".
2. "Nombre del condominio": el nombre confirmado (de 2 a 80 caracteres).
3. "Administradora (opcional)": la empresa administradora, si la hay.
4. "Unidades aprox. (opcional)": el número que dieron.
5. "Código del enlace (opcional)": si se deja vacío, sale del nombre sin las palabras condominio, residencial, torre ni condo ("Condominio Las Palmas" queda `las-palmas`). Lleva de 3 a 30 minúsculas, números o guiones. Revísalo bien: el panel no permite cambiarlo después y es lo que va impreso en el QR.
6. "Solicitud de origen (opcional)": la solicitud de reunión de esa administración, si llegó por /condominios.
7. "Crear condominio". El panel responde "Condominio creado. Su enlace: https://www.bananaburn.app/c/codigo" y el condominio queda en "Mes gratis".
8. En "Solicitudes de reunión virtual", cambiar la solicitud a "Cerrado" y anotar en "Notas internas" que se afilió.

Reglas del panel:

- Dejar el condominio en "Mes gratis". No usar "Activo": ese estado significa que el condominio paga un plan para sus residentes, y la oferta dice que la administración nunca paga.
- No pasarlo a "Terminado" sin que Andrés lo decida: el enlace deja de servir para quien no lo haya activado.

## Paso 2. Enviar el enlace /c/

Copiar el enlace con el botón "Copiar enlace" del condominio (no escribirlo a mano). Abrirlo antes de enviarlo y comprobar que la página muestra el nombre del condominio y el botón "Activar mi mes gratis".

```
Asunto: el enlace del condominio

Hola, administración de [Nombre del condominio].

[Nombre del condominio] ya está activo en Banana Burn. Este es su enlace exclusivo:

https://www.bananaburn.app/c/[codigo]

Cada residente que entra con él tiene 30 días gratis con todo incluido, desde el día en que lo activa y sin tarjeta. La administración no paga nada, y al terminar el mes cada residente decide si sigue con su plan.

¿Lo abres y me confirmas que ves el nombre del condominio arriba?

Andrés Guevara
Fundador, Banana Burn
bananaburn.app
```

## Paso 3. Imprimir y colocar el afiche

En el panel, botón "Afiche con QR" del condominio (`/admin/condominios/[id]/afiche`), luego "Imprimir afiche" y "Guardar como PDF", con encabezados y pies de página desactivados. Revisar que el PDF sea una sola página A4 con el nombre del condominio y que el QR abra el enlace del paso 2. Se adjunta al correo.

```
Asunto: afiche para el gimnasio

Hola, administración de [Nombre del condominio].

Te adjunto el afiche del condominio en PDF, tamaño A4. Su QR abre el enlace de [Nombre del condominio], así cada residente activa su mes gratis con la cámara del celular.

Imprímelo a color y en tamaño real, sin ajustar a la página, para que el QR se lea bien. Los mejores lugares son el gimnasio, el ascensor y el lobby.

¿Me avisas cuando esté colocado para enviarte el mensaje del grupo de residentes?

Andrés Guevara
Fundador, Banana Burn
bananaburn.app
```

## Paso 4. Publicar el mensaje en el grupo de residentes

El texto para el grupo sale del botón "Copiar mensaje de WhatsApp" del panel (`condoWhatsapp` en `src/lib/condos.ts`), que ya trae el nombre y el enlace. Es el mismo texto de abajo; usar el botón evita errores en el enlace.

```
Asunto: mensaje para los residentes

Hola, administración de [Nombre del condominio].

Este es el mensaje para el grupo de residentes. Puedes copiarlo tal cual:

Hola, vecinos de [Nombre del condominio].

El condominio se unió a Banana Burn: un entrenador personal en el celular para cada residente, con el plan de cada semana, la técnica de cada ejercicio y un coach que responde dudas a cualquier hora.

El primer mes es gratis para todos los residentes, con todo incluido. No se necesita tarjeta.

Actívalo aquí: https://www.bananaburn.app/c/[codigo]

La página del enlace explica que al terminar el mes cada residente decide si sigue, y que nadie le cobra nada automáticamente. ¿Te parece publicarlo hoy, ahora que el afiche ya está colocado?

Andrés Guevara
Fundador, Banana Burn
bananaburn.app
```

## Paso 5. Recordatorio a los 7 días

7 días después de que la administración publicó el mensaje. [N] es "Residentes vinculados" y [M] es "Entrenaron esta semana", tal como los muestra el panel ese día. Si [N] es 0, quitar la segunda oración del correo.

```
Asunto: primera semana

Hola, administración de [Nombre del condominio].

Va una semana desde el mensaje en el grupo. Hasta hoy, [N] residentes activaron su mes gratis y [M] entrenaron en los últimos 7 días. Solo te comparto esos conteos, nunca datos de nadie.

En los grupos, muchos residentes ven el mensaje tarde o se les pierde. Este recordatorio corto llega a quienes no lo vieron:

Residentes de [Nombre del condominio]: el primer mes de Banana Burn es gratis para cada residente, con todo incluido y sin tarjeta. Tus 30 días empiezan el día que lo activas, y al terminar decides si sigues con tu plan. Actívalo aquí: https://www.bananaburn.app/c/[codigo]

¿Lo puedes publicar en el grupo esta semana?

Andrés Guevara
Fundador, Banana Burn
bananaburn.app
```

## Paso 6. Aviso 3 días antes de que termine el mes

3 días antes de la fecha final que muestra el panel en "Mes gratis" (30 días después de crear el condominio). Para entonces, los primeros residentes que activaron el enlace reciben del sistema su propio aviso. Este correo prepara a la administración por si alguien le pregunta. No menciona una fecha de cierre del enlace: cada residente tiene sus 30 días desde que lo activó, y mientras el condominio siga en "Mes gratis" el enlace sigue funcionando.

```
Asunto: fin del primer mes

Hola, administración de [Nombre del condominio].

Los primeros residentes que activaron su mes gratis llegan en estos días al final de sus 30 días. Hasta hoy se unieron [N] residentes y [M] entrenaron en los últimos 7 días.

Cada uno recibe un correo de Banana Burn 3 días antes de su fecha. Ahí decide si sigue con su plan individual o deja de usar la app. No hay cobros automáticos y la administración no paga nada ni tiene que avisar a nadie.

¿Te preparo un resumen corto con estos números para la junta?

Andrés Guevara
Fundador, Banana Burn
bananaburn.app
```

---

## Lista de verificación para la administración

Seis puntos que la administración puede marcar. Se puede enviar junto con el correo del paso 2 o cuando la pidan.

```
Lista de verificación de Banana Burn para [Nombre del condominio]

[ ] 1. Abrí el enlace del condominio y vi su nombre en la página.
[ ] 2. Imprimí el afiche A4 a color y en tamaño real.
[ ] 3. Coloqué el afiche en el gimnasio y en otro lugar de paso, como el ascensor o el lobby.
[ ] 4. Publiqué el mensaje en el grupo de residentes.
[ ] 5. Publiqué el recordatorio en el grupo a los 7 días.
[ ] 6. Compartí con la junta los conteos de residentes que se unieron y entrenaron.

La administración no paga nada. Cada residente tiene 30 días gratis desde que lo activa y después decide si sigue con su plan. Dudas: hola@bananaburn.app
```

## Antes de aprobar cada correo

- El nombre del condominio está escrito igual que en el panel.
- Máximo un enlace por correo, y es el `/c/` del condominio (nunca el de /condominios).
- Sin precios, salvo que la administración pregunte: Entreno $9.99/mes o Entreno + Nutrición $14.99/mes.
- Sin teléfonos, sin WhatsApp propio, sin emojis, sin signos de exclamación y sin mencionar IA.
- Si la administración pregunta algo que este kit no resuelve: "Andrés lo confirma".
- Si dicen que no o piden no recibir más correos, no se responde.
