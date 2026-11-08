// Diccionario en-US (#287): la clave es la frase en español tal como está en el código. Un archivo por zona del camino
// de conversión; lo que no está aquí sale en español.
import { AUTH } from "./auth";
import { EMAIL } from "./email";
import { ENGINE } from "./engine";
import { LANDING } from "./landing";
import { OFFER } from "./offer";
import { PLAN } from "./plan";
import { PROFILE } from "./profile";
import { TODAY } from "./today";
import { WIZARD } from "./wizard";
import { WORKOUT } from "./workout";

export const EN_PARTS = { OFFER, AUTH, ENGINE, WIZARD, TODAY, WORKOUT, PLAN, EMAIL, LANDING, PROFILE };
export const EN: Readonly<Record<string, string>> = Object.assign({}, ...Object.values(EN_PARTS));
