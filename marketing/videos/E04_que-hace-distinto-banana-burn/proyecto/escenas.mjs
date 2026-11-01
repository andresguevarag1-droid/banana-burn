export const CONFIG = {
  "slug": "E04_que-hace-distinto-banana-burn",
  "captura": "public/landing/entreno.png",
  "escenas": [
    {
      "id": "t1",
      "texto": "¿Y hoy qué te toca entrenar?",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Rutina según tu nivel y equipo",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "Ejercicios con guía de técnica",
      "visual": "Captura real de ejemplo sin alterar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t4",
      "texto": "Registra pesos y repeticiones",
      "visual": "Captura real de ejemplo sin alterar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t5",
      "texto": "Progresión automática de cargas",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t6",
      "texto": "Nutrición en Entreno + Nutrición",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t7",
      "texto": "Entreno: $9.99 al mes",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t8",
      "texto": "Entreno + Nutrición: $14.99 al mes",
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
