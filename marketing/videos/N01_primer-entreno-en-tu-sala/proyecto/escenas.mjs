export const CONFIG = {
  "slug": "N01_primer-entreno-en-tu-sala",
  "captura": "public/landing/campana-9nov/c1-hoy-primer-dia.png",
  "escenas": [
    {
      "id": "t1",
      "texto": "Tu primer entreno en casa: 12 minutos",
      "tipo": "texto"
    },
    {
      "id": "t2",
      "texto": "Sin equipo ni gym",
      "tipo": "telefono",
      "captura": "C1",
      "archivo": "public/landing/campana-9nov/c1-hoy-primer-dia.png"
    },
    {
      "id": "t3",
      "texto": "Un ejercicio por pantalla",
      "tipo": "telefono",
      "captura": "C2",
      "archivo": "public/landing/campana-9nov/c2-guiado-casa.png"
    },
    {
      "id": "t4",
      "texto": "Abre tu entreno",
      "tipo": "telefono",
      "archivo": "public/landing/campana-9nov/c2-guiado-casa.png"
    },
    {
      "id": "t5",
      "texto": "Tocas Terminé la serie",
      "tipo": "video",
      "captura": "C3",
      "archivo": "public/landing/campana-9nov/c3-termine-la-serie.mp4"
    },
    {
      "id": "t6",
      "texto": "Descansas y sigues",
      "tipo": "telefono",
      "captura": "C4",
      "archivo": "public/landing/campana-9nov/c4-descanso.png"
    },
    {
      "id": "t7",
      "texto": "12 minutos en tu sala",
      "tipo": "texto"
    },
    {
      "id": "t8",
      "texto": "Terminaste las series",
      "tipo": "telefono",
      "captura": "C5",
      "archivo": "public/landing/campana-9nov/c5-resumen.png"
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
const corta = [0, 1, 2, 4, 5, 7, 8];
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
