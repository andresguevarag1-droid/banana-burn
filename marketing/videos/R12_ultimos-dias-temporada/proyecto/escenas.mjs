export const FPS = 30;
const tarjeta = (lineas) => ({tipo: "tarjeta", lineas, texto: lineas.join(" ")});
export const ESCENA = {
 gancho: tarjeta(["Últimos días para", "la Temporada 1"]),
 fecha: tarjeta(["Inscripciones hasta el", "22 de noviembre"]),
 running: tarjeta(["Elige Running"]),
 raquetas: tarjeta(["O Raquetas"]),
 cross: tarjeta(["O Cross Training"]),
 fin: tarjeta(["Temporada hasta el", "3 de enero"]),
 detalle: tarjeta(["Consulta los detalles", "en bananaburn.app/temporadas"]),
 recordatorio: tarjeta(["Cierre de inscripciones:", "22 de noviembre"]),
 decision: tarjeta(["Elige tu deporte", "para esta temporada"]),
 cierre: {tipo:"cierre", texto:"Empieza 7 días gratis en bananaburn.app BananaBurn"},
};
export const REEL = {archivo:"R12_ultimos-dias-temporada.mp4", duracion:21, escenas:[[0,"gancho"],[2,"fecha"],[4,"running"],[6,"raquetas"],[8,"cross"],[10,"fin"],[12,"detalle"],[14,"recordatorio"],[16,"decision"],[18,"cierre"]]};
export const ANUNCIO = {archivo:"R12_ultimos-dias-temporada_15s.mp4", duracion:15, escenas:[[0,"gancho"],[1.5,"fecha"],[3,"running"],[4.5,"raquetas"],[6,"cross"],[7.5,"fin"],[9,"detalle"],[10.5,"recordatorio"],[12,"cierre"]]};
export const palabras = texto => texto.split(/\s+/).filter(Boolean).length;
export function linea(v) {return v.escenas.map(([inicio,id],i)=>({id,inicio,fin:v.escenas[i+1]?.[0]??v.duracion,...ESCENA[id]}));}
