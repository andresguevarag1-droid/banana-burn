export const CONFIG = {
  "slug": "N02_no-sabes-que-hacer-en-el-gym",
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
      "texto": "¿No sabes qué hacer en el gym?",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Coach Banana te dice el ejercicio",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t3",
      "texto": "Con cuánto peso",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t4",
      "texto": "Y cuántas repeticiones",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t5",
      "texto": "Y cómo se hace",
      "tipo": "pendiente",
      "captura": "C8"
    },
    {
      "id": "t6",
      "texto": "Terminas la serie y sigues",
      "tipo": "texto"
    },
    {
      "id": "t7",
      "texto": "Un ejercicio por pantalla",
      "tipo": "pendiente",
      "captura": "C6"
    },
    {
      "id": "cierre",
      "texto": "Empieza 7 días gratis en bananaburn.app",
      "tipo": "cierre"
    }
  ]
};
export const FPS = 30;
export const versiones = { reel: { duracion: 18 }, anuncio: { duracion: 15 } };
const duraciones = [2, 2, 2, 2, 2, 2.5, 2.5, 3];
const corta = [0, 1, 2, 3, 4, 6, 7];
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
