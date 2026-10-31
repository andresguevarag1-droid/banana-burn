export const CONFIG = {
  "slug": "R13_comida-musculo",
  "captura": "public/landing/nutricion.png",
  "escenas": [
    {
      "id": "t1",
      "texto": "Lo que como para cuidar músculo",
      "visual": "Menú ilustrativo; no testimonio ni garantía.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Desayuno: huevos con pan",
      "visual": "Grabar preparación propia, sin cantidades prescritas.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "Almuerzo: pollo, arroz y frijoles",
      "visual": "Plano cenital de comida propia.",
      "tipo": "texto"
    },
    {
      "id": "t4",
      "texto": "Merienda: yogur con banana",
      "visual": "Sin prometer un menú universal.",
      "tipo": "texto"
    },
    {
      "id": "t5",
      "texto": "Cena: lentejas y verduras",
      "visual": "Alternativa ilustrativa, adaptar porciones individualmente.",
      "tipo": "texto"
    },
    {
      "id": "t6",
      "texto": "Registra lo que comes",
      "visual": "Captura real, sin modificar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t7",
      "texto": "Entreno + Nutrición",
      "visual": "Captura real, sin modificar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t8",
      "texto": "Combina comida y fuerza",
      "visual": "Sin prometer evitar toda pérdida muscular.",
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
