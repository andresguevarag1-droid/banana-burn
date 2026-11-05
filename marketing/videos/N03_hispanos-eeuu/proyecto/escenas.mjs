export const CONFIG = {
  "slug": "N03_hispanos-eeuu",
  "captura": "public/landing/entreno.png",
  "recorte": {
    "x": 0,
    "y": 870,
    "w": 780,
    "h": 610
  },
  "escenas": [
    {
      "id": "t1",
      "texto": "Sales del turno. ¿Qué haces en el gym?",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Coach Banana te dice qué hacer",
      "tipo": "telefono"
    },
    {
      "id": "t3",
      "texto": "Con cuánto peso",
      "tipo": "telefono"
    },
    {
      "id": "t4",
      "texto": "Y cuántas repeticiones",
      "tipo": "telefono"
    },
    {
      "id": "t5",
      "texto": "Sabes cuánto te falta",
      "tipo": "telefono"
    },
    {
      "id": "t6",
      "texto": "Entras, entrenas y te vas",
      "tipo": "texto"
    },
    {
      "id": "t7",
      "texto": "Hoy entrenas en casa",
      "tipo": "telefono",
      "captura": "C1",
      "archivo": "public/landing/campana-9nov/c1-hoy-primer-dia.png"
    },
    {
      "id": "t8",
      "texto": "US$9.99 al mes. Cancela cuando quieras",
      "tipo": "texto"
    },
    {
      "id": "cierre",
      "texto": "Empieza 7 días gratis en bananaburn.app",
      "tipo": "cierre"
    }
  ]
};
export const FPS = 30;
export const versiones = { reel: { duracion: 20 }, anuncio: { duracion: 15 } };
const duraciones = [2, 2, 2.5, 2, 2, 2, 2, 2.5, 3];
const corta = [0, 1, 2, 3, 6, 7, 8];
export function linea(nombre) {
  let inicio = 0;
  const seleccion = nombre === "reel" ? CONFIG.escenas : corta.map(i => CONFIG.escenas[i]);
  return seleccion.map((e, i) => {
    const duracion = nombre === "reel" ? duraciones[i] : e.tipo === "cierre" ? 3 : 2;
    const escena = { ...e, inicio, fin: inicio + duracion };
    inicio += duracion;
    return escena;
  });
}
