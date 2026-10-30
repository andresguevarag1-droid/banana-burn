# K14 GLP-1: "Poco apetito: cómo comer proteína suficiente"

Carrusel de 6 láminas (1080 × 1350) para @bananaburnapp. Estado: borrador para revisión de marca y aprobación de Andrés. Nada se publica.

| Archivo | Lámina |
| --- | --- |
| K14_01_portada.png | Portada (variante A) |
| K14_02_regla.png | Regla de 1.2 a 1.6 g de proteína por kg |
| K14_03_proteina-primero.png | Cómo comerla con poco apetito |
| K14_04_ideas-latinas.png | 3 ideas latinas en porción pequeña |
| K14_05_banana-shield.png | Banana Shield con captura de Nutrición: **[PENDIENTE]** |
| K14_06_cta.png | CTA a bananaburn.app y "No sustituye la indicación de tu médico." |
| caption.txt | Pie de foto final |
| variantes/ | Portadas B y C para prueba A/B |
| generar.mjs | Genera todas las láminas (instrucciones al inicio del archivo) |

## Captura pendiente

La lámina 5 lleva un marcador [PENDIENTE]. La única captura de Nutrición del repo (`public/landing/nutricion.png`) es del modo normal (2,500 kcal y 185 g), no de Banana Shield, y no se cambian números de capturas. Para cerrarla: guardar una captura real de Nutrición con Banana Shield activo como `captura-nutricion-shield.png` en esta carpeta y correr `generar.mjs`.

## De dónde sale cada dato

| Dato | Fuente |
| --- | --- |
| 1.2 a 1.6 g de proteína por kg al día | Dato del Owner; `investigacion/evidencia-programas.md` 7.1 (advisory 2025 ACLM, ASN, OMA, TOS); `src/lib/glp1.ts` |
| Peso de referencia con mucho peso por bajar | `src/lib/glp1.ts` (`refKg`); evidencia 6.2 |
| Proteína primero; comidas pequeñas cada 3 a 4 h; parar al primer signo de llenura | Evidencia 7.1, estrategias prácticas; pantalla `/app/glp1` |
| Batido de proteína o yogur griego si no llegas | Pantalla `/app/glp1`; evidencia 7.1 y 7.3 |
| Huevos, lácteos, pollo, pescado, legumbres; evitar lo grasoso o frito si empeora la náusea | Evidencia 7.1 |
| Meta en gramos al día y por comida; piso de calorías | `src/lib/glp1.ts` (`protein`, `perMeal`, `KCAL_FLOOR`) |
| Fuerza 3 días o más por semana; modo suave después de la inyección | Evidencia 7.1; `src/lib/glp1.ts` (`injectionPhase`) |
| Banana Shield incluido en Entreno + Nutrición | `src/app/(app)/app/perfil/page.tsx` |
| 7 días gratis sin tarjeta | Memoria de la oficina |

No se nombran medicamentos, no hay cifras de gramos por plato, ni antes y después ni testimonios.

## Variantes A/B de portada

- **A (apuesto por esta):** "Poco apetito: cómo comer proteína suficiente". Dice el problema y la promesa tal como lo busca la persona; es la más guardable.
- **B:** "¿Comes poco con GLP-1? Así llegas a tu proteína". Filtra mejor a la audiencia GLP-1, pero la pregunta puede sentirse más de anuncio.
- **C:** "Si te llenas rápido, empieza por esto". Curiosidad pura; puede ganar en alcance y perder en guardados.

Sugerencia: publicar A y probar C como portada en una historia o un anuncio con el mismo carrusel.
