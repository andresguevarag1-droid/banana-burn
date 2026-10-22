// Base completa de alimentos: la base original (foods.ts y antojos) enriquecida con gramos y categoría,
// más los ingredientes, platos y productos de cada archivo de esta carpeta.
import { FOODS, type Food, type FoodCat } from "@/lib/foods";
import { ANTOJOS } from "@/lib/foods-antojos";
import { compose } from "./make";
import { HUEVOS, LACTEOS } from "./lacteos";
import { CARNES, MAR } from "./carnes";
import { LEGUMBRES, VEGANO } from "./vegetal";
import { GRANOS, PANES } from "./carbos";
import { FRUTAS, NUECES, VERDURAS } from "./plantas";
import { SALSAS } from "./salsas";
import { ALCOHOL, BEBIDAS, SUPLEMENTOS } from "./bebidas";
import { DULCES } from "./dulces";
import { PLATOS } from "./platos";
import { RAPIDA } from "./rapida";
import { DESAYUNO_BASES, DESAYUNO_COMBOS, DESAYUNO_PORCION } from "./desayunos";
import { MAS, MAS_COMBOS } from "./mas";

/** Categoría, gramos de la porción y otros nombres de los alimentos de la base original. */
const LEGACY: Record<string, [FoodCat, number?, string?]> = {
  pollo: ["carnes", 150], tilapia: ["mar", 180, "corvina pescado blanco"], atun: ["mar", 100], claras: ["huevos", 198], huevos: ["huevos", 100], carne: ["carnes", 150, "picada"],
  cerdo: ["carnes", 150], yogur: ["lacteos", 200, "yogurt"], cottage: ["lacteos", 150], whey: ["suplementos", 32, "proteina en polvo"], camaron: ["mar", 150, "gambas langostinos"],
  arroz: ["granos", 158, "arroz blanco cocido"], frijoles: ["legumbres", 172, "porotos caraotas habichuelas negras"], avena: ["granos", 50, "hojuelas"], banano: ["frutas", 118, "cambur guineo"],
  papa: ["granos", 200, "patata"], pan: ["panes", 52, "pan de molde integral"], tortilla: ["panes", 52], platano: ["granos", 90], papaya: ["frutas", 145, "lechosa fruta bomba"],
  casado: ["platos"], tacospollo: ["platos", undefined, "taco"], enchiladas: ["platos"], chilaquiles: ["platos"], pozole: ["platos"], rancheros: ["desayunos"],
  arepaqueso: ["platos"], reinapepiada: ["platos", undefined, "arepa rellena"], bandeja: ["platos"], ajiaco: ["platos"], lomosaltado: ["platos"], ajigallina: ["platos"],
  pollobrasa: ["platos"], empanadapino: ["platos"], milanesa: ["platos", undefined, "apanada"], pupusas: ["platos"], baleada: ["platos"], mangu: ["desayunos"],
  habichuelas: ["platos"], pinto: ["platos"], picadillo: ["platos"], ensalada: ["verduras", 200, "ensalada verde"], sopa: ["platos", undefined, "caldo"],
  aceite: ["salsas", 14, "aceite vegetal de cocina"], natilla: ["salsas", 30, "sour cream crema acida"], aguacate: ["frutas", 75, "palta"], mani: ["nueces", 30, "cacahuate"],
  refresco: ["bebidas", 250, "fresco natural"], cerveza: ["alcohol", 355, "chela birra"], cafe: ["bebidas", 250], casadopesc: ["platos"], arrozpollo: ["platos"], olla: ["platos"],
  chifrijo: ["platos"], pintohuevo: ["desayunos"], empanada: ["platos"], tamal: ["platos", undefined, "tamales"], patacones: ["granos", 120, "tostones"], sopanegra: ["platos"],
  arrozcamaron: ["platos"], ceviche: ["platos", undefined, "cebiche"], yuca: ["granos", 150, "mandioca"], pejibaye: ["frutas", 120], pasta: ["granos", 140, "espagueti fideos tallarines macarrones"],
  camote: ["granos", 150, "batata boniato"], galletas: ["dulces", 30], queso: ["lacteos", 60], jamon: ["carnes", 56], leche: ["lacteos", 250, "leche descremada desnatada"],
  muslo: ["carnes", 100, "contramuslo"], res: ["carnes", 150, "filete de res carne asada"], pina: ["frutas", 165, "ananas"], mango: ["frutas", 250], sandia: ["frutas", 304, "patilla"],
  manzana: ["frutas", 182], fresas: ["frutas", 152, "frutillas"], cafenegro: ["bebidas", 240, "tinto cafe americano"], batido: ["bebidas", 300, "licuado"], gaseosa: ["bebidas", 355, "refresco soda coca cola"],
  imperial: ["alcohol", 355], agua: ["bebidas", 250], pizza: ["rapida"], hamburguesa: ["rapida", undefined, "burger"], pollofrito: ["rapida"], burrito: ["platos"], papas: ["rapida", 117],
  helado: ["dulces", 70, "nieve"], chocolate: ["dulces", 40],
};
const SWEET = new Set(["a-pastelchocolate", "a-tresleches", "a-flan", "a-brownie", "a-churros", "a-galletasgrandes", "a-dona", "a-arrozleche", "a-helado2", "a-paleta", "a-alfajor", "a-panduce", "a-pastelito", "a-palomitas", "a-papasbolsa"]);
const DRINK = new Set(["a-refrescogrande", "a-refrescolata", "a-energetica", "a-jugocaja"]);
const BOOZE = new Set(["a-cervezabotella", "a-cervezaartesanal", "a-michelada", "a-vino", "a-tragorefresco", "a-coctel"]);

const enrich = (f: Food): Food => {
  const l = LEGACY[f.id];
  if (l) return { ...f, cat: l[0], ...(l[1] ? { gr: l[1] } : {}), ...(l[2] ? { al: l[2] } : {}) };
  const cat: FoodCat = SWEET.has(f.id) ? "dulces" : DRINK.has(f.id) ? "bebidas" : BOOZE.has(f.id) ? "alcohol" : f.g === "tica" ? "platos" : "rapida";
  return { ...f, cat };
};

export const BASE_FOODS: Food[] = FOODS.map(enrich);
export const ANTOJOS_FOODS: Food[] = ANTOJOS.map(enrich);

const INGREDIENTS: Food[] = [
  ...LACTEOS, ...HUEVOS, ...CARNES, ...MAR, ...VEGANO, ...LEGUMBRES, ...PANES, ...GRANOS, ...VERDURAS, ...FRUTAS, ...NUECES, ...SALSAS,
  ...BEBIDAS, ...ALCOHOL, ...SUPLEMENTOS, ...DULCES, ...DESAYUNO_BASES, ...MAS,
];
const BY_ID: Record<string, Food> = Object.fromEntries([...BASE_FOODS, ...INGREDIENTS].map((f) => [f.id, f]));

/** Todo lo nuevo de la base (sin la base original ni antojos ni cadenas). */
export const DB_FOODS: Food[] = [
  ...compose("desayunos", BY_ID, [...DESAYUNO_COMBOS, ...MAS_COMBOS]), ...DESAYUNO_BASES, ...DESAYUNO_PORCION, ...PLATOS, ...RAPIDA, ...INGREDIENTS.filter((f) => f.cat !== "desayunos"),
];
