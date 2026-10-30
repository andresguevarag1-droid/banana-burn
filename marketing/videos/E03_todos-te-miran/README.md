# E03 de El Nuevo: "Sientes que todos te miran"

Capítulo 3 de la serie El Nuevo, en el formato de V02 (monos que hablan con globos, sin voz). El Nuevo siente que todo el gym lo mira; los "todos" resultan ser sus propios reflejos, Coach Platanita ni lo vio y Coach Banana le recuerda que todos empezamos así. Estado: **borrador para revisión de marca. No se publica ni se fusiona sin la aprobación por escrito de Andrés.**

| Archivo | Qué es |
| --- | --- |
| guion.md | Guion de 23 s y versión de 15 s, con tiempos, subtítulos, conteo de palabras y pie de foto |
| prompts-higgsfield.md | Seis prompts de imágenes fijas (T1 a T6), uno por toma, para copiar y pegar |
| animacion.md | Plan de animación en código de cada toma |
| storyboard.md y E03_todos-te-miran_storyboard.png | Storyboard: un cuadro por escena con zona segura y recorte de portada |
| proyecto/ | Editable: `escenas.mjs` (guion, tomas, cámaras y textos) y `render.mjs` (dibujo y render) |

## Estado de producción (30 oct 2026)

Ya están las 6 tomas en `proyecto/tomas/T1.png` a `T6.png` y el render final:

| Archivo | Qué es |
| --- | --- |
| E03_todos-te-miran.mp4 | Reel final de 24.6 s, 1080 x 1920, 30 fps, con narrador y sonidos de los monos (-14 LUFS) |
| E03_todos-te-miran_15s.mp4 | Versión de 15.6 s para anuncios, con narrador |
| E03_todos-te-miran_portada.png | Portada 1080 x 1920 con el gancho |
| E03_todos-te-miran_storyboard.png | Storyboard con las tomas reales |

Cambios sobre el borrador:
- Las tomas siguen el estilo real de la serie (V02 y el Reel del condominio): **foto realista del gym del condominio con los monos como stickers de borde blanco**, no dibujo plano. Se generaron con GPT Image 2.5 en Higgsfield usando como referencia el gym del condominio, El Nuevo oficial, Coach Banana oficial y Coach Platanita oficial. T5 reutiliza la toma de sentadilla del Reel del condominio.
- Posiciones de las cabezas en `TOMAS` y cámaras de `cara`, `spoiler` y `platanita` ajustadas a las imágenes reales.
- Cierre: pose "señala" oficial en `assets/coach-banana-senala.png` y botón más grande en dos líneas ("Empieza 7 días gratis" en banana, "en bananaburn.app" en blanco).
- Se quitaron los animatics: ya los reemplaza el render final.

Versión final con video (30 oct): las 6 tomas se animaron en Higgsfield (Kling 3.0, imagen a video, 720p) a partir de T1 a T6, y Andrés grabó la narración (ElevenLabs v4, voz Julian). Cada escena dura lo que dura su frase; los subtítulos son los de la narración y el gancho POV está completo desde el cuadro 0. El render en código de `proyecto/` queda como respaldo sin video.

Narración: "¿Sientes que todo el gym te está mirando? Spoiler: el único que te mira eres tú. Respira. Nadie te está juzgando. Cada quien viene a lo suyo... y tú también. Tu plan te dice qué hacer, con cuánto peso y cuántas repeticiones. Primera serie. Nadie miró. Todos empezamos así. Siete días gratis en bananaburn punto app."

Pendiente de Andrés: aprobación de marca y la publicación. No se fusiona sin su aprobación.

## Cómo volver a hacer el render

```bash
cd marketing/videos/E03_todos-te-miran/proyecto
npm install
chmod +x node_modules/@ffmpeg-installer/*/ffmpeg   # si npm no corrió el postinstall del binario
npm run render        # los dos MP4, la portada (si está T1) y el storyboard
```

Para usar otro ffmpeg, pon su ruta en la variable `FFMPEG`.
