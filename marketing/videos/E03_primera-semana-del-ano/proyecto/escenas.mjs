export const CONFIG = {
  "slug": "E03_primera-semana-del-ano",
  "captura": "public/landing/hoy2.png",
  "escenas": [
    {
      "id": "t1",
      "texto": "Tu primera semana, paso a paso",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Día 1: elige tu rutina",
      "visual": "Captura real de ejemplo sin alterar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t3",
      "texto": "Día 2: revisa qué toca",
      "visual": "Captura real de ejemplo sin alterar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t4",
      "texto": "Día 3: reserva tiempo para recuperar",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t5",
      "texto": "Día 4: sigue tu rutina",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t6",
      "texto": "Día 5: registra cómo te sientes",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t7",
      "texto": "Día 6: camina a tu ritmo",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t8",
      "texto": "Día 7: revisa y decide",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "cierre",
      "texto": "Empieza 7 días gratis en bananaburn.app",
      "visual": "Coach Banana señalando oficial, botón ink y logo.",
      "tipo": "cierre"
    }
  ]
};
export const FPS = 30;
export const versiones = { reel: { duracion: 19, paso: 2 }, anuncio: { duracion: 15, paso: 1.5 } };
export function linea(nombre) {
 const v = versiones[nombre];
 return CONFIG.escenas.map((e,i) => ({...e,inicio:i*v.paso,fin:i===8?v.duracion:(i+1)*v.paso}));
}
