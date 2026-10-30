# Correos de la prueba gratis (Resend)

Secuencia de 9 correos desde el registro hasta el primer cobro, pensada para la cohorte del lanzamiento: cuentas de la beta con cobro el 8 de noviembre de 2026 y cuentas nuevas desde el 1 de noviembre. Objetivo: subir la conversión de registro a primer pago (meta de prueba a pago: 35 %) y bajar el costo por cliente que paga.

Solo son documentos: no se envía nada ni se conecta nada a Resend. Todo envío necesita la aprobación de Andrés.

## Cómo se cuentan los días

- **Inicio de la prueba** = fin de la prueba menos 7 días (trialEndFor en src/lib/trial.ts).
  - Cuenta nueva: el momento del registro (profiles.created_at).
  - Cuenta de la beta: 1 de noviembre, 12:00 a. m. (fin de la beta, BETA_ENDS_AT). Su prueba termina al final del 7 de noviembre y el cobro de quien dejó tarjeta sale el 8 de noviembre (BETA_GRACE_UNTIL).
- **Día N** = inicio + (N − 1) días. Cada correo sale en la primera ventana de la hora indicada después de ese momento, así siempre cae dentro de la prueba.
- Para la cohorte de la beta, el día 1 es el 1 de noviembre y el día 7 es el 7 de noviembre.

## Tabla resumen

Horas en hora de Costa Rica (UTC-6, sin horario de verano).

| # | Correo | Disparador | Hora de envío | Fecha para la cohorte de la beta | CTA (un solo enlace) | Métrica que mueve |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | [Bienvenida (día 1)](01-bienvenida-dia-1.md) | Registro (cuenta nueva) o fin de la beta (cuenta de la beta) | Inmediato al registrarse; beta: 7:00 a. m. | 1 nov, 7:00 a. m. | Empezar mi día 1 (/app) | Activación: plan armado y primer entreno en 24 h |
| 2 | [Día 2: técnica](02-dia-2-tecnica.md) | Inicio + 1 día | 6:00 a. m. | 2 nov, 6:00 a. m. | Ver mi entreno de hoy (/app/entrenar) | Segundo entreno |
| 3 | [Día 3: comida](03-dia-3-comida.md) | Inicio + 2 días | 11:00 a. m. | 3 nov, 11:00 a. m. | Registrar mi almuerzo (/app/nutricion) | Uso de Nutrición en la prueba |
| 4 | [Día 4: progreso](04-dia-4-progreso.md) | Inicio + 3 días | 6:00 a. m. | 4 nov, 6:00 a. m. | Registrar mi progreso (/app/progreso) | Pesaje o medida registrada |
| 5 | [Día 5: cargas](05-dia-5-cargas.md) | Inicio + 4 días | 6:00 a. m. | 5 nov, 6:00 a. m. | Entrenar hoy (/app/entrenar) | Entrenos por persona (meta 3 o más) |
| 6 | [Oferta del 50 % con tarjeta](08-oferta-50-tarjeta.md) | Inicio + 4 días, sin tarjeta y sin pago previo | 6:00 p. m. | 5 nov, 6:00 p. m. | Dejar mi tarjeta lista (/app/suscripcion#tarjeta) | Tarjeta guardada antes del primer cobro |
| 7 | [Día 6: LinkApp](06-dia-6-linkapp.md) | Inicio + 5 días | 6:00 a. m. | 6 nov, 6:00 a. m. | Instalar mi LinkApp (/app/instalar) | Instalación de la LinkApp |
| 8 | [Aviso 48 horas antes del cobro](09-aviso-48h-cobro.md) | Cobro programado: charge_at menos 48 h (reminderDue) | 7:00 a. m. | 6 nov, 7:00 a. m. (cobro del 8 nov) | Ver o cancelar mi plan (/app/suscripcion) | Contracargos y reclamos (meta 0) |
| 9 | [Día 7: elegir plan](07-dia-7-elegir-plan.md) | Inicio + 6 días | 6:00 a. m. | 7 nov, 6:00 a. m. | Elegir mi plan (/app/suscripcion) | Conversión de prueba a pago (meta 35 %) |

La columna # es el orden de envío; los archivos van numerados por pieza. El 6 de noviembre, quien tiene tarjeta lista recibe el correo del día 6 a las 6:00 a. m. y el aviso de cobro a las 7:00 a. m.; se recomienda que Resend omita el del día 6 a esas personas ese día, para que el aviso de cobro no quede tapado.

## Por qué son 9 y no 10

El pedido lista bienvenida, 7 correos diarios, oferta y aviso (10), pero pide 9 piezas. La bienvenida y el día 1 se fusionaron en el correo 1: la prueba empieza al registrarse, así que el día 1 es el mismo momento de la bienvenida, y su acción (armar el plan y hacer el primer entreno) es la acción del día 1. Quedan bienvenida con día 1, días 2 a 7 (6 correos), oferta y aviso: 9.

## Enlaces y UTM

Cada correo tiene un solo enlace a bananaburn.app, el botón:

`https://bananaburn.app/<ruta>?utm_source=resend&utm_medium=email&utm_campaign=prueba_7_dias&utm_content=c<NN>-<pieza>`

El encabezado (logo) no lleva enlace. El pie solo lleva el correo de ayuda (mailto) y, en los de ciclo de vida, el enlace de baja, que no es un CTA.

## Variables

| Variable | Qué lleva | De dónde sale |
| --- | --- | --- |
| {{nombre}} | Primer nombre | profiles; si falta, quitar la coma y el nombre |
| {{fin_prueba}} | Fecha y hora del fin de la prueba en Costa Rica, por ejemplo "7 de noviembre a medianoche" | trialEndFor |
| {{fecha_cobro}} | Fecha del primer cobro, por ejemplo "8 de noviembre de 2026" | trial_charges.charge_at o fin de la prueba |
| {{plan}} | "Entreno, mensual" o similar | planLine |
| {{monto}} | Monto de este cobro, con el 50 % si aplica | firstChargeMinor |
| {{monto_normal}} | Precio normal del plan, con "al mes" o "al año" | amountMinorFor |
| {{tarjeta}} | Marca y últimos 4 dígitos | Tarjeta guardada (CardRow) |
| {{linea_aviso}} | Frase del aviso de cobro | reminderLine |
| {{baja_url}} | Enlace de baja firmado | unsubscribeUrl (src/lib/email/send.ts) |

## Diferencias con lo que la app ya envía

- La app ya manda `bienvenida` al registrarse y `recordatorioCobro` 2 días antes del cobro (src/lib/email/templates.ts). Los correos 1 y 9 los reemplazan: no se deben mandar los de la app y los de Resend a la vez.
- La app escribe los montos con coma decimal (`money()` da "$9,99"); el libro de marca y esta secuencia usan punto ("$9.99"). Los correos de la app y estos van a mostrar formatos distintos hasta que se unifique `money()`.
- La app también manda recordatorios de entreno diarios (`recordatorio`, cron de las 7:00 a. m.). Durante la prueba conviene no mandar los dos el mismo día, o el de la app queda como push solamente.

## Reglas que cumple cada correo

De tú, sin emojis, sin rayas largas, sin mencionar IA, sin testimonios, sin contadores ni escasez. Las únicas fechas límite que aparecen son reales (fin de la prueba, fecha del cobro). Los precios salen de src/lib/plans.ts y las condiciones del 50 % son PROMO_TERMS de src/lib/trial.ts, sin cambios.
