# E03 de El Nuevo: "Sientes que todos te miran"

Capítulo 3 de la serie El Nuevo, en el formato de V02 (monos que hablan con globos, sin voz). El Nuevo siente que todo el gym lo mira; los "todos" resultan ser sus propios reflejos, Coach Platanita ni lo vio y Coach Banana le recuerda que todos empezamos así. Estado: **borrador para revisión de marca. No se publica ni se fusiona sin la aprobación por escrito de Andrés.**

| Archivo | Qué es |
| --- | --- |
| guion.md | Guion de 23 s y versión de 15 s, con tiempos, subtítulos, conteo de palabras y pie de foto |
| prompts-higgsfield.md | Seis prompts de imágenes fijas (T1 a T6), uno por toma, para copiar y pegar |
| animacion.md | Plan de animación en código de cada toma |
| storyboard.md y E03_todos-te-miran_storyboard.png | Storyboard: un cuadro por escena con zona segura y recorte de portada |
| E03_todos-te-miran_animatic.mp4 | Animatic de 23 s con los cuadros de referencia: tiempos, cámaras y textos reales. No se publica |
| E03_todos-te-miran_15s_animatic.mp4 | Lo mismo, versión de 15 s para anuncios |
| proyecto/ | Editable: `escenas.mjs` (guion, tomas, cámaras y textos) y `render.mjs` (dibujo y render) |

## Lo que falta para el video final

1. **Las seis imágenes de Higgsfield** (T1 a T6) con los prompts de `prompts-higgsfield.md`, en `proyecto/tomas/T1.png` a `T6.png`. Desde aquí no se puede llegar a Higgsfield.
2. **Referencias que no están en el repositorio:**
   - El Reel **V02** "POV: tu primer día en el gym (versión monos)", o al menos un cuadro de El Nuevo de cuerpo entero y uno del gym. El kit de noviembre ya pedía las poses de El Nuevo en PNG con fondo transparente, y siguen faltando.
   - La imagen oficial de **Coach Platanita** de cuerpo entero.
   - El **gym de referencia**. Si no hay uno de V02, sirve la imagen del gym del condominio de la landing (`IMG.hero` en `src/app/condominios/page.tsx`).
   - La **pose "señala"** de Coach Banana en PNG (`COACH_POSE.senala`), en `assets/coach-banana-senala.png`. El CDN de Higgsfield no se pudo abrir desde aquí. Mientras falte, el cierre usa `public/brand/mascota-sola.webp`, igual que R04.
3. Los capítulos 1 y 2 tampoco están en el repositorio. Si E03 tiene que retomar algo de ellos (un chiste o una frase), hay que decirlo.

Con las imágenes en su lugar, `npm run render` saca `E03_todos-te-miran.mp4`, `E03_todos-te-miran_15s.mp4`, la portada (`E03_todos-te-miran_portada.png`) y el storyboard con las tomas reales. Antes hay que revisar las posiciones de las cabezas en `TOMAS` (`proyecto/escenas.mjs`) para que las colas de los globos apunten bien.

## Cómo volver a hacer el render

```bash
cd marketing/videos/E03_todos-te-miran/proyecto
npm install
chmod +x node_modules/@ffmpeg-installer/*/ffmpeg   # si npm no corrió el postinstall del binario
npm run render        # los dos MP4, la portada (si está T1) y el storyboard
```

Para usar otro ffmpeg, pon su ruta en la variable `FFMPEG`.
