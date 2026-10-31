export const CONFIG = {
  "slug": "R14_tres-dias",
  "captura": "public/landing/hoy2.png",
  "escenas": [
    {
      "id": "t1",
      "texto": "3 días: empieza por ahí",
      "visual": "Reformula “bastan”: no garantiza resultados universales.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Haz espacio en tu semana",
      "visual": "Agenda ilustrativa, sin interfaz inventada.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "Alterna fuerza y recuperación",
      "visual": "UGC: mancuernas y descanso.",
      "tipo": "texto"
    },
    {
      "id": "t4",
      "texto": "Adapta el plan a tu nivel",
      "visual": "Captura real, sin modificar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t5",
      "texto": "Revisa qué toca hoy",
      "visual": "Captura real, sin modificar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t6",
      "texto": "Entrena con el equipo disponible",
      "visual": "UGC con mancuernas propias.",
      "tipo": "texto"
    },
    {
      "id": "t7",
      "texto": "Registra cada sesión",
      "visual": "Mostrar acción sin inventar resultados.",
      "tipo": "texto"
    },
    {
      "id": "t8",
      "texto": "La constancia se construye",
      "visual": "Tarjeta de texto.",
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
