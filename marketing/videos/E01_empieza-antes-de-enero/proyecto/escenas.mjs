export const CONFIG = {
  "slug": "E01_empieza-antes-de-enero",
  "captura": "public/landing/hoy2.png",
  "escenas": [
    {
      "id": "t1",
      "texto": "No esperes al 1 de enero",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Empieza con lo que tienes",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "Abre tu rutina de hoy",
      "visual": "Captura real de ejemplo sin alterar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t4",
      "texto": "Ajustada a tu nivel y equipo",
      "visual": "Captura real de ejemplo sin alterar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t5",
      "texto": "Reserva un espacio para entrenar",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t6",
      "texto": "Registra tu primera sesión",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t7",
      "texto": "Construye el hábito desde hoy",
      "visual": "Tarjeta tipográfica; toma UGC opcional según brief.",
      "tipo": "texto"
    },
    {
      "id": "t8",
      "texto": "Siete días gratis y hoy no pagas",
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
