# Fuentes del one-pager y la presentación para la junta

`generar.mjs` dibuja los dos PDF con pdfkit y Plus Jakarta Sans (paquete @fontsource). No necesita navegador.

```
cd marketing/condominios/fuentes
npm install
npm run generar
```

Escribe `../one-pager-junta.pdf` (1 página A4) y `../presentacion-junta.pdf` (6 diapositivas 16:9).

- Los textos están arriba del archivo (PROBLEMS, FEATURES, STEPS, NO_PAGAN, DECIDE). Si cambias uno, revisa que todo siga cabiendo: el script no crea páginas nuevas, así que un texto largo se corta.
- Las imágenes son capturas reales de la app que ya usa la landing (`public/landing/hoy2.png`, `entreno.png`, `nutricion.png`, `coach.png`) y el icono `assets/icon-only.png`. No agregues capturas que no salgan de la app.
- La oferta no cambia: primer mes gratis para todos los residentes, la administración y el condominio no pagan nada, cada residente decide si sigue con su plan individual.
