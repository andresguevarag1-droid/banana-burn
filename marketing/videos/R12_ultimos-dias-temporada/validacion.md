# Validación R12

Revisión del 30 de octubre de 2026.

- Render final: Reel 21 s / 630 cuadros y corte 15 s / 450 cuadros.
- `npm run verificar` desde `proyecto/`: ambos MP4 decodificados completos sin errores; H.264, 1080 × 1920, 30 fps, sin audio. Duración leída del archivo y contrastada con el guion.
- Textos declarados y usados por el render: entre 2 y 7 palabras por escena, incluyendo el nombre del cierre. Ritmo de cambios de 2 s o 1.5 s, más cierre de 3 s.
- Portada PNG: 1080 × 1920. Gancho completo desde cuadro 0; sin logo inicial.
- Revisión visual de la hoja: textos, calendario, Coach, botón y logo dentro de y=250 a 1570. El gancho cabe en el recorte central 1080 × 1350. El cierre mantiene Coach, botón y logo visibles los tres segundos.
- Fecha publicitaria contrastada con `src/lib/seasons.ts`: inicio 9 nov 2026, cierre de inscripción inicio + 13 días, fin inicio + 55 días. Verificador falla si cambian esas reglas.
- `npx tsc --noEmit -p .`: correcto.
- `npx eslint src scripts --quiet`: correcto.
- `npx vitest run`: 142 archivos, 1,753 tests correctos.
- `git diff --check`: correcto.

Revisión editorial pendiente de Andrés antes de publicar. Vigencia propuesta: del 16 al 22 de noviembre de 2026. La versión de 15 s no implica aprobación de uso en campañas.
