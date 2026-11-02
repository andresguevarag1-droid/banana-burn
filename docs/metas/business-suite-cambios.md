# Para Andrés: cambios a mano en Business Suite (2 al 21 de noviembre de 2026)

Lista de lo que ya está programado en Meta Business Suite (página de Facebook "Banana Burn" e Instagram @bananaburnapp, según [calendario-redes-oct-nov-2026.md](../../marketing/calendario-redes-oct-nov-2026.md)) y que hay que mover, cambiar o borrar. Lo aplicas tú a mano: nadie del equipo entra a Business Suite ni publica. Hora de Costa Rica. Sale del informe de revisión de #202 (2 nov) y de #216.

## Reglas de esta lista

- **A las 12:00 manda un solo calendario: la comunidad** ([marketing/comunidad/](../../marketing/comunidad/README.md)). Toda pieza NX de Business Suite que cae a las 12:00 en un día con feed de comunidad pasa a las 8:00 a. m. del mismo día (la franja de la mañana quedó vacía en noviembre). Si la pieza ya no sirve, se borra.
- **La llamada principal de noviembre va de noche (20:00 a 22:00):** «Regístrate y haz tu primer entreno hoy (12 min, también en casa)». La llevan las [10 piezas de activación](../../marketing/comunidad/activacion/README.md). Los posts de Business Suite de las 7:00 p. m. se quedan a esa hora para no mover 20 piezas: solo cambian su texto. Donde una pieza nueva ocupa la noche, la de las 7:00 p. m. se borra.
- **Comentar y recibir DM se acaba.** No hay ManyChat y el DM a mano frena a quien llega de noche. En FUERZA, BANANA, RETO y PLATO el pie termina con el enlace: «Tu primer entreno está en bananaburn.app».
- **Duración: 12 min.** Es lo que dice el botón de Hoy el primer día («¿No estás en el gym? Hazlo en casa ahora (12 min, sin equipo)», `src/components/readiness.tsx`). No usar 10, 15 ni 15–20 min.
- **Precios:** en dólares, «USD, IVA incluido», como el checkout. Nunca el anual dividido entre 12 (precio por mes del anual).
- **Carruseles:** Business Suite deja editar el pie de foto de un post programado; cambiar una lámina obliga a subir el carrusel otra vez. Esta lista solo pide cambiar pies, salvo donde dice lo contrario.
- **Historias:** Business Suite no deja editar historias programadas. Se borran y, si hace falta, se sube una nueva.
- Antes de guardar cada cambio, revisa la vista previa en el celular.

Acciones: **Mover** (cambiar la hora), **Cambiar texto** (editar el pie) o **Borrar**.

## Lista por fecha

| # | Fecha y hora programada | Pieza | Motivo | Acción | Qué hacer exactamente |
| --- | --- | --- | --- | --- | --- |
| 1 | Lun 2 nov, 12:00 p. m. | NX02 Primera semana día por día | Choca con el carrusel C2 de comunidad a las 12:00 | Mover y cambiar texto | Pasar a las 8:00 a. m. del 2 nov. Cerrar el pie con «Tu día 1 dura 12 min y lo puedes hacer en casa. Hazlo hoy en bananaburn.app». Si a esa hora ya salió, no hacer nada. |
| 2 | Lun 2 nov, 7:00 p. m. | Reto de noviembre (RETO) | Pide comentar para recibir DM | Cambiar texto | Gancho «Entreno 1 de 12: hoy, 12 min, también en casa». Cambiar «comenta y te mando DM» por «Tu primer entreno está en bananaburn.app». Si el pie habla de amigos, debe decir que un amigo cuenta cuando paga su primer plan (regla vigente, #213). |
| 3 | Mar 3 nov, 12:00 p. m. | NX03 Día 1 en el gym (FUERZA) | Pide comentar para recibir DM | Cambiar texto | Cambiar el DM por «Abre tu día 1 en bananaburn.app. Si hoy no vas al gym, hazlo en casa: 12 min». No choca: la comunidad no tiene feed ese día. |
| 4 | Mar 3 nov, 7:00 p. m. | 10 minutos en casa | Promete 10 minutos y la app dice 12; la reemplaza la pieza de activación 01 a las 20:00 | Borrar | Borrar. Si a las 5:00 p. m. del 3 nov la pieza 01 no está aprobada, no la borres: cambia «10 minutos» por «12 minutos» y muévela a las 8:00 p. m. |
| 5 | Mié 4 nov, 12:00 p. m. | NX01 Lo que hace un entrenador (BANANA) | Choca con el carrusel C3 de comunidad; pide DM | Mover y cambiar texto | Pasar a las 8:00 a. m. del 4 nov. Cambiar el DM por «Pruébalo hoy: tu primer entreno dura 12 min, también en casa. bananaburn.app». |
| 6 | Mié 4 nov, 7:00 p. m. | Carrusel K04 Banana Run | El cierre no lleva al primer entreno | Cambiar texto | Cerrar el pie con «Tu primera sesión, hoy: 12 min de fuerza en casa o tu primera carrera con GPS. bananaburn.app». |
| 7 | Jue 5 nov, 7:00 p. m. | 4 señales de progreso | El CTA no lleva al primer entreno | Cambiar texto | Empezar el pie con «La señal n.º 1: terminaste tu primer entreno». Cerrar con «Hazlo hoy: 12 min, también en casa. bananaburn.app». |
| 8 | Vie 6 nov, 12:00 p. m. | NX04 8,000 pasos | Choca con el carrusel C4 de comunidad; pasos no es entreno | Borrar | Borrar. |
| 9 | Vie 6 nov, 7:00 p. m. | Carrusel K05 Proteína latina | Habla de comida sin decir qué plan la calcula ni el precio | Cambiar texto | Cerrar con «Esto lo calcula Entreno + Nutrición: $14.99 al mes (USD, IVA incluido), con 7 días gratis y sin tarjeta. Empieza con tu primer entreno hoy en bananaburn.app». |
| 10 | Sáb 7 nov, 7:00 p. m. | Cuánto descansar entre series | Repite el tema de NX07 del 20 nov; la noche la ocupa la pieza de activación 04 (carrusel «Qué pasa en tu día 1») | Borrar | Borrar. El tema sigue en NX07 del 20 nov (fila 25). |
| 11 | Dom 8 nov, 12:00 p. m. | NX05 Cuánto peso (FUERZA) | Pide comentar para recibir DM | Cambiar texto | Cambiar el DM por «La app te dice con cuánto peso empezar. Tu primer entreno está en bananaburn.app». No choca: la comunidad no tiene feed ese día. |
| 12 | Dom 8 nov, 7:00 p. m. | Carrusel K06 Rutina 30 min condominio | Promete 30 min; la llamada de noviembre es de 12 min | Cambiar texto | Añadir al pie «¿Primera vez? Empieza con tu primer entreno de 12 min, en el gym del edificio o en casa. bananaburn.app». Las láminas se quedan. |
| 13 | Lun 9 nov, 7:00 p. m. | Pregunta GLP-1 / Banana Shield | Su texto no está en el repo; puede traer indicaciones médicas | Cambiar texto | Revisar el pie en Business Suite: sin dosis, gramos exactos ni día de inyección. Cerrar con «Prueba Banana Shield 7 días, sin tarjeta: tu primer entreno dura 12 min. No sustituye la indicación de tu médico.» (coordina con #215). |
| 14 | Mar 10 nov, 12:00 p. m. | NX06 Me duele todo | Choca con el Reel de comunidad a las 12:00 | Mover y cambiar texto | Pasar a las 8:00 a. m. del 10 nov. Gancho «¿Te dolió el día 2? Es normal al empezar». Sin indicaciones médicas. Cerrar con «Si aún no haces el primero: 12 min, también en casa. bananaburn.app». |
| 15 | Mar 10 nov, 7:00 p. m. | Carrusel K07 Fuerza para corredores | Vende la temporada (segunda compra) | Cambiar texto | Cambiar el cierre por «12 min de fuerza hoy, sin cambiar tus carreras. Tu primer entreno está en bananaburn.app». Quitar la mención de la temporada del pie. |
| 16 | Mié 11 nov, 7:00 p. m. | Qué plan elegir | Repite el tema de la pieza de activación 05 (precio honesto, 20:00, fijada) | Borrar | Borrar. Nada a las 12:00 en Business Suite ese día: sin choque. |
| 17 | Jue 12 nov, 12:00 p. m. | NX08 Qué llevar al gym | Franja de las 12:00 de la comunidad (ese día sin feed, pero #214 la está reescribiendo) | Mover y cambiar texto | Pasar a las 8:00 a. m. del 12 nov. Cerrar con «¿Hoy no vas al gym? Tu primer entreno en casa, 12 min. bananaburn.app». |
| 18 | Jue 12 nov, 7:00 p. m. | Carrusel K08 La báscula no lo dice todo | El CTA no lleva al primer entreno | Cambiar texto | Cerrar con «Registra tu primer entreno hoy: la fuerza también se mide. bananaburn.app». Mantener el aviso médico si lo tiene. |
| 19 | Vie 13 nov, 12:00 p. m. | NX09 3 a 4 días por semana | Choca con el carrusel de comunidad a las 12:00 | Mover y cambiar texto | Pasar a las 8:00 a. m. del 13 nov. Cerrar con «El primero, hoy: 12 min, también en casa. bananaburn.app». |
| 20 | Sáb 14 nov, 12:00 p. m. | NX10 Lo que como en un día (PLATO) | Choca con el Reel de comunidad a las 12:00; pide DM | Mover y cambiar texto | Pasar a las 8:00 a. m. del 14 nov. Cambiar el DM por «Esto lo arma Entreno + Nutrición: $14.99 al mes (USD, IVA incluido), 7 días gratis sin tarjeta. bananaburn.app». |
| 21 | Sáb 14 nov, 7:00 p. m. | Carrusel K09 Raquetas y Cross | Segunda compra de nicho; no mueve registro ni primer entreno; la noche la ocupa la pieza de activación 07 | Borrar | Borrar. |
| 22 | Dom 15 nov, 7:00 p. m. | Mitad del reto (1 a 12) | El CTA no le habla a quien aún no empieza | Cambiar texto | Gancho «¿Vas en 0? Haz el 1 hoy: 12 min, también en casa». Cerrar con bananaburn.app. |
| 23 | Lun 16 nov, 12:00 p. m. | NX11 No fue magia (RETO) | Choca con el carrusel C2 de comunidad a las 12:00 (no estaba en el informe de #202); pide DM | Mover y cambiar texto | Pasar a las 8:00 a. m. del 16 nov. Confirmar que no sea un testimonio inventado: si presenta a una persona como cliente real sin su permiso, borrarlo. Cambiar el DM por «Tu entreno 1 está en bananaburn.app». |
| 24 | Mar 17 nov, 7:00 p. m. | Carrusel K10 Instalar la app | Termina en instalar, no en entrenar | Cambiar texto | Cerrar con «Instálala y abre tu entreno de hoy: 12 min, también en casa». |
| 25 | Mié 18 nov, 7:00 p. m. | Referidos: 3 amigos = 1 mes | Regla vieja si dice que el amigo cuenta sin pagar | Cambiar texto | Pie: «Cada 3 amigos que pagan su primer plan te dan 1 mes gratis. Si uno paga el anual, ganas 3 meses en total. La prueba gratis no cuenta.» Fuente: [docs/emails/referidos.md](../emails/referidos.md); coordina con #213. |
| 26 | Jue 19 nov, 7:00 p. m. | Carrusel K11 Administradores de condominio | B2B: lleva a agendar una reunión, no a registrarse; la noche la ocupa la pieza de activación 09 | Borrar | Borrar. Lo de administraciones lo lleva Harvey por correo. |
| 27 | Vie 20 nov, 12:00 p. m. | NX07 Cuánto descansar (de 1 a 3 minutos) | Choca con el carrusel C4 de comunidad a las 12:00 (no estaba en el informe de #202) | Mover y cambiar texto | Pasar a las 8:00 a. m. del 20 nov. Cerrar con «La app te marca el descanso. Pruébalo hoy en tu primer entreno: 12 min. bananaburn.app». Es la única pieza de descanso que queda (fila 10). |
| 28 | Vie 20 nov, 7:00 p. m. | Carrusel K12 Cierre de inscripciones | Precio sin «USD, IVA incluido» | Cambiar texto | Pie: «El plan anual ($59.99, USD, IVA incluido) incluye 1 temporada. Inscripción hasta el 22 de noviembre.» Coordina con #215 (Temporada 1). |
| 29 | Sáb 21 nov, 7:00 p. m. | Meme «el lunes empiezo» | El CTA no lleva al primer entreno | Cambiar texto | Cerrar con «No esperes al lunes: 12 min hoy, en casa. bananaburn.app». |
| 30 | Del 2 al 23 nov, todos los días | Historias de Business Suite: «Nuevo hoy», la de las 6:30 a. m. y las de relleno | Dicen «Toca el perfil» en vez de llevar a la app, y son un segundo calendario de historias encima del de comunidad | Borrar | Borrar todas las historias programadas en Business Suite del 2 al 23 nov. Las historias de comunidad ya cubren las 12 horas: 8:00 y 20:00 del 1 al 8; 7:00, 18:00 y 22:00 del 9 al 22; y los posts de feed suman salidas. Las historias nuevas con enlace salen del celular (los stickers no se programan). |

## Lo que se queda igual

Nada más de Business Suite cambia del 2 al 21 nov. Lo programado antes del 2 nov ya salió. Desde el 24 nov no hay nada programado en Business Suite: lo lleva el calendario de comunidad.

## Resumen

- 30 filas: 15 cambios de texto, 8 movidas a las 8:00 a. m. con cambio de texto, 6 borrados de posts y el borrado de las historias (fila 30).
- Choques a las 12:00 resueltos: 2, 4, 6, 10, 12, 13, 14, 16 y 20 nov. El 11 nov Business Suite no tiene nada a las 12:00. El 16 y el 20 no estaban en el informe de #202.
- Paso del embudo que mueve: registro y primer entreno terminado. Se mide con los eventos de `funnel_events` (`workout_open`, `workout_first_set`, `workout_saved`) y con `workouts.finished_at` en las 24 h siguientes a cada salida, sin atribuir pagos a un post (las UTM de `/r/<código>` se pierden). Resultados: por medir.
