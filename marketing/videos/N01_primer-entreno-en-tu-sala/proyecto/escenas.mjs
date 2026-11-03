export const CONFIG = {
  "slug": "N01_primer-entreno-en-tu-sala",
  "captura": "public/landing/hoy2.png",
  "escenas": [
    {
      "id": "t1",
      "texto": "Tu primer entreno en tu sala",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Sin equipo ni gym",
      "tipo": "pendiente",
      "captura": "C1"
    },
    {
      "id": "t3",
      "texto": "Un ejercicio por pantalla",
      "tipo": "pendiente",
      "captura": "C2"
    },
    {
      "id": "t4",
      "texto": "Abre tu entreno",
      "tipo": "telefono",
      "etiqueta": "Ejemplo"
    },
    {
      "id": "t5",
      "texto": "Tocas Hecho",
      "tipo": "pendiente",
      "captura": "C3"
    },
    {
      "id": "t6",
      "texto": "Descansas y sigues",
      "tipo": "pendiente",
      "captura": "C4"
    },
    {
      "id": "t7",
      "texto": "15 minutos o menos",
      "tipo": "texto"
    },
    {
      "id": "t8",
      "texto": "Tu primer entreno, hecho",
      "tipo": "pendiente",
      "captura": "C5"
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
const corta = [0, 1, 3, 4, 5, 7, 8];
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
