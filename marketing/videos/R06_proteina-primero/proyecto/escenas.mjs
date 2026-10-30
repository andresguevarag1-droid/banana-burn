export const CONFIG = {
  "slug": "R06_proteina-primero",
  "captura": "public/landing/nutricion.png",
  "escenas": [
    {
      "id": "t1",
      "texto": "Poco apetito: proteína primero",
      "visual": "Plato pequeño con huevo, luz natural.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Elige una fuente de proteína",
      "visual": "Manos preparando huevo, sin prescribir cantidades.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "Huevo, pollo o yogur natural",
      "visual": "Cortes de alimentos reales, sin números nutricionales añadidos.",
      "tipo": "texto"
    },
    {
      "id": "t4",
      "texto": "Registra lo que comes",
      "visual": "Captura real de Comida, completa.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t5",
      "texto": "Revisa tu proteína del día",
      "visual": "Acercamiento al dato original, sin modificarlo.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t6",
      "texto": "Ajusta las porciones con tu equipo médico",
      "visual": "Plato real y cubiertos; sin plan alimentario individual.",
      "tipo": "texto"
    },
    {
      "id": "t7",
      "texto": "No sustituye la indicación de tu médico.",
      "visual": "Tarjeta paper con la advertencia sola, grande.",
      "tipo": "texto"
    },
    {
      "id": "t8",
      "texto": "Entrena y registra a tu ritmo",
      "visual": "Regreso a captura real de Comida.",
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
