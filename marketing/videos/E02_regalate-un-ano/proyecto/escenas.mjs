export const CONFIG = {
  "slug": "E02_regalate-un-ano",
  "captura": "public/landing/entreno.png",
  "escenas": [
    {
      "id": "t1",
      "texto": "Tu regalo: un año para entrenar",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Entreno: $59.99 al año",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "Tu rutina en el celular",
      "visual": "Captura real de ejemplo sin alterar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t4",
      "texto": "Con tu nivel y equipo",
      "visual": "Captura real de ejemplo sin alterar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t5",
      "texto": "Entreno + Nutrición: $89.99 al año",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t6",
      "texto": "Un pago cubre doce meses",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t7",
      "texto": "Incluye una temporada por año pagado",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t8",
      "texto": "Compara planes en bananaburn.app/precios",
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
