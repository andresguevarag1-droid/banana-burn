export const CONFIG = {
  "slug": "CP2_otra-persona-condominio",
  "captura": "public/landing/entreno.png",
  "escenas": [
    {
      "id": "t1",
      "texto": "Cuando no sabes cuánto peso usar",
      "visual": "Persona B mira dos mancuernas en gym residencial. Distinta de la persona del anuncio original; verificar con Andrés el material original antes de elegir.",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Tu gym, tu punto de partida",
      "visual": "Plano propio del gym residencial.",
      "tipo": "texto"
    },
    {
      "id": "t3",
      "texto": "Abre tu entreno de hoy",
      "visual": "Captura real sin modificar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t4",
      "texto": "Revisa la carga indicada",
      "visual": "Captura real sin modificar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t5",
      "texto": "Sigue las repeticiones indicadas",
      "visual": "Captura real sin modificar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t6",
      "texto": "Empieza con control",
      "visual": "Captura real sin modificar cifras.",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "cierre",
      "texto": "Empieza 7 días gratis en bananaburn.app",
      "visual": "Plano propio del gym residencial.",
      "tipo": "cierre",
      "etiqueta": "Ejemplo"
    }
  ]
};
export const FPS = 30;
export const versiones = { reel: { duracion: 18, paso: 2.5 }, anuncio: { duracion: 11, paso: 2 } };
export function linea(nombre) {
  const v = versiones[nombre];
  const seleccion = nombre === 'reel' ? CONFIG.escenas : [0, 2, 4, 5, 6].map(i => CONFIG.escenas[i]);
  return seleccion.map((e, i) => ({ ...e, inicio: i * v.paso, fin: e.tipo === 'cierre' ? v.duracion : (i + 1) * v.paso }));
}
