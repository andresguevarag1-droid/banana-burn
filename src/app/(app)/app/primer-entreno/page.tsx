// Embudo (5 nov): de 21 que terminaron la bienvenida, 11 llegaron a Hoy y nunca abrieron el entreno. Al terminar la
// bienvenida ya no van a Hoy: se les pregunta "¿Entrenamos ahora?". Sí en casa, sí en el gym, o "ahora no" con la hora del
// recordatorio, para que nadie se vaya sin decidir.
import type { Metadata } from "next";
import { NowOrLater } from "./now-or-later";

export const metadata: Metadata = { title: "Tu primer entreno" };

export default function PrimerEntreno() {
  return <NowOrLater />;
}
