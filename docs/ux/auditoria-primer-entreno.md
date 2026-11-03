# Auditoría: de un Reel al primer entreno en iPhone

Fecha: 3 de noviembre de 2026. Issue #249. Solo documentación.

## Resultado y alcance

La prioridad es que una persona registrada termine su primer entreno en 72 horas. El código actual ya reduce Hoy a su primer entreno, ofrece hacerlo en casa y abre directamente la primera serie guiada. No corresponde volver a proponer esas mejoras como si faltaran. Las fricciones pendientes más claras son las decisiones antes de entrenar, la comprensión de «Hecho» y el cierre anterior al guardado.

Se leyeron las rutas y sus componentes, los skills de marca, UX y landing, y `src/app/globals.css`. Recorrido principal: Reel → `/` → `/entrar?modo=registro` dentro de Instagram en iPhone → `/bienvenida` sin tarjeta → `/app` sin entrenos previos ni programa activo → `/app/entreno` guiado → resumen previo al guardado → celebración. Las rutas GLP-1 y programas tienen bifurcaciones que se indican, no se asumen equivalentes al recorrido general. No se identificó un Reel o URL de campaña concreto: se toma la llamada de noviembre «Regístrate y haz tu primer entreno hoy (12 min, también en casa)» como referencia, no como una pieza observada.

**Límite de evidencia:** revisión de código para un viewport de **375 × 667 CSS px**, con contraste de reglas responsive a 390 × 844 y 1280 × 800. No hubo render ni capturas. `npm exec --yes --package=@playwright/test -- playwright install chromium` falló con HTTP 403 al descargar desde `cdn.playwright.dev`; no hay navegador local disponible. Toda descripción «sin scroll» es una estimación por orden DOM, medidas y clases, no una posición medida. Safari y el navegador de Instagram pueden dejar menos altura útil con sus barras; el teclado reduce aún más el área. No se certifican cortes exactos, contraste compuesto, foco ni ausencia de desbordamiento sin la validación visual pendiente.

A 375 px se aplica el diseño base: landing con 343 px interiores, registro con 335 px y Hoy con 343 px antes del padding de la tarjeta. A 390 px siguen las mismas reglas; 15 px extra pueden cambiar saltos de línea. A 1280 px la landing pasa a dos columnas, el registro muestra un panel lateral y la app reserva 256 px para navegación. El guiado conserva `max-w-md`, la celebración `max-w-sm`; el ancho extra no resuelve la altura móvil. No se propone ensanchar el reproductor a costa de movimiento o reloj.

## Datos para decidir

| Cohorte / ventana del issue | Observación | Lectura permitida |
| --- | --- | --- |
| 11 cuentas desde el 2 nov | 0 terminaron el primer entreno | Prioridad de activación; no demuestra una causa ni permite atribuir el resultado a una pantalla. |
| Últimas 24 h | 3 abrieron, 1 hizo la primera serie | Hay fricción entre abrir y actuar; no dividir entre las 11 cuentas sin confirmar que son la misma cohorte. |
| Llegada a registro | Aproximadamente 2 clics en «Empezar» por cuenta | Clics repetidos no son personas únicas ni una conversión de 50 %. |
| Corte del 1 nov | 35 Hoy → 11 aperturas → 3 primeras series → 1 guardado | El mayor descenso relativo está antes de la primera serie; no mezclar con el corte nuevo. |

Meta: 30 % de registrados con primer entreno completo en 72 h. Los cambios listados son hipótesis, no impactos porcentuales prometidos. La ausencia de errores de guardado informada en el issue no elimina la fricción de tener que interpretar el resumen.

## Cómo leer los toques y las mediciones

Un toque es activar un control o enfocar un campo; no se cuentan caracteres, scroll, tiempo entrenando ni gestos del selector nativo. Los campos y selectores se desglosan para que no parezca que «7 preguntas» son 7 toques. Los mínimos suponen datos válidos, sin errores ni retrocesos. Las alternativas de correo y Google se cuentan aparte.

Eventos existentes: `src/app/api/track/event.ts`; envío y escucha de `data-cta`: `src/components/analytics.tsx`. `cta_click` exige un elemento con `data-cta` y un `FunnelTracker` montado. Cada recomendación que pide un nuevo identificador de CTA implica instrumentarlo en su implementación futura; **no está medido hoy**. No se inventan nombres de eventos. `onboarding_step` solo admite `step` entre 0 y 6 y `path`: no admite añadir objetivo, variante ni texto libre. Las visitas de paso pueden repetirse al volver atrás.

## Recorrido pantalla por pantalla

### 1. Reel → landing `/`

**Código:** `src/app/(marketing)/page.tsx`, `layout.tsx`, `content.tsx`, `sticky-cta.tsx`, `hero-player.tsx`.

**Primero, sin scroll estimado:** cabecera sticky de 64 px con Entrar, registro y menú; etiqueta de público, título «Bajaste de peso. Ahora no pierdas tu músculo.», explicación de entrenador personal y CTA «Crear mi plan gratis». En 375 × 667 el texto consume buena parte de la altura; condiciones y mockup pueden quedar cortados o debajo. El mockup viene después del texto, no al lado. Acción principal: crear la cuenta.

**Toques:** 1 al registro desde el CTA; desde el Reel, al menos 1 toque adicional para abrir el enlace, según la pieza/plataforma, no verificado. No exige recorrer precios ni instalar.

**Duda:** la llamada «primer entreno hoy en casa» cambia a «crear un plan» y a una promesa de músculo. Cabecera, hero y CTA fijo repiten entradas; hay muchas secciones y precios antes de conocer el producto. La sticky usa un observador: no asumir que aparece al mismo tiempo que el hero.

**Cambios concretos:**

1. En `page.tsx`, cambiar `CTA` a «Hacer mi primer entreno gratis» y el apoyo a «Empieza hoy en casa, sin equipo. Después seguimos con tu plan.» Mantener duración real según el plan, sin prometer 12 min a todas las variantes. Medir `cta_click` (`hero`, `sticky`) → `signup_view` y, como resultado final, `workout_saved` completo en 72 h.
2. En `layout.tsx`, dar menor peso visual a Entrar y conservar una única acción de registro dominante; no quitar acceso a cuentas existentes. Medir distribución de `cta_click` (`nav`, `nav-entrar`, `hero`) y `signup_submit`, sin sumar clics como personas.

**Bifurcación GLP-1:** `src/app/(marketing)/glp1/page.tsx` muestra título de fuerza, prueba sin tarjeta y aviso médico en el hero; CTA principal y «Continuar sin tarjeta» llevan al mismo `SIGNUP_GLP1`. Sigue siendo 1 toque al registro, pero conserva `programa=glp1` y expande el paso 0. Para esa variante, unificar los dos enlaces visualmente en un CTA y una aclaración sin tarjeta; medir `cta_click(glp1-hero)` → `signup_view` → primer guardado completo. No extrapolarle el texto del hero general.

### 2. Registro `/entrar?modo=registro` y modo Entrar

**Código:** `src/app/(auth)/entrar/page.tsx`, `login-form.tsx`, `actions.ts`, `validate.ts`.

**Primero:** logo, «Crea tu cuenta gratis», párrafo que promete «Solo necesitas tu correo» y «7 preguntas rápidas», correo y contraseña por defecto. Dentro de Instagram no se muestra Google; aparece una ayuda secundaria para abrir Safari si está habilitado. Fuera de Instagram, Google puede empujar el formulario y su CTA más abajo. En 375 px con teclado, no asumir visible «Empezar mi prueba gratis». `/entrar` sin query muestra «Qué bueno verte» y obliga a elegir registro si es una persona nueva.

**Toques:** contraseña: 3 mínimos (correo, contraseña, enviar), sin contar teclado. Si se entra por «Entrar», +1 en «Prueba gratis 7 días». Google en Safari: 1 para iniciar más selección/consentimiento externo variable; dentro de Instagram no es un atajo disponible. Cuenta ya abierta: 1 en «Terminar de crear mi plan» o «Ir a mi cuenta».

**Duda:** «solo correo» contradice la contraseña visible; cambiar a Safari rompe continuidad y exige conservar la sesión. La ruta normal crea y confirma en servidor, pero el fallback puede pedir confirmar por correo: no prometer acceso inmediato universal.

**Cambios:**

1. En `login-form.tsx`, reemplazar introducción por «Crea tu cuenta con correo y contraseña. Luego preparamos tu primer entreno.» y CTA por «Crear cuenta gratis». Medir `signup_view` → `signup_submit` por `method=password` y `signup_error` por motivo; resultado posterior `onboarding_done`.
2. En `page.tsx`, reducir `py-10` del área del formulario en móvil y conservar acceso al envío al abrir el teclado, sin perder términos ni ayuda. Medir `signup_submit / signup_view` con usuarios/sesiones comparables e `inapp` de la vista; comprobar en captura de teclado real antes de aprobar.

### 3. Alternativa: código por correo

**Código:** `login-form.tsx`, estados `email`, `code`, `reset`.

**Primero:** «Revisa tu correo», dirección destinataria, instrucciones, aviso sobre spam y campo del código; botón «Entrar». Acción principal: verificar. No es una pantalla obligatoria para la contraseña con confirmación en servidor.

**Toques:** desde el formulario inicial: cambiar método, enfocar correo y enviar (3); abrir correo y volver (cantidad externa variable), enfocar código y Entrar (+2). Reenviar agrega 1 tras la espera de 60 s. El enlace del correo es otra alternativa, no un paso adicional obligatorio.

**Duda:** salir de Instagram para revisar correo, volver a otra pestaña y no reconocer el estado. El consejo de spam ocupa espacio antes del campo. Error «Código incorrecto o vencido» no distingue cómo recuperarse; sí existe Reenviar y Cambiar correo.

**Cambios:**

1. En `login-form.tsx`, mover el consejo extenso después del campo y resumirlo a «Si no llega, revisa Correo no deseado». Medir `signup_submit(method=code)` → `onboarding_step(step=0)`; la llegada a bienvenida es proxy, no evento de verificación.
2. Cambiar error a «Ese código no funciona. Revisa el último correo o pide otro cuando termine la cuenta.» Conservar el reenvío bloqueado mientras espera. Medir `signup_error(reason=bad_code)` y llegada posterior a `onboarding_step(0)`; para contar reenvíos se necesitaría `data-cta` nuevo con `cta_click`.

### 4. Bienvenida, paso 0: objetivo y GLP-1

**Código:** `src/app/bienvenida/wizard.tsx`, `goal.ts`.

**Primero:** progreso, «¿Qué quieres lograr?», tres tarjetas; «Bajar grasa rápido» viene seleccionado. GLP-1 aparece después y expande medicamento/día si se activa. CTA: Continuar en pie sticky, cuya posición exacta requiere render (sticky no equivale a fixed).

**Toques:** 1 para continuar con selección actual; 2 si cambia objetivo. GLP-1 añade checkbox y, si modifica ambos valores, al menos dos aperturas y dos selecciones de controles nativos.

**Duda:** «déficit de unas 500 kcal» antes de entrenar; la selección por defecto puede confundirse con recomendación personal. La expansión mezcla plan, medicamento y condiciones comerciales.

**Cambios:**

1. En `goal.ts`, resumir las descripciones a beneficios sin «déficit»: por ejemplo, «Perder grasa mientras cuidas tu fuerza». Mantener reglas de salud del cálculo. Medir avance `onboarding_step(0)` → `(1)`.
2. En `wizard.tsx`, reducir explicación de GLP-1 a una frase, conservar los campos necesarios y añadir «No sustituye la indicación de tu médico.» junto al bloque; el texto actual del bloque no incluye esa frase. Medir avance `(0)` → `(1)`; hoy no permite segmentar por GLP-1 con este evento estricto.

### 5. Bienvenida, paso 1: datos personales

**Código:** `wizard.tsx`, bloque `step === 1`, componente `Num`.

**Primero:** «Cuéntame de ti», nombre, sexo biológico y fecha de nacimiento. País y estatura llegan después y necesitan scroll en la altura de referencia. Acción: completar obligatorios y Continuar.

**Toques:** con nombre vacío, país sugerido y sin datos: al menos 10 (nombre 1, sexo 1, abrir/elegir día/mes/año 6, estatura 1, Continuar 1). Si el nombre ya viene, resta 1. País no sugerido: al menos +2. No incluye cerrar teclado ni gestos de selectores.

**Duda:** cinco grupos de datos bajo un único paso; «estimamos energía» no explica por qué se necesitan antes de la primera serie. Valores grises en Num son referencias, no datos guardados.

**Cambios:**

1. En `wizard.tsx`, añadir sobre Num «Escribe tu estatura; el número gris es un ejemplo» y explicar cerca de fecha/sexo para qué se usan. Medir `(1)` → `(2)`, especialmente vueltas al paso 1.
2. Llevar recordatorios/comidas del texto de país a una ayuda secundaria y dejar «País» como etiqueta corta; conservar la selección y validación. Medir `(1)` → `(2)` y `onboarding_done`.

### 6. Bienvenida, paso 2: peso y meta

**Código:** `wizard.tsx`, `goal.ts` (`goalError`, `suggestDate`, `paceFor`).

**Primero:** «Tu punto de partida», peso actual, peso meta y fecha. Al introducirlos aparece una tarjeta de ritmo que puede desplazar contenido. CTA: Continuar, bloqueado con datos incompletos o meta inválida.

**Toques:** 3 mínimos (peso actual, peso meta y Continuar), porque se sugiere fecha al completar los pesos. Cambiar fecha añade interacción nativa variable; «Usar fecha recomendada» suma 1 si aparece.

**Duda:** exige una meta numérica y fecha incluso para alguien que solo quiere probar un entreno. Se muestran kg/semana y recomendaciones antes de sentir progreso.

**Cambios:**

1. En `wizard.tsx`, ofrecer «Definir mi meta después» para el primer entreno y trasladar peso meta/fecha al seguimiento. Requiere ajustar el contrato de `actions.ts` y `goal.ts` en un issue futuro: no basta ocultar campos obligatorios ni guardar una meta inventada. Conservar datos y controles de salud necesarios. Medir `(2)` → `(3)` y primer `workout_saved` completo.
2. Mientras se mantiene el contrato, rotular fecha «Fecha sugerida, puedes cambiarla» y resumir tarjeta a una frase, conservando alertas de seguridad y corrección. Medir `(2)` → `(3)`.

### 7. Bienvenida, paso 3: experiencia y voz

**Código:** `wizard.tsx`, `src/components/voice-picker.tsx`.

**Primero:** título de experiencia y tres niveles; debajo viene «¿Cómo quieres que te hable?» con otra decisión. Por defecto: intermedio y voz básica. CTA: Continuar.

**Toques:** 1 con valores actuales; 2 si elige principiante; +1 si cambia voz. El registro de voz se ajusta con el nivel hasta tocarlo manualmente.

**Duda:** alguien nuevo puede continuar como intermedio; la personalización de lenguaje compite con identificar su experiencia. El guiado ya usa una estructura simple, no necesita una elección adicional para arrancar.

**Cambio:** en `wizard.tsx`, pedir una elección explícita de nivel y mover VoicePicker a Perfil con voz básica inicial para quien empieza; texto «Te lo explicamos paso a paso». Conservar posibilidad de cambiarlo después. Medir `(3)` → `(4)` y `workout_first_set / workout_open`, además de finalización, para no optimizar solo velocidad de bienvenida.

### 8. Bienvenida, paso 4: días, duración, horario y semana

**Código:** `wizard.tsx`, `src/lib/train-slot.ts`.

**Primero:** «¿Cuántos días puedes entrenar?», 3–6 días y duración; horario y semana completa quedan más abajo. CTA: Continuar. Defaults: 4 días y 45 min; horario opcional.

**Toques:** 1 aceptando valores; +1 por cambiar días, duración u horario (hasta 4 con cambios en los tres). No obliga a recorrer el calendario para avanzar.

**Duda:** plan de 45 minutos frente a primer entreno corto; son más decisiones que una pregunta y falta una opción de menos de 3 días. Calendario y recordatorio distraen de entrenar ahora.

**Cambios:**

1. En `wizard.tsx`, mover horario y vista semanal a después del primer guardado; conservar días/duración para el plan. Medir `(4)` → `(5)` y `workout_saved` completo en 72 h.
2. Añadir bajo duración «Tu primer entreno será corto. Esto es para tu rutina después.» sin fijar una duración distinta a la calculada. Medir `(4)` → `(5)` y `workout_open`.

### 9. Bienvenida, paso 5: equipo

**Código:** `wizard.tsx`, bloque `step === 5`.

**Primero:** «¿Dónde entrenas?» y cuatro tarjetas. La última, Sin equipo, puede exigir scroll; Gimnasio viene seleccionado. Acción: confirmar equipo y Continuar.

**Toques:** 1 con gym; 2 al elegir casa o sin equipo.

**Duda:** la persona llega desde el celular en casa pero responde sobre su membresía del gym; «En casa con mancuernas» describe también bandas. El primer entreno sí permite casa sin cambiar perfil.

**Cambios:**

1. Cambiar título en `wizard.tsx` a «¿Con qué equipo entrenas normalmente?» y añadir «Hoy también podrás empezar sin equipo». Medir `(5)` → `(6)` y `workout_open` con `variant=casa-primero`.
2. Cambiar etiqueta a «En casa con mancuernas o bandas», conservando la opción independiente «Sin equipo». Medir `(5)` → `(6)`; el evento actual no identifica la opción elegida.

### 10. Bienvenida, paso 6: salud y consentimiento

**Código:** `wizard.tsx`, bloque `step === 6`, `actions.ts`.

**Primero:** «Un último detalle», privacidad y una tarjeta de tres garantías; luego cuestionario de salud y consentimiento, que requieren scroll. CTA: Continuar si hay oferta de tarjeta, Crear mi plan si no. No puede avanzar sin consentimiento; si marca una condición, debe confirmar autorización médica.

**Toques:** 2 mínimos (consentimiento y continuar) si ninguna condición aplica. Una condición y autorización agregan 2; nunca se deben presuponer ni eliminar para reducir toques.

**Duda:** se anuncia «último» y aún sigue una oferta; el consentimiento obligatorio está debajo de mucho texto. Checkboxes de 20 px con labels clicables no garantizan por sí solos un área de 44 px.

**Cambios:**

1. En `wizard.tsx`, título «Antes de entrenar» y resumir las garantías en «Tus datos son privados. Puedes borrarlos cuando quieras», manteniendo política y consentimiento explícito. Medir `(6)` → `onboarding_done`.
2. Dar a cada label de salud/consentimiento `min-height: 44px` y foco visible sin superponer objetivos táctiles. Mantener preguntas, autorización y validación. Medir llegada a `onboarding_done`; verificar tamaño/foco en render, no inferirlo del evento.

### 11. Oferta opcional de tarjeta, paso 7

**Código:** `wizard.tsx`, `page.tsx`, `src/components/pagos/plan-picker.tsx`, `pagos/card-form.tsx`.

**Primero:** «La tarjeta es opcional» y «Empezar gratis sin tarjeta» arriba; después promoción, condiciones, planes y formulario. El pie repite la salida sin tarjeta. Ya existe salida clara: no reportar que exige pagar.

**Toques:** 1 para seguir sin tarjeta; guardarla añade selección y campos de pago variables. Al terminar, `finish()` guarda perfil y navega directamente a `/app` (demo a `/app?primera=1`).

**Duda:** aun opcional, introduce pago antes del valor. Dos botones de salida con estilos principales distintos repiten la acción. El bloque JSX «Tu plan está listo» para `step === TOTAL` no forma parte del camino normal: `finish()` no hace `setStep(TOTAL)`; no contar esa pantalla como paso real.

**Cambio:** en `wizard.tsx` y `page.tsx`, sacar la oferta del recorrido anterior al primer entreno y conservarla después del logro y en Mi plan. Mantener prueba sin tarjeta y condiciones comerciales. Medir `(6)` → `onboarding_done` → `hoy_view` → primer `workout_saved` completo. `card_banner_view`, `card_saved` y pagos son guardas secundarias, no razón para anteponer la tarjeta.

### 12. Hoy del primer día `/app`

**Código:** `src/app/(app)/app/page.tsx`, `app/layout.tsx`, `src/lib/hoy-first.ts`, `src/components/hoy/workout-hero.tsx`, `readiness.tsx`.

**Primero:** fecha, saludo, campana, racha/perfil y tarjeta banana «Tu primer entreno de hoy», «Cuerpo completo para empezar». Botón para empezar con minutos reales y alternativa en casa si perfil gym/mixto. De noche la casa va primero; de día va primero la sesión habitual. Después, ejercicios en carrusel. La rama `first` elimina tours, nutrición, retos e instalación; el check-in de energía tampoco aparece. No hay un descanso sin salida: se adelanta la primera sesión.

**Toques:** 1 para abrir guiado por cualquiera de las dos opciones; no necesita completar check-in ni instalar. Sin casa alternativa hay una sola entrada.

**Duda:** título largo reserva espacio para mascota (`pr-28`); dentro de una tarjeta de 303 px interiores deja poco ancho de título a 375. Dos botones largos pueden desplazar ejercicios. Campana, racha y perfil siguen siendo salidas. El aviso de tarjeta solo se permite desde día 6 si aplica; no presentarlo como fricción universal del día 1. Programas activos no pasan por esta rama.

**Cambios:**

1. En `readiness.tsx`, acortar casa a «Empezar en casa» con apoyo «Sin equipo, unos {home.mins} min»; habitual a «Empezar mi entreno» con apoyo «Unos {mins} min». Conservar orden contextual y jerarquía actual. Medir `hoy_view(first=true)` → `workout_open(first_session=true)` y variante casa, luego `workout_first_set`.
2. En `workout-hero.tsx`, reducir mascota/título del estado inicial para que ambos accesos quepan antes de los ejercicios; propuesta de título «Tu primer entreno». Medir `workout_open / hoy_view` de primera vez. Confirmar ambos botones sin scroll en 375 × 667, sin quitar el movimiento del guiado.

### 13. Primera serie guiada `/app/entreno`

**Código:** `src/app/(app)/app/entreno/page.tsx`, `player.tsx`, `src/components/workout/guided.tsx`, `task.ts`, `src/lib/engine/index.ts` (`firstSessionDay`).

**Primero:** salir, «Ejercicio 1 de N», progreso, movimiento en banana, nombre, clave y «Serie 1 de 2» con repeticiones. Si usa carga aparece peso sugerido ajustable. Acción principal: **Hecho**, fijo en pie de 80 px, o **Empezar** si la serie es por tiempo. El movimiento mide `clamp(170px,34dvh,420px)`: unos 227 px con 667 px de alto; reloj activo de 88 px. El contenido central tiene scroll propio: peso/clave pueden no caber completos.

**Toques:** desde Hoy a marcar primera serie por repeticiones: **2 en total** (abrir + Hecho después de hacerla). No hay ficha previa ni botón Empezar adicional en ese caso. Por tiempo: abrir + Empezar + Hecho si se marca manualmente; el temporizador completa automáticamente al terminar (2 toques desde Hoy si se espera el final). Ajustar peso o abrir técnica es opcional.

**Duda:** «Hecho» se ve antes de explicar claramente que debe realizar la serie; se puede interpretar como avanzar. `cue` lleva `truncate`, ocultando parte de una instrucción útil. La línea de serie une información con «·» aunque la guía de marca lo evita. Ayuda se abre tocando el movimiento entero, una zona grande, pero «Ver cómo se hace» puede parecer un segundo CTA.

**Cambios:**

1. En `guided.tsx`, añadir «Haz las repeticiones y después toca Hecho» cerca de la serie; cambiar botón a «Terminé la serie», conservando 80 px y una sola acción principal. Medir `workout_first_set / workout_open` y `set_done` hasta `workout_saved` completo; no aceptar más clics rápidos como evidencia de ejercicio real.
2. Quitar `truncate` de la clave y permitir dos líneas sin reducir movimiento ni reloj; en `guidedLine`, separar «Serie 1 de 2» y tarea visualmente sin «·». Medir `help_open` junto a avance `set_done`; una bajada de ayuda aislada no prueba mejor comprensión.

**Cuenta del recorrido de entrenamiento:** sea S el total real de series por la variante. Desde Hoy hasta el servidor, el mínimo es 1 apertura + un toque por serie de repeticiones + un inicio por serie de tiempo + 1 guardado manual. Esperar descansos y final de temporizadores añade 0 toques; saltar añade 1 por descanso. La última serie abre el resumen sola. No publicar un total fijo de toques para todas las variantes o con errores.

### 14. Descanso y siguientes series

**Código:** `guided.tsx` (`GuidedRest`), `player.tsx` (`complete`, `nextPending`, efecto del reloj).

**Primero:** overlay oscuro con «Descansa», reloj de 220 px, siguiente ejercicio/serie y botón banana «Saltar». Al terminar el reloj desaparece automáticamente; al completar un ejercicio se selecciona el siguiente sin toque extra. La sesión inicial prescribe dos series por ejercicio; casa usa descansos de 30 s y otras variantes pueden usar 45/60 s.

**Toques:** 0 para continuar al acabar el descanso, 1 si se salta. Luego 1 Hecho por serie de repeticiones. No hay que elegir el siguiente ejercicio ni tocar otra ficha.

**Duda:** «Saltar» domina como si fuese lo esperado; no dice que la app seguirá sola. Falta confirmar en iPhone bloqueado/interrumpido que la vuelta al ejercicio sea clara. El reloj reduce carga cognitiva y debe conservarse grande.

**Cambios:**

1. En `GuidedRest`, añadir «Seguimos automáticamente cuando termine el reloj» y renombrar botón a «Seguir sin esperar». Medir `rest_skip` junto con progresión `set_done` y finalización; el objetivo no es que todo el mundo salte.
2. En `player.tsx`, al volver de descanso anunciar y enfocar el bloque de serie actual sin desplazar el pie. Medir `workout_leave(phase=play,done)` y continuidad de `set_done`; accesibilidad con VoiceOver y movimiento reducido debe validarse manualmente.

### 15. Ayuda, salida e interrupción

**Código:** `player.tsx` (`sheet === "tech"`, `sheet === "exit"`), `src/app/(app)/app/entreno/leave.ts`.

**Primero:** ayuda abre ficha de técnica; salir abre confirmación con acciones para continuar o guardar lo realizado. La salida del reproductor se solicita con la X, no lleva directamente a Hoy. El avance se conserva en el teléfono para retomar. No confundir avance local con entreno guardado en servidor.

**Toques:** ayuda: 1 abrir + 1 cerrar para volver; salida: 1 X + 1 acción de la hoja. Guardar lo realizado abre resumen y requiere otro toque de guardar, salvo autoguardado al salir desde resumen. Sin series no hay nada que guardar.

**Duda:** una persona cansada puede creer que guardar parcial es terminar el plan. Al cerrar navegador en fase play no hay autoguardado de entreno; sí avance local. `workout_leave` también puede incluir interrupciones, no solo abandono definitivo.

**Cambios:**

1. En `player.tsx`, conservar el progreso y «Guardar lo que hice», que ya existen en `ExitSheet`; reemplazar el argumento de bono XP/nivel por «Puedes guardar una sesión parcial y seguir otro día», sin decir que ya está persistida antes del guardado. Medir `workout_leave` por `done` y `phase`, y regreso con `workout_open(resumed=true)`.
2. En técnica, mantener una salida de 44 px o más y devolver foco al movimiento al cerrar. Medir `help_open` → posterior `set_done` y `workout_leave`; falta evento de cierre, no inferir duración exacta de lectura.

### 16. Resumen previo al guardado

**Código:** `player.tsx`, rama `phase === "summary"`, `leave.ts`.

**Primero:** «Volver al entreno», «Lo lograste» si completo o «¿Terminamos?» si parcial, series/tiempo, tarjetas XP/bananas/combo y, según última serie, esfuerzo. Después enfriamiento y diversión opcional. CTA fijo: «Guardar y celebrar» o «Guardar entreno». Tras la última serie se abre automáticamente con una espera de 900 ms; no requiere otro botón Terminar.

**Toques:** 1 para guardar; esfuerzo/diversión son opcionales (0–2 adicionales). También hay intento de autoguardado al salir desde resumen con al menos una serie, no desde fase play. No afirmar que todo cierre sin tocar Guardar pierde la sesión.

**Duda:** dos cierres consecutivos; «Lo lograste» puede parecer confirmación de guardado cuando aún no lo es. XP y combo aparecen antes de valor físico y preguntas opcionales parecen tareas. El primer `workout_summary` no prueba persistencia.

**Cambios:**

1. En `player.tsx`, para primera sesión completa, iniciar guardado al llegar al resumen y mostrar estado «Guardando tu primer entreno…», reintento y celebración solo con confirmación. Usar la cola e idempotencia existentes; conservar resumen parcial explícito. Medir `workout_summary` → `workout_saved` con `done=total`, no solo tasa de vistas del resumen.
2. Mientras se mantenga guardado manual, cambiar título a «Terminaste las series» y CTA a «Guardar mi entreno»; mover XP/combo y diversión después del guardado. Marcar esfuerzo «Opcional». Medir brecha `workout_summary` → `workout_saved` y salidas en `phase=summary`.

### 17. Celebración / resumen guardado

**Código:** `src/components/workout/recap.tsx`, `recap-next.tsx`, `first-workout-offer.tsx`, rama saved de `player.tsx`.

**Primero:** icono grande, título de nivel o «Entreno completado», nombre y tarjetas de tiempo/series/XP/racha. Debajo, bananas, ajustes futuros y nivel; más abajo oferta de plan, siguiente sesión, instalación y coach según condiciones. Pie fijo: Compartir y Listo. Acción principal: Listo → Hoy (1 toque); Compartir requiere crear y luego compartir/descargar (al menos 2 más interacción del sistema).

**Duda:** si sube de nivel, el título tapa el logro físico. El recordatorio del siguiente entreno queda detrás de gamificación y oferta. «Ahora no» puede abrir una segunda oferta; no bloquea Listo. La instalación ocurre después del guardado, momento adecuado, no debe regresar a antes de entrenar. La oferta puede salir tras un primer guardado parcial y dice «Terminaste»: riesgo de celebrar completitud que no ocurrió.

**Cambios:**

1. En `recap.tsx`, mantener «Primer entreno completado» como título si es completo y mostrar nivel debajo; subir `RecapNext` antes de la tarjeta extensa de nivel/oferta. Para parcial conservar «Sesión parcial». Medir `workout_saved(done=total)` como logro previo y, para el siguiente paso, `install_click`, `app_installed`, `push_enabled` y segundo entreno; no puede atribuirse este cambio a una finalización ya ocurrida.
2. En `first-workout-offer.tsx` y su llamada desde `player.tsx`, condicionar la frase «Terminaste tu primer entreno» a completitud o cambiar a «Guardaste tu primera sesión» si es parcial. Un solo rechazo debe cerrar la oferta en este contexto. Medir `cta_click` (`primer-entreno-ahora-no`, `salida-no-gracias`), `plan_wall_exit_offer` y posterior `checkout_view`; sin confundir cierre comercial con abandono del entreno.

## Estados y criterios transversales para implementar

- **Vacío:** el resumen sin series dice «Aún no empiezas» y permite volver o salir sin guardar. Capturar también ausencia de ejercicios; no presentar una sesión vacía como éxito.
- **Carga:** existen `app/entreno/loading.tsx`, botones ocupados de registro/bienvenida y «Guardando…». Verificar con red lenta que acción y feedback permanezcan visibles; preferir skeleton cálido para carga de pantalla y texto de estado junto al botón.
- **Error y desconexión:** conservar `role=alert`, datos introducidos y salida accionable. El guardado usa bandeja local y «Reintentar ahora», con salida que explica sincronización pendiente. Nunca mostrar celebración de nube antes de confirmación ni borrar la cola al fallar.
- **Éxito:** separar cuenta creada, `onboarding_done`, series completadas y `workout_saved`; son hitos distintos. `finish()` ya navega directo a Hoy. El feedback del coach tiene fallback si falla la petición; no bloquear Listo mientras llega.
- **Accesibilidad:** usar tokens `ink`, `body`, `banana`, `paper`, `cream`, `line`, `bad`, `peel`; no introducir colores nuevos ni emojis. Mínimo 4.5:1 para texto, comprobar opacidades y estados reales. Controles principales de 48–80 px ya superan 44 px; auditar labels/checkboxes y evitar zonas `tap` superpuestas.
- **Movimiento:** conservar reloj/movimiento como centro; usar `--dur-press`, `--dur-base`, `--ease-out`. El CSS real con `prefers-reduced-motion` conserva fundidos y ralentiza el spinner, a diferencia de la guía que pide apagar animaciones. Validar ese comportamiento, no prometer ausencia total de movimiento. No reducir instrucciones por animaciones de XP.

## Medición de activación sin inflar el resultado

Denominador: cuentas reales creadas en la cohorte, con al menos 72 h transcurridas al evaluar. No usar `onboarding_done` como si fuese creación de cuenta: excluiría a quienes abandonan bienvenida. Numerador principal: cuentas con su primer entreno **completo**, persistido dentro de las 72 h desde alta; contrastar `workout_saved` con filas de entreno. El evento también sale al guardar parciales: exigir `total > 0` y `done >= total`, y publicar por separado primeros guardados parciales. Una cuenta con primer guardado parcial y posterior completo dentro de plazo debe poder activar; no filtrar solo `first_session=true`, porque después del parcial esa bandera puede desaparecer.

Deduplicar por cuenta y contrastar timestamps con alta; no contar recargas, aperturas retomadas ni eventos repetidos como personas nuevas. La demo no valida conversión de producción. El tracking de navegador puede perderse; un beacon ausente no demuestra que no se guardó. La cola offline merece reconciliación con hora de finalización y persistencia para que un retraso de sincronización no se confunda con abandono.

Embudo diagnóstico: `signup_view(inapp)` → `signup_submit(method)` / `signup_error(reason)` → `onboarding_step(0…6)` → `onboarding_done` → `hoy_view(first)` → `workout_open(first_session,variant,resumed)` → `workout_first_set` → `set_done` → `workout_summary` → `workout_saved(done,total)`. `brief_start` no es requisito en el guiado porque este evita el brief. Comparar por cohortes y fechas de despliegue; no etiquetar los números del issue como resultados del código actual sin verificar versión.

Atribución Reel: `src/components/ref-capture.tsx` envía UTMs a `/api/ref` solo con `?ref=` válido. En este checkout `/r/[code]` **ya conserva los cinco UTM permitidos** mediante `cleanUtm` al redirigir al registro, aunque descarta otros parámetros: la memoria anterior quedó desactualizada en ese punto. Conservarlos en la URL no equivale a tener atribución persistida para toda visita. `path` de funnel no conserva UTMs. Antes de comparar anuncios, verificar enlace final, cookies y atribución guardada; no segmentar por un UTM que no existe en los eventos.

## Validación visual pendiente y capturas para la landing

No se adjuntan capturas simuladas ni se presentan estimaciones como pruebas visuales. Ejecutar Playwright en un entorno con navegador y repetir en iPhone Safari/Instagram para barras, teclado, código por correo y notificaciones. Usar primero 390 × 844, repetir **375 × 667** y revisar 1280 × 800; capturar viewport y página completa con el mismo usuario/estado, sin información personal.

| Estado a capturar en los tres tamaños | Entrada / preparación | Qué comprobar |
| --- | --- | --- |
| Hero y CTA fijo tras scroll | `/` | CTA, condiciones, salto del título, sin superposición. |
| Registro, teclado, error y código | `/entrar?modo=registro`, usuario sin sesión, servicio configurado | El modo demo no representa el formulario real; comprobar UA Instagram y Safari por separado. |
| Cada paso 0–6 de bienvenida, validación y GLP-1 expandido | `/bienvenida` | Pie sticky, campos vacíos, selección explícita, consentimiento y autorización. |
| Tarjeta opcional | demo `/bienvenida?vista=tarjeta` | Ambas salidas sin tarjeta y error de guardado. |
| Primer día habitual y casa primero | demo `/app?primera=1`, cuenta nueva real gym/mixto y horario nocturno | Demo añade banner y puede abrir avisos del layout: no usarla como prueba exacta de primera visita real. |
| Guiado repeticiones, carga y tiempo, técnica, descanso, salida y reanudación | demo `/app/entreno?primera=1`, también `&casa=1` | Movimiento, reloj, clave completa, footer, foco, bloqueo/desbloqueo. |
| Resumen completo, parcial y vacío; guardando, offline, error/reintento | avanzar en reproductor sin modificar datos de producción | Estado persistido frente a pendiente y un único guardado. |
| Celebración, nivel, oferta cerrada y siguiente sesión | guardar entreno de prueba | Logro físico, Listo visible, sin repetir oferta al rechazar. |

Al implementar los cambios, actualizar en landing las capturas de **Hoy del primer día, reproductor guiado, descanso y resumen completo**; revisar `public/landing/hoy2.png` y `public/landing/entreno.png`, las referencias de `src/app/(marketing)/app-tour.tsx` y la demostración de `hero-player.tsx`. El hero incluye un reproductor construido en código: actualizar también su representación si deja de coincidir. Registro/bienvenida y errores requieren capturas de QA, no necesariamente nuevas piezas comerciales. Este PR documental no cambia assets.

## Top 5 para convertir en issues, por impacto esperado en terminar el primer entreno

El orden pondera cercanía al abandono y alcance. No son cinco promesas de aumento: el volumen es pequeño y hay que observar cohortes maduras después de cada despliegue.

| Orden | Título propuesto y alcance concreto | Criterio de aceptación | Evento principal y guarda |
| --- | --- | --- | --- |
| 1 | **Explicar la primera serie sin añadir una pantalla.** `guided.tsx`: instrucción «Haz las repeticiones…», CTA «Terminé la serie» y clave sin truncar. | En 375 px se entiende qué hacer antes de tocar; movimiento, reloj y botón siguen grandes. No agregar brief ni un toque obligatorio. | `workout_first_set / workout_open`; confirmar progresión `set_done` y primer `workout_saved` completo, sin premiar toques apresurados. |
| 2 | **Guardar la primera sesión completa al terminar las series.** `player.tsx`: guardar al entrar al resumen completo, preguntas después, reintento visible y cola idempotente. | Un único guardado confirmado; sin éxito falso offline; parcial/vacío conservan tratamiento propio. | `workout_summary` → `workout_saved` completo; contrastar filas, duplicados y fallos. |
| 3 | **Pasar de consentimiento a Hoy sin oferta de tarjeta.** `bienvenida/wizard.tsx`, `page.tsx`: terminar perfil y ofrecer pago tras el primer logro. | Prueba sin tarjeta, navegación directa, errores recuperables; oferta accesible después en Mi plan. | `onboarding_step(6)` → `onboarding_done` → `hoy_view` → completo en 72 h; vigilar `card_saved` y pagos como guardas. |
| 4 | **Quitar decisiones diferibles de bienvenida.** `wizard.tsx`, `actions.ts`, `goal.ts`: posponer meta/fecha, voz y recordatorio; mantener nivel explícito, equipo y seguridad. | Sin inventar datos ni eludir consentimiento o validaciones; Perfil permite completar lo pospuesto. Dividir implementación si el contrato de datos lo requiere. | Avance por `onboarding_step`, alta → primer `workout_saved` completo en 72 h; no medir solo bienvenida terminada. |
| 5 | **Hacer inequívoco el acceso a entrenar ahora en casa.** `readiness.tsx`, `workout-hero.tsx`: título corto, CTA casa corto y duración real, conservando orden nocturno existente. | En 375 × 667 ambos accesos visibles y distinguibles sin scroll; no agregar elección/modal. | `hoy_view(first)` → `workout_open` por variante → `workout_first_set` y guardado completo. |

La continuidad de copy Reel/landing/registro queda como siguiente mejora de adquisición: hoy la urgencia es que quienes ya crean cuenta completen el entreno. No crear issues ni cambiar código desde esta auditoría.
