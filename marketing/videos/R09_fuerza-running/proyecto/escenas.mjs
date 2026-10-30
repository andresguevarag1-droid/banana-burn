export const CONFIG = {
  "slug": "R09_fuerza-running",
  "captura": "public/landing/running-plan.webp",
  "escenas": [
    {
      "id": "t1",
      "texto": "Correr también requiere fuerza",
      "visual": "Zapatillas y mancuernas en plano; gancho educativo.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Sin fuerza no significa lesión segura",
      "visual": "Tarjeta que evita la equivalencia absoluta del kit.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "Combina carrera y fuerza",
      "visual": "Tomas propias alternadas de carrera cómoda y fuerza controlada.",
      "tipo": "texto"
    },
    {
      "id": "t4",
      "texto": "Revisa tu plan de carrera",
      "visual": "Captura real completa de running-plan.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t5",
      "texto": "Organiza tus sesiones",
      "visual": "Misma captura completa; entrada nueva sin cambiar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t6",
      "texto": "Conoce la Temporada de Running",
      "visual": "Tarjeta de descubrimiento de la temporada, sin prometer inclusión.",
      "tipo": "texto"
    },
    {
      "id": "t7",
      "texto": "Compra aparte; incluida con plan anual",
      "visual": "Tarjeta de condiciones: una temporada incluida por año pagado.",
      "tipo": "texto"
    },
    {
      "id": "t8",
      "texto": "Empieza con un plan",
      "visual": "Regreso al ejemplo real de running-plan.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "cierre",
      "texto": "Empieza 7 días gratis en bananaburn.app",
      "visual": "Coach Banana señalando + botón ink + logo oficial.",
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
