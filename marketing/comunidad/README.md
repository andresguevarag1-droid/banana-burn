# Comunidad: 1 al 8 de noviembre de 2026

BORRADORES PARA ANDRÉS. Nada se publica, programa, envía ni responde sin su aprobación escrita por pieza y canal. No se tocaron campañas. Las horas son de Costa Rica (UTC-6). Sofía prepara; Andrés aprueba y publica. Si falta aprobación, se pausa la salida aunque se incumpla la cadencia.

## Calendario

Historias a las 08:00 y 20:00 todos los días: intervalo máximo previsto de 12 horas, incluida la noche. Para cubrir los bordes, coordinar historia del 31 de octubre a las 20:00 y del 9 de noviembre a las 08:00 con sus calendarios y aprobaciones. No hay publicaciones automáticas.

| Día | Historia y sticker | Feed adicional, 12:00 |
| --- | --- | --- |
| 1 dom | [Reconstruye tu cuerpo](2026-11-01.md), encuesta | Carrusel C1 |
| 2 lun | [Tu primer entreno](2026-11-02.md), encuesta | Carrusel C2 |
| 3 mar | [12 entrenos](2026-11-03.md), encuesta | Sin feed adicional |
| 4 mié | [Invita y gana](2026-11-04.md), encuesta y quiz | Carrusel C3 |
| 5 jue | [Tarjeta opcional](2026-11-05.md), encuesta y caja | Sin feed adicional |
| 6 vie | [Fecha de cobro](2026-11-06.md), encuesta | Carrusel C4 |
| 7 sáb | [Balance semanal](2026-11-07.md), encuesta y caja | Sin feed adicional |
| 8 dom | [Siguiente semana](2026-11-08.md), encuesta | Sin feed adicional |

Tres carruseles en la semana lunes 2 a domingo 8 (C2, C3, C4), más C1 el domingo de lanzamiento. Guiones en [carruseles.md](carruseles.md); su arte final requiere producción y aprobación, no está incluido como PNG. Las historias sí incluyen ocho bases PNG y sus fuentes SVG, con huecos para stickers nativos; cada archivo diario especifica la segunda pantalla y la adaptación nocturna. Facebook: si no admite el sticker indicado, usar pregunta con respuestas escritas y enlace disponible en la plataforma, sin prometer interactividad inexistente.

## Entregables y uso

- [Banco de 20 respuestas](respuestas.md): elegir según contexto y revisar antes de contestar. No mandar DMs a quienes solo votaron.
- [Reto mensual](reto-12-entrenos.md): noviembre completo, ligado al programa existente de referidos.
- Los JSON junto a los PNG conservan el texto de la base. Generar con `npm i --no-save --prefix /tmp/resvg @resvg/resvg-js@2` y `RESVG_DIR=/tmp/resvg node marketing/comunidad/generar.mjs` desde la raíz. No instala paquetes en el proyecto.

## Embudo y medición hacia 100 usuarios de pago

Prioridad: registro completo > primer entreno > retención semana 1 > primer pago. Los referidos apoyan el registro y la activación; los seguidores no son usuarios de pago. Fuente: [meta de oficina](../../docs/metas/100-usuarios-de-pago.md).

Andrés registra por día y canal: pieza aprobada, hora real, alcance único, votos, preguntas, clics de enlace y consultas recibidas. Tasa de clic = clics / alcance; participación = votos / alcance. No sumar alcances de historias como si fueran personas distintas. No copiar nombres, salud ni datos de pago a la hoja.

El equipo con acceso autorizado consulta agregados: registros completos (bienvenida terminada, CompleteRegistration), usuarios con primer entreno guardado, y usuarios de esa cohorte con actividad en al menos dos días de sus primeros siete días (definición operativa de retención, no evento existente). Primer entreno: confirmar sesión persistida; workout_saved es señal de apoyo, no contar cada evento como una persona. Reportar numerador, denominador y ventana. Las cohortes del 8 aún no maduraron al cerrar ese día: revisar la semana 1 de todas las altas hasta el 15 de noviembre.

Referidos: contar cuentas atribuidas y calificadas en referrals; recompensa desde el programa existente, no desde mensajes. Hoy /r/<código> descarta UTM y ref-capture solo guarda UTM con ?ref=. No inventar códigos ni añadir ?ref= a enlaces orgánicos para medir. Clics de Instagram/Facebook se reportan desde sus estadísticas; activaciones y pagos son agregados, sin atribución demostrada a una historia. Dependencia de Adrian: conservación/captura de UTM antes de afirmar atribución por pieza.

Métrica final: usuarios únicos con trial_charges.status = 'succeeded' o suscripción pagada vigente, excluyendo testers y cortesías y sin duplicar cuentas. Meta de oficina: 100 usuarios de pago; referencia de conversión registro a pago 35.2 %, no resultado prometido de este calendario. Meta Subscribe no cubre el cobro automático: no usarla como total de pagos. El día 8 revisar el primer cobro beta; altas posteriores cobran según su fecha. No se han consultado datos privados ni hay cifras de resultados en este paquete.

## Texto preparado para la descripción del PR

Mueve registro completo, primer entreno y retención en semana 1 mediante historias del 1 al 8, respuestas a dudas y un reto mensual de 12 entrenos ligado a 3 amigos activos = 1 mes gratis. Apoya tarjeta opcional y primer pago con aclaraciones de fechas. Medición: clics y votos por pieza en las redes; bienvenida terminada, primer entreno persistido, retorno en dos días distintos de la semana 1 y referidos calificados en datos agregados. Resultado final: usuarios únicos de pago hacia la meta de 100. Los UTM de referidos aún se pierden, por lo que no se atribuyen pagos a piezas. Incluye bases PNG de historias, guiones de carrusel y 20 respuestas. Pendiente de aprobación escrita de Andrés; nada publicado ni enviado.

## Continuación: 9 al 15 de noviembre

El [plan de prueba a pago](semana-2026-11-09.md) enlaza los siete días, sus tres carruseles, dos Reels, historias y respuestas. Para esa semana aplica la cadencia del playbook de crecimiento (07:00, 18:00 y 22:00), con bases SVG que incluyen capturas reales, pendientes de exportación y aprobación.
