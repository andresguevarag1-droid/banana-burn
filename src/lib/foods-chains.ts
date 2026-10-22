// Restaurantes y cadenas de comida rápida: productos más pedidos con kcal y macros por porción.
// `src: "oficial"` = tabla nutricional publicada por la cadena (ver CHAINS[].fuente).
// `src: "aprox"` = la tabla oficial no se pudo consultar o no trae el dato; valor de referencia publicado
// para el producto en EE. UU. Los valores cambian por país y por receta: en pantalla siempre se avisa.
// `best`: opción más ligera o con más proteína de la misma cadena, para sugerirla con amabilidad.

export type ChainId =
  | "mcd" | "bk" | "kfc" | "tacobell" | "subway" | "dominos" | "pizzahut" | "littlecaesars" | "papajohns"
  | "wendys" | "popeyes" | "starbucks" | "dunkin" | "campero" | "carls";

export type ChainFood = { id: string; cadena: ChainId; n: string; p: string; k: number; pr: number; c: number; f: number; src: "oficial" | "aprox"; best?: true };

export type Chain = {
  id: ChainId; n: string;
  /** Formas en que la gente escribe la cadena al buscar. */
  alias: string[];
  /** Países (ISO 2) donde la cadena es especialmente común; sin `cc`, está en casi toda la región. */
  cc?: string[];
  /** De dónde salen los datos (se muestra en la lista). */
  fuente: string;
};

export const CHAINS: Chain[] = [
  { id: "mcd", n: "McDonald's", alias: ["mcdonalds", "mcdonald", "mc donalds", "mcd", "mac", "mc"], fuente: "Referencia del menú de McDonald's EE. UU. (aproximado)" },
  { id: "bk", n: "Burger King", alias: ["bk", "burguer king", "burgerking"], fuente: "Referencia del menú de Burger King EE. UU. (aproximado)" },
  { id: "kfc", n: "KFC", alias: ["kentucky", "kentucky fried chicken"], fuente: "Referencia del menú de KFC EE. UU. (aproximado)" },
  { id: "popeyes", n: "Popeyes", alias: ["popeye"], fuente: "Referencia del menú de Popeyes EE. UU. (aproximado)" },
  { id: "campero", n: "Pollo Campero", alias: ["campero"], cc: ["GT", "SV", "HN", "NI", "EC"], fuente: "Estimación con valores publicados para Pollo Campero (aproximado)" },
  { id: "tacobell", n: "Taco Bell", alias: ["tacobell"], fuente: "Referencia del menú de Taco Bell EE. UU. (aproximado)" },
  { id: "subway", n: "Subway", alias: ["subguey"], fuente: "Referencia del menú de Subway EE. UU., pan blanco y vegetales (aproximado)" },
  { id: "wendys", n: "Wendy's", alias: ["wendys", "wendy"], fuente: "Tabla nutricional oficial de Wendy's, menú principal 2025" },
  { id: "carls", n: "Carl's Jr.", alias: ["carls", "carls jr", "carl's", "carlsjr"], fuente: "Información nutricional oficial de Carl's Jr. EE. UU., junio 2025" },
  { id: "dominos", n: "Domino's", alias: ["dominos", "domino"], fuente: "Guía nutricional oficial de Domino's EE. UU." },
  { id: "pizzahut", n: "Pizza Hut", alias: ["pizzahut", "hut"], fuente: "Referencia del menú de Pizza Hut EE. UU. (aproximado)" },
  { id: "littlecaesars", n: "Little Caesars", alias: ["little caesar", "caesars", "little cesars", "littlecaesars"], fuente: "Guía nutricional oficial de Little Caesars EE. UU. (pizza grande dividida en 8)" },
  { id: "papajohns", n: "Papa John's", alias: ["papa johns", "papajohns", "papa john"], fuente: "Detalle nutricional oficial de Papa John's EE. UU." },
  { id: "starbucks", n: "Starbucks", alias: ["starbuck", "sbux"], fuente: "Referencia del menú de Starbucks EE. UU., tamaño grande (aproximado)" },
  { id: "dunkin", n: "Dunkin'", alias: ["dunkin", "dunkin donuts", "dunkin'"], fuente: "Referencia del menú de Dunkin' EE. UU. (aproximado)" },
];

export const CHAIN_BY_ID = Object.fromEntries(CHAINS.map((c) => [c.id, c])) as Record<ChainId, Chain>;

type Row = [id: string, n: string, p: string, k: number, pr: number, c: number, f: number, best?: 1];
const mk = (cadena: ChainId, src: ChainFood["src"], rows: Row[]): ChainFood[] =>
  rows.map(([id, n, p, k, pr, c, f, best]) => ({ id: `${cadena}-${id}`, cadena, n, p, k, pr, c, f, src, ...(best ? { best: true as const } : {}) }));

const BASE: ChainFood[] = [
  ...mk("mcd", "aprox", [
    ["bigmac", "Big Mac", "1 unid.", 580, 25, 45, 34],
    ["cuarto", "Cuarto de Libra con queso", "1 unid.", 520, 30, 42, 26],
    ["doblecuarto", "Doble Cuarto de Libra con queso", "1 unid.", 740, 48, 43, 42],
    ["doblequeso", "Doble hamburguesa con queso (McDouble)", "1 unid.", 400, 22, 33, 20],
    ["queso", "Hamburguesa con queso", "1 unid.", 300, 15, 32, 13],
    ["hamburguesa", "Hamburguesa sencilla", "1 unid.", 250, 12, 31, 9, 1],
    ["mcpollo", "McPollo (McChicken)", "1 unid.", 400, 14, 39, 21],
    ["mccrispy", "McCrispy", "1 unid.", 470, 26, 46, 20],
    ["filete", "Filete de pescado (Filet-O-Fish)", "1 unid.", 390, 16, 39, 19],
    ["nuggets4", "McNuggets 4 piezas", "4 piezas", 170, 9, 10, 10],
    ["nuggets6", "McNuggets 6 piezas", "6 piezas", 250, 14, 15, 15, 1],
    ["nuggets10", "McNuggets 10 piezas", "10 piezas", 410, 23, 25, 24],
    ["nuggets20", "McNuggets 20 piezas", "20 piezas", 830, 46, 51, 49],
    ["papaschicas", "Papas chicas", "Chica", 230, 3, 30, 11],
    ["papasmedianas", "Papas medianas", "Mediana", 320, 4, 43, 15],
    ["papasgrandes", "Papas grandes", "Grande", 480, 6, 65, 23],
    ["mcmuffin", "McMuffin con huevo", "1 unid.", 310, 17, 30, 13, 1],
    ["mcmuffinsalchicha", "McMuffin de salchicha con huevo", "1 unid.", 480, 20, 30, 31],
    ["hotcakes", "Hotcakes con mantequilla y miel", "3 piezas", 580, 9, 101, 15],
    ["hashbrown", "Hash brown (papa de desayuno)", "1 unid.", 140, 1, 16, 8],
    ["mcflurry", "McFlurry Oreo", "Regular", 510, 12, 80, 16],
    ["cono", "Cono de vainilla", "1 unid.", 200, 5, 33, 5],
    ["sundae", "Sundae de chocolate", "1 unid.", 330, 8, 53, 10],
    ["pay", "Pay de manzana", "1 unid.", 230, 2, 33, 11],
    ["malteada", "Malteada de chocolate mediana", "Mediana", 630, 14, 106, 17],
    ["coca", "Refresco de cola mediano", "Mediano", 200, 0, 55, 0],
    ["latte", "Latte McCafé mediano", "Mediano", 190, 11, 19, 7],
  ]),
  ...mk("bk", "aprox", [
    ["whopper", "Whopper", "1 unid.", 670, 31, 51, 40],
    ["whopperqueso", "Whopper con queso", "1 unid.", 770, 35, 52, 48],
    ["doblewhopper", "Whopper doble", "1 unid.", 920, 52, 51, 58],
    ["whopperjr", "Whopper Jr.", "1 unid.", 330, 18, 27, 16, 1],
    ["baconking", "Bacon King", "1 unid.", 1150, 61, 49, 79],
    ["queso", "Hamburguesa con queso", "1 unid.", 280, 13, 28, 13],
    ["doblequeso", "Doble hamburguesa con queso", "1 unid.", 390, 22, 27, 21],
    ["pollooriginal", "Sándwich de pollo original", "1 unid.", 680, 25, 54, 40],
    ["royalcrispy", "Royal Crispy Chicken", "1 unid.", 600, 30, 50, 33],
    ["chickenfries", "Chicken Fries 9 piezas", "9 piezas", 280, 15, 18, 17],
    ["nuggets8", "Nuggets 8 piezas", "8 piezas", 380, 18, 22, 24, 1],
    ["impossible", "Impossible Whopper", "1 unid.", 630, 25, 58, 34],
    ["papaschicas", "Papas chicas", "Chica", 320, 4, 43, 15],
    ["papasmedianas", "Papas medianas", "Mediana", 380, 5, 52, 17],
    ["papasgrandes", "Papas grandes", "Grande", 490, 6, 67, 22],
    ["aros", "Aros de cebolla medianos", "Mediano", 410, 5, 53, 20],
    ["pay", "Pay Hershey's", "1 rebanada", 310, 3, 32, 19],
    ["malteada", "Malteada de chocolate mediana", "Mediana", 700, 14, 115, 19],
    ["croissanwich", "Croissan'wich de salchicha, huevo y queso", "1 unid.", 500, 19, 25, 36],
  ]),
  ...mk("kfc", "aprox", [
    ["pechuga", "Pieza de pollo original: pechuga", "1 pieza", 390, 39, 11, 21],
    ["muslo", "Pieza de pollo original: muslo", "1 pieza", 280, 19, 8, 19],
    ["pierna", "Pieza de pollo original: pierna", "1 pieza", 130, 12, 4, 8],
    ["ala", "Pieza de pollo original: ala", "1 pieza", 130, 10, 3, 8],
    ["pechugacrispy", "Pechuga Extra Crispy", "1 pieza", 530, 35, 18, 35],
    ["muslocrispy", "Muslo Extra Crispy", "1 pieza", 330, 19, 9, 24],
    ["parrilla", "Pechuga a la parrilla (donde exista)", "1 pieza", 210, 38, 0, 7, 1],
    ["tiras3", "Tiras de pollo (tenders) 3 piezas", "3 piezas", 450, 39, 18, 24],
    ["sandwich", "Sándwich de pollo KFC", "1 unid.", 650, 34, 49, 35],
    ["famousbowl", "Famous Bowl (tazón de puré, pollo y maíz)", "1 tazón", 740, 26, 81, 34],
    ["potpie", "Pot pie de pollo", "1 unid.", 720, 21, 60, 41],
    ["popcorn", "Popcorn chicken individual", "Individual", 400, 21, 21, 26],
    ["nuggets8", "Nuggets 8 piezas", "8 piezas", 370, 24, 19, 21],
    ["papas", "Papas individuales", "Individual", 320, 4, 40, 16],
    ["pure", "Puré de papas con gravy", "Individual", 130, 3, 19, 5],
    ["ensaladacol", "Ensalada de col", "Individual", 170, 1, 14, 12],
    ["biscuit", "Biscuit", "1 unid.", 180, 4, 22, 9],
    ["macqueso", "Mac and cheese", "Individual", 140, 5, 15, 7],
    ["maiz", "Maíz dulce", "Individual", 70, 2, 16, 1, 1],
  ]),
  ...mk("popeyes", "aprox", [
    ["pechuga", "Pechuga clásica", "1 pieza", 380, 35, 16, 20],
    ["muslo", "Muslo clásico", "1 pieza", 280, 14, 9, 21],
    ["pierna", "Pierna clásica", "1 pieza", 160, 14, 5, 9],
    ["ala", "Ala clásica", "1 pieza", 210, 14, 7, 11],
    ["tenders3", "Tenders clásicos 3 piezas", "3 piezas", 440, 35, 21, 24],
    ["blackened", "Tenders blackened 3 piezas (sin empanizar)", "3 piezas", 170, 26, 2, 2, 1],
    ["sandwich", "Sándwich de pollo clásico", "1 unid.", 700, 28, 50, 42],
    ["papas", "Papas cajún regulares", "Regular", 260, 3, 33, 13],
    ["pure", "Puré con gravy cajún", "Regular", 110, 4, 18, 4],
    ["frijolesrojos", "Arroz con frijoles rojos", "Regular", 250, 7, 29, 13],
    ["biscuit", "Biscuit", "1 unid.", 260, 4, 26, 15],
    ["ensaladacol", "Ensalada de col", "Regular", 200, 1, 14, 15],
  ]),
  ...mk("campero", "aprox", [
    ["pechuga", "Pieza Campero original: pechuga", "1 pieza", 410, 36, 14, 23],
    ["muslo", "Pieza Campero original: muslo", "1 pieza", 300, 18, 9, 21],
    ["pierna", "Pieza Campero original: pierna", "1 pieza", 170, 13, 5, 11],
    ["ala", "Pieza Campero original: ala", "1 pieza", 200, 12, 7, 14],
    ["asado", "Pechuga de pollo asado", "1 pieza", 230, 40, 2, 7, 1],
    ["tiras3", "Tiras de pollo 3 piezas", "3 piezas", 360, 30, 18, 18],
    ["sandwich", "Sándwich de pollo crujiente", "1 unid.", 620, 30, 52, 32],
    ["papas", "Papas fritas", "Individual", 320, 4, 42, 15],
    ["frijoles", "Frijoles volteados", "Individual", 160, 9, 24, 3],
    ["ensalada", "Ensalada de repollo", "Individual", 170, 1, 14, 12],
    ["pure", "Puré de papas", "Individual", 120, 3, 18, 4],
    ["tortillas", "Tortillas", "2 unid.", 120, 3, 24, 1],
  ]),
  ...mk("tacobell", "aprox", [
    ["tacocrujiente", "Taco crujiente", "1 unid.", 170, 8, 13, 10],
    ["tacosuave", "Taco suave", "1 unid.", 180, 9, 18, 9],
    ["tacosupreme", "Taco Supreme crujiente", "1 unid.", 190, 8, 15, 11],
    ["doritos", "Doritos Locos Taco", "1 unid.", 170, 8, 13, 9],
    ["crunchwrap", "Crunchwrap Supreme", "1 unid.", 530, 16, 71, 21],
    ["burritosupreme", "Burrito Supreme de res", "1 unid.", 390, 16, 51, 14],
    ["burritofrijol", "Burrito de frijoles", "1 unid.", 350, 13, 55, 9],
    ["quesadilla", "Quesadilla de pollo", "1 unid.", 510, 27, 37, 27],
    ["chalupa", "Chalupa Supreme de res", "1 unid.", 350, 13, 30, 20],
    ["gordita", "Cheesy Gordita Crunch", "1 unid.", 500, 20, 41, 28],
    ["nachos", "Nachos BellGrande", "1 orden", 740, 16, 82, 38],
    ["mexicanpizza", "Mexican Pizza", "1 unid.", 540, 20, 46, 30],
    ["bowl", "Power Menu Bowl de pollo", "1 tazón", 460, 26, 40, 21, 1],
    ["papasnacho", "Papas nacho", "Regular", 320, 4, 35, 18],
    ["twists", "Cinnamon Twists", "1 orden", 170, 1, 26, 7],
  ]),
  ...mk("subway", "aprox", [
    ["pavo", "Sub de pavo 15 cm", "15 cm", 280, 18, 41, 5, 1],
    ["pollo", "Sub de pollo rostizado 15 cm", "15 cm", 310, 25, 40, 6, 1],
    ["teriyaki", "Sub de pollo teriyaki 15 cm", "15 cm", 330, 25, 52, 5],
    ["jamon", "Sub de jamón 15 cm", "15 cm", 270, 17, 43, 5],
    ["bmt", "Italian B.M.T. 15 cm", "15 cm", 400, 19, 42, 17],
    ["atun", "Sub de atún 15 cm", "15 cm", 470, 20, 41, 25],
    ["steak", "Steak & Cheese 15 cm", "15 cm", 340, 24, 41, 10],
    ["albondigas", "Albóndigas marinara 15 cm", "15 cm", 470, 21, 58, 18],
    ["baconranch", "Pollo, tocino y ranch 15 cm", "15 cm", 530, 35, 43, 24],
    ["veggie", "Veggie Delite 15 cm", "15 cm", 200, 9, 39, 2],
    ["bmt30", "Italian B.M.T. 30 cm", "30 cm", 800, 38, 84, 34],
    ["pollo30", "Sub de pollo rostizado 30 cm", "30 cm", 620, 50, 80, 12],
    ["galleta", "Galleta con chispas de chocolate", "1 unid.", 210, 2, 30, 10],
  ]),
  ...mk("wendys", "oficial", [
    ["davessingle", "Dave's Single", "1 unid.", 524, 28, 37, 29],
    ["davesdouble", "Dave's Double", "1 unid.", 879, 54, 39, 56],
    ["davestriple", "Dave's Triple", "1 unid.", 1195, 77, 41, 80],
    ["baconator", "Baconator", "1 unid.", 1001, 63, 38, 66],
    ["queso", "Hamburguesa con queso chica", "1 unid.", 317, 17, 30, 14],
    ["spicy", "Sándwich de pollo picante", "1 unid.", 400, 20, 45, 15],
    ["classic", "Sándwich de pollo clásico", "1 unid.", 404, 20, 46, 15],
    ["grilled", "Sándwich de pollo a la parrilla", "1 unid.", 337, 26, 35, 10, 1],
    ["nuggets4", "Nuggets 4 piezas", "4 piezas", 114, 11, 4.9, 5.6],
    ["nuggets6", "Nuggets 6 piezas", "6 piezas", 173, 17, 7.4, 8.4],
    ["nuggets10", "Nuggets 10 piezas", "10 piezas", 286, 28, 12, 14],
    ["papaschicas", "Papas chicas", "Chica", 142, 1.6, 18, 6.7],
    ["papasmedianas", "Papas medianas", "Mediana", 176, 2, 22, 8.5],
    ["papasgrandes", "Papas grandes", "Grande", 239, 2.7, 31, 11],
    ["papaasada", "Papa al horno sola", "1 unid.", 232, 4.4, 39, 5.4],
    ["chili", "Chili", "1 tazón", 253, 19, 14, 13, 1],
    ["frostyjr", "Frosty de chocolate chico", "Chico", 174, 5.2, 28, 4.6],
    ["frosty", "Frosty de chocolate regular", "Regular", 299, 8.9, 48, 7.9],
  ]),
  ...mk("carls", "oficial", [
    ["famousstar", "Famous Star con queso", "1 unid.", 680, 28, 57, 38],
    ["westernbacon", "Western Bacon Cheeseburger", "1 unid.", 770, 35, 77, 36],
    ["bigcarl", "Big Carl", "1 unid.", 670, 28, 55, 38],
    ["bigcarldoble", "Big Carl doble", "1 unid.", 920, 47, 56, 58],
    ["diablo", "El Diablo", "1 unid.", 940, 39, 78, 40],
    ["chickenclub", "Sándwich de pollo a la parrilla club", "1 unid.", 690, 43, 45, 38],
    ["bbqchicken", "Sándwich de pollo a la parrilla BBQ", "1 unid.", 440, 35, 48, 13, 1],
    ["tenders3", "Tenders de pollo 3 piezas", "3 piezas", 260, 25, 13, 13, 1],
    ["spicy", "Sándwich de pollo picante", "1 unid.", 490, 14, 43, 29],
    ["papaschicas", "Papas chicas", "Chica", 280, 3, 36, 14],
    ["papasmedianas", "Papas medianas", "Mediana", 400, 4, 51, 19],
    ["papasgrandes", "Papas grandes", "Grande", 450, 5, 59, 22],
    ["aros", "Aros de cebolla", "1 orden", 560, 9, 66, 30],
    ["breakfastburger", "Breakfast Burger", "1 unid.", 780, 40, 67, 40],
    ["malteada", "Malteada de chocolate", "1 unid.", 710, 13, 86, 36],
  ]),
  ...mk("dominos", "oficial", [
    ["quesom", "Pizza de queso mediana, masa clásica", "1 rebanada (1/8)", 190, 8, 24, 6.5],
    ["quesog", "Pizza de queso grande, masa clásica", "1 rebanada (1/8)", 270, 11, 34, 9],
    ["pepperonim", "Pizza de pepperoni mediana, masa clásica", "1 rebanada (1/8)", 220, 9, 24, 9],
    ["pepperonig", "Pizza de pepperoni grande, masa clásica", "1 rebanada (1/8)", 310, 13, 34, 12.5],
    ["delgada", "Pizza de queso mediana, masa delgada", "1 porción (1/4)", 265, 10, 25, 13, 1],
    ["sarten", "Pizza de queso mediana, masa sartén", "1 rebanada (1/8)", 295, 10, 28, 14],
    ["twists", "Pan twists de parmesano", "2 piezas", 230, 5, 27, 11],
    ["panqueso", "Pan relleno de queso", "1 pieza", 150, 6, 16, 7],
    ["alitas", "Alitas sin salsa", "4 piezas", 250, 14, 8, 20],
    ["alitasbuffalo", "Alitas Buffalo picantes", "4 piezas", 260, 15, 9, 20],
    ["boneless", "Boneless de pollo", "3 piezas", 170, 9, 18, 7],
    ["pasta", "Pasta Alfredo con pollo", "1 plato", 600, 25, 60, 29],
    ["lavacake", "Pastel de lava de chocolate", "1 unid.", 350, 4, 47, 17],
    ["philly", "Sándwich Philly cheese steak", "½ sándwich", 380, 20, 38, 15],
  ]),
  ...mk("dominos", "aprox", [
    ["extravaganzza", "ExtravaganZZa mediana", "1 porción (1/5)", 370, 15, 37, 17],
    ["meatzza", "MeatZZa mediana", "1 porción (1/5)", 420, 17, 38, 21],
    ["veggie", "Pacific Veggie mediana", "1 porción (1/5)", 380, 17, 40, 17],
  ]),
  ...mk("pizzahut", "aprox", [
    ["panqueso", "Pan Pizza de queso mediana", "1 rebanada", 250, 12, 26, 10],
    ["panpepperoni", "Pan Pizza de pepperoni mediana", "1 rebanada", 260, 13, 25, 10],
    ["clasicaqueso", "Pizza de queso grande, masa clásica", "1 rebanada", 290, 13, 34, 11],
    ["clasicapepperoni", "Pizza de pepperoni grande, masa clásica", "1 rebanada", 310, 14, 33, 13],
    ["thin", "Thin 'N Crispy de pepperoni mediana", "1 rebanada", 200, 10, 19, 9, 1],
    ["supreme", "Supreme mediana", "1 rebanada", 280, 14, 27, 14],
    ["meatlovers", "Meat Lover's mediana", "1 rebanada", 330, 19, 26, 14],
    ["veggie", "Veggie Lover's mediana", "1 rebanada", 220, 9, 27, 9],
    ["palito", "Palito de pan (breadstick)", "1 unid.", 140, 5, 19, 4],
    ["alitas", "Alitas tradicionales sin salsa", "4 piezas", 320, 20, 0, 28],
    ["canela", "Palitos de canela", "2 piezas", 160, 5, 26, 3],
  ]),
  ...mk("littlecaesars", "oficial", [
    ["clasicaqueso", "Pizza clásica de queso", "1 rebanada (1/8 grande)", 244, 11.9, 31, 8.1, 1],
    ["clasicapepperoni", "Pizza clásica de pepperoni", "1 rebanada (1/8 grande)", 288, 13.6, 31.3, 12.1],
    ["extramost", "ExtraMostBestest pepperoni", "1 rebanada (1/8 grande)", 313, 15.3, 31.5, 14.1],
    ["3carnes", "3 Meat Treat", "1 rebanada (1/8 grande)", 358, 16.9, 31.5, 18.4],
    ["supreme", "Ultimate Supreme", "1 rebanada (1/8 grande)", 313, 14.8, 32.4, 14],
    ["detroitqueso", "Deep Dish estilo Detroit de queso", "1 cuadro (1/8)", 313, 14.8, 39.6, 10.6],
    ["detroitpepperoni", "Deep Dish estilo Detroit de pepperoni", "1 cuadro (1/8)", 346, 16.1, 39.9, 13.9],
  ]),
  ...mk("littlecaesars", "aprox", [
    ["crazybread", "Crazy Bread", "1 palito", 100, 3, 16, 2.8],
    ["alitas", "Caesar Wings asadas", "8 piezas", 510, 47, 2, 35],
  ]),
  ...mk("papajohns", "oficial", [
    ["quesog", "Pizza de queso grande, masa original", "1 rebanada (1/8)", 290, 11, 38, 10],
    ["pepperonig", "Pizza de pepperoni grande, masa original", "1 rebanada (1/8)", 320, 12, 38, 13],
    ["works", "The Works grande", "1 rebanada (1/8)", 340, 13, 39, 14],
    ["garden", "Garden Fresh grande", "1 rebanada (1/8)", 280, 10, 39, 9],
    ["meats", "The Meats grande", "1 rebanada (1/8)", 380, 15, 38, 17],
    ["quesom", "Pizza de queso mediana, masa original", "1 rebanada (1/8)", 210, 8, 27, 7],
    ["pepperonim", "Pizza de pepperoni mediana, masa original", "1 rebanada (1/8)", 230, 8, 26, 9],
    ["delgada", "Pizza de queso, masa delgada", "1 rebanada (1/8)", 210, 8, 20, 11, 1],
  ]),
  ...mk("papajohns", "aprox", [
    ["palito", "Palito de pan (breadstick)", "1 unid.", 140, 4, 26, 2],
    ["ajo", "Salsa de ajo", "1 vasito", 150, 0, 0, 17],
  ]),
  ...mk("starbucks", "aprox", [
    ["latte", "Caffè latte grande", "Grande (473 ml)", 190, 13, 19, 7],
    ["cappuccino", "Cappuccino grande", "Grande (473 ml)", 140, 9, 14, 5],
    ["americano", "Americano grande", "Grande (473 ml)", 15, 1, 2, 0, 1],
    ["macchiato", "Caramel macchiato grande", "Grande (473 ml)", 250, 10, 35, 7],
    ["mocha", "Mocha grande con crema batida", "Grande (473 ml)", 370, 14, 43, 15],
    ["chai", "Chai tea latte grande", "Grande (473 ml)", 240, 8, 45, 4.5],
    ["frapcafe", "Frappuccino de café grande", "Grande (473 ml)", 230, 3, 46, 3],
    ["frapmocha", "Frappuccino mocha grande con crema", "Grande (473 ml)", 370, 5, 54, 15],
    ["frapcaramel", "Frappuccino de caramelo grande con crema", "Grande (473 ml)", 380, 4, 57, 16],
    ["croissant", "Croissant de mantequilla", "1 unid.", 260, 5, 28, 14],
    ["muffin", "Muffin de arándanos", "1 unid.", 360, 5, 52, 15],
    ["sandwichhuevo", "Sándwich de salchicha, huevo y cheddar", "1 unid.", 480, 15, 34, 29],
    ["eggbites", "Egg bites de tocino y gruyère", "2 piezas", 300, 19, 9, 20, 1],
    ["wrap", "Wrap de espinaca, claras y feta", "1 unid.", 290, 20, 34, 8, 1],
    ["cakepop", "Cake pop", "1 unid.", 160, 1, 20, 8],
  ]),
  ...mk("dunkin", "aprox", [
    ["glaseada", "Dona glaseada", "1 unid.", 240, 4, 33, 11],
    ["boston", "Dona Boston Kreme", "1 unid.", 300, 4, 39, 15],
    ["chocolate", "Dona con cobertura de chocolate", "1 unid.", 280, 3, 35, 14],
    ["mermelada", "Dona rellena de mermelada", "1 unid.", 250, 4, 34, 11],
    ["munchkins", "Munchkins glaseados", "5 piezas", 250, 3, 32, 12],
    ["bagel", "Bagel simple", "1 unid.", 300, 11, 61, 2],
    ["bagelqueso", "Bagel con queso crema", "1 unid.", 480, 13, 64, 19],
    ["croissanthuevo", "Croissant de salchicha, huevo y queso", "1 unid.", 700, 22, 41, 50],
    ["wakeup", "Wake-Up Wrap de tocino, huevo y queso", "1 unid.", 210, 10, 14, 13, 1],
    ["hashbrowns", "Hash browns", "6 piezas", 130, 1, 16, 7],
    ["cafecaliente", "Café mediano con leche y azúcar", "Mediano", 180, 2, 25, 8],
    ["cafehelado", "Café helado mediano con leche y azúcar", "Mediano", 190, 2, 33, 6],
    ["lattehelado", "Latte helado mediano", "Mediano", 170, 9, 14, 9],
    ["frozen", "Frozen coffee mediano", "Mediano", 600, 8, 98, 20],
    ["muffin", "Muffin de arándanos", "1 unid.", 460, 6, 68, 18],
  ]),
];

/** Combos: se calculan con la suma de sus partes para que cuadren con las piezas sueltas. */
const COMBOS: [cadena: ChainId, id: string, n: string, parts: string[]][] = [
  ["mcd", "combobigmac", "Combo Big Mac (papas y refresco medianos)", ["bigmac", "papasmedianas", "coca"]],
  ["mcd", "combocuarto", "Combo Cuarto de Libra (papas y refresco medianos)", ["cuarto", "papasmedianas", "coca"]],
  ["mcd", "combonuggets10", "Combo McNuggets 10 (papas y refresco medianos)", ["nuggets10", "papasmedianas", "coca"]],
  ["mcd", "combomcpollo", "Combo McPollo (papas y refresco medianos)", ["mcpollo", "papasmedianas", "coca"]],
  ["bk", "combowhopper", "Combo Whopper (papas medianas y refresco)", ["whopper", "papasmedianas", "@refresco"]],
  ["bk", "combowhopperqueso", "Combo Whopper con queso (papas medianas y refresco)", ["whopperqueso", "papasmedianas", "@refresco"]],
  ["kfc", "combo2", "Combo 2 piezas (pechuga y pierna, papas y refresco)", ["pechuga", "pierna", "papas", "@refresco"]],
  ["kfc", "combo3", "Combo 3 piezas (pechuga, muslo, pierna, papas, biscuit y refresco)", ["pechuga", "muslo", "pierna", "papas", "biscuit", "@refresco"]],
  ["popeyes", "combo2", "Combo 2 piezas (pechuga y pierna, papas y refresco)", ["pechuga", "pierna", "papas", "@refresco"]],
  ["campero", "combo2", "Combo 2 piezas (pechuga y muslo, papas y refresco)", ["pechuga", "muslo", "papas", "@refresco"]],
  ["campero", "combo3", "Combo 3 piezas con papas, frijoles y refresco", ["pechuga", "muslo", "pierna", "papas", "frijoles", "@refresco"]],
  ["wendys", "combodaves", "Combo Dave's Single (papas medianas y refresco)", ["davessingle", "papasmedianas", "@refresco"]],
  ["carls", "combofamous", "Combo Famous Star (papas medianas y refresco)", ["famousstar", "papasmedianas", "@refresco"]],
  ["tacobell", "combocrunchwrap", "Combo Crunchwrap Supreme (taco crujiente y refresco)", ["crunchwrap", "tacocrujiente", "@refresco"]],
  ["subway", "combopollo", "Combo sub de pollo 15 cm (galleta y refresco)", ["pollo", "galleta", "@refresco"]],
];
/** Refresco mediano estándar de las cadenas (aprox. 600 ml). */
const SODA = { k: 200, pr: 0, c: 55, f: 0 };

const r1 = (n: number) => Math.round(n * 10) / 10;
function buildCombos(): ChainFood[] {
  const byId = new Map(BASE.map((x) => [x.id, x]));
  return COMBOS.map(([cadena, id, n, parts]) => {
    const tot = { k: 0, pr: 0, c: 0, f: 0 };
    for (const p of parts) {
      const it = p === "@refresco" ? SODA : byId.get(`${cadena}-${p}`);
      if (!it) throw new Error(`Combo ${cadena}-${id}: falta ${p}`);
      tot.k += it.k; tot.pr += it.pr; tot.c += it.c; tot.f += it.f;
    }
    return { id: `${cadena}-${id}`, cadena, n, p: "1 combo", k: Math.round(tot.k), pr: r1(tot.pr), c: r1(tot.c), f: r1(tot.f), src: "aprox" as const };
  });
}

export const CHAIN_FOODS: ChainFood[] = [...BASE, ...buildCombos()];
export const CHAIN_FOOD_BY_ID = Object.fromEntries(CHAIN_FOODS.map((f) => [f.id, f])) as Record<string, ChainFood>;

/** Cadenas en orden para el país: primero las especialmente comunes ahí, luego el resto en su orden. */
export function chainsForCountry(country?: string | null): Chain[] {
  const cc = country?.toUpperCase();
  const rank = (c: Chain) => (cc && c.cc?.includes(cc) ? 0 : c.cc ? 2 : 1);
  return CHAINS.map((c, i) => [c, i] as const).sort(([a, i], [b, j]) => rank(a) - rank(b) || i - j).map(([c]) => c);
}

/**
 * Sugerencia amable de la misma cadena: la opción marcada `best` con menos kcal que lo elegido
 * (si lo elegido ya es de las ligeras, no sugiere nada).
 */
export function betterChoice(item: { id: string; cadena?: string; k: number; best?: boolean }): ChainFood | null {
  if (!item.cadena || item.best) return null;
  const opts = CHAIN_FOODS.filter((x) => x.cadena === item.cadena && x.best && x.id !== item.id && x.k < item.k * 0.8);
  if (!opts.length) return null;
  // La de más proteína por caloría.
  return opts.sort((a, b) => b.pr / Math.max(1, b.k) - a.pr / Math.max(1, a.k))[0];
}
