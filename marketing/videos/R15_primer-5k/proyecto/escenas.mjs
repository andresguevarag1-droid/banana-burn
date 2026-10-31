export const CONFIG = {
  "slug": "R15_primer-5k",
  "captura": "public/landing/running-plan.webp",
  "escenas": [
    {
      "id": "t1",
      "texto": "De 0 a tu primer 5K",
      "visual": "Zapatillas propias, sin promesa de plazo.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Empieza caminando si lo necesitas",
      "visual": "UGC: caminata cómoda.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "Alterna caminar y correr",
      "visual": "UGC: trote cómodo, sin prescribir intervalos.",
      "tipo": "texto"
    },
    {
      "id": "t4",
      "texto": "Avanza según tu nivel",
      "visual": "Tarjeta de texto.",
      "tipo": "texto"
    },
    {
      "id": "t5",
      "texto": "Conoce el plan de carrera",
      "visual": "Captura real, sin modificar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t6",
      "texto": "Aumenta poco a poco",
      "visual": "Captura real, sin modificar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t7",
      "texto": "Deja espacio para recuperarte",
      "visual": "UGC: descanso.",
      "tipo": "texto"
    },
    {
      "id": "t8",
      "texto": "Tu primer 5K, a tu ritmo",
      "visual": "No prometer llegar en la prueba.",
      "tipo": "texto"
    },
    {
      "id": "cierre",
      "texto": "Empieza 7 días gratis en bananaburn.app",
      "visual": "Coach Banana señalando oficial, botón ink y logo.",
      "tipo": "cierre"
    }
  ],
  "recorte": {
    "x": 32,
    "y": 138,
    "w": 716,
    "h": 475
  }
};
export const FPS = 30;
export const versiones = { reel: { duracion: 19, paso: 2 }, anuncio: { duracion: 15, paso: 1.5 } };
export function linea(nombre) {
  const v = versiones[nombre];
  return CONFIG.escenas.map((e, i) => ({ ...e, inicio: i * v.paso, fin: i === 8 ? v.duracion : (i + 1) * v.paso }));
}
