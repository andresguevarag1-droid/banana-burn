export const CONFIG = {
  "slug": "R16_gym-entrenador",
  "captura": "public/landing/comunidad.png",
  "escenas": [
    {
      "id": "t1",
      "texto": "El gym del edificio, con entrenador",
      "visual": "Entrenador en el celular, no presencial.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Tu entrenador en el celular",
      "visual": "UGC: entrada a gym propio con permiso.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "Usa el equipo que tienes",
      "visual": "Mancuernas reales, sin prometer supervisión presencial.",
      "tipo": "texto"
    },
    {
      "id": "t4",
      "texto": "Sigue tu rutina en Banana Burn",
      "visual": "UGC celular sin pantalla falsa.",
      "tipo": "texto"
    },
    {
      "id": "t5",
      "texto": "Comparte el proceso en Comunidad",
      "visual": "Captura real, sin modificar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t6",
      "texto": "Encuentra compañía para seguir",
      "visual": "Captura real, sin modificar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t7",
      "texto": "Cada residente elige su plan",
      "visual": "No paga la administración por este CTA.",
      "tipo": "texto"
    },
    {
      "id": "t8",
      "texto": "Empieza con siete días gratis",
      "visual": "Prueba general; no mes de convenio.",
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
  return CONFIG.escenas.map((e, i) => ({ ...e, inicio: i * v.paso, fin: i === 8 ? v.duracion : (i + 1) * v.paso }));
}
