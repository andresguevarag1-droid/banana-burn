// Antojos y comida "real": lo que se come fuera del plan. Macros aproximados por porción típica
// (referencias tipo USDA y recetas comunes); la porción se ajusta al agregar.
import type { Food } from "@/lib/foods";

type Row = [id: string, n: string, p: string, k: number, pr: number, c: number, f: number, cc?: string[]];
const g = (rows: Row[]): Food[] => rows.map(([id, n, p, k, pr, c, f, cc]) => ({ id, n, p, k, pr, c, f, g: "rapida", ...(cc ? { cc } : {}) }));

export const ANTOJOS: Food[] = g([
  // Comida de la calle y de casa
  ["a-pizzarebanada", "Pizza de pizzería", "1 rebanada grande", 300, 12, 36, 12],
  ["a-hamburguesacasera", "Hamburguesa casera con queso", "1 unid.", 600, 32, 40, 34],
  ["a-hotdog", "Hot dog (perro caliente)", "1 unid.", 300, 11, 24, 18],
  ["a-tacoscalle", "Tacos de la calle (pastor o asada)", "3 unid.", 450, 24, 42, 20, ["MX", "GT", "SV", "HN"]],
  ["a-quesadilla", "Quesadillas con queso", "2 unid.", 480, 22, 36, 26, ["MX"]],
  ["a-empanadafrita", "Empanada frita", "1 unid.", 300, 9, 28, 17],
  ["a-salchipapa", "Salchipapa", "1 porción", 750, 20, 70, 44, ["PE", "CO", "EC", "BO"]],
  ["a-papascaseras", "Papas fritas caseras", "1 plato", 400, 5, 50, 20],
  ["a-burritogrande", "Burrito grande (carne, arroz, frijoles y queso)", "1 unid.", 900, 40, 100, 35],
  ["a-nachos", "Nachos con queso", "1 plato", 650, 18, 60, 38],
  ["a-alitas", "Alitas con salsa", "6 piezas", 540, 40, 6, 38],
  ["a-choripan", "Choripán", "1 unid.", 550, 22, 40, 33, ["AR", "UY", "CL"]],
  ["a-completo", "Completo (hot dog con palta y tomate)", "1 unid.", 550, 15, 45, 34, ["CL"]],
  ["a-pupusarevuelta", "Pupusas revueltas", "2 unid.", 560, 22, 60, 26, ["SV"]],
  ["a-chicharron", "Chicharrón de cerdo", "1 porción (80 g)", 430, 26, 0, 36],
  ["a-arrozchino", "Arroz frito estilo chino", "1 plato", 650, 24, 85, 22],
  ["a-sushi", "Sushi roll", "8 piezas", 400, 14, 58, 11],
  ["a-sushitempura", "Sushi roll empanizado (tempura)", "8 piezas", 520, 16, 62, 22],
  ["a-hotcakes", "Hot cakes con miel y mantequilla", "3 unid.", 520, 10, 90, 14],
  ["a-papasbolsa", "Papas de bolsa", "1 bolsa (45 g)", 240, 3, 23, 15],
  ["a-palomitas", "Palomitas de cine", "Mediana", 600, 10, 60, 36],
  // Bebidas
  ["a-refrescogrande", "Refresco", "1 botella (600 ml)", 250, 0, 65, 0],
  ["a-refrescolata", "Refresco", "1 lata (355 ml)", 150, 0, 39, 0],
  ["a-energetica", "Bebida energética", "1 lata (250 ml)", 110, 0, 28, 0],
  ["a-jugocaja", "Jugo de caja o néctar", "1 vaso", 120, 0, 29, 0],
  ["a-cervezabotella", "Cerveza", "1 botella (355 ml)", 150, 1, 13, 0],
  ["a-cervezaartesanal", "Cerveza artesanal (IPA)", "1 vaso (355 ml)", 210, 2, 18, 0],
  ["a-michelada", "Michelada", "1 vaso", 180, 1, 18, 0, ["MX"]],
  ["a-vino", "Vino", "1 copa (150 ml)", 125, 0, 4, 0],
  ["a-tragorefresco", "Trago con refresco (ron, whisky o vodka)", "1 vaso", 220, 0, 25, 0],
  ["a-coctel", "Cóctel dulce (margarita, piña colada)", "1 copa", 300, 0, 35, 6],
  // Postres y pan dulce
  ["a-pastelchocolate", "Pastel de chocolate", "1 rebanada", 450, 5, 55, 24],
  ["a-tresleches", "Tres leches", "1 rebanada", 400, 8, 55, 16],
  ["a-flan", "Flan", "1 porción", 260, 7, 40, 8],
  ["a-brownie", "Brownie", "1 unid.", 250, 3, 32, 13],
  ["a-churros", "Churros", "3 unid.", 330, 4, 40, 17],
  ["a-galletasgrandes", "Galletas con chispas de chocolate", "2 grandes", 400, 4, 52, 20],
  ["a-dona", "Dona glaseada", "1 unid.", 250, 4, 33, 12],
  ["a-arrozleche", "Arroz con leche", "1 taza", 280, 7, 48, 6],
  ["a-helado2", "Helado", "2 bolas", 290, 5, 34, 15],
  ["a-paleta", "Paleta de hielo de fruta", "1 unid.", 70, 0, 18, 0],
  ["a-alfajor", "Alfajor", "1 unid.", 250, 3, 36, 10, ["AR", "UY", "CL", "PE"]],
  ["a-panduce", "Pan dulce (concha, cuerno o similar)", "1 pieza", 300, 6, 46, 10],
  ["a-pastelito", "Pastelito o empanada dulce", "1 unid.", 280, 4, 36, 13],
  ["a-panmantequilla", "Pan con mantequilla", "2 rebanadas", 260, 6, 30, 13],
]);

/** "Comida libre": cuando no sabes qué comiste exactamente, eliges el tamaño y listo. */
export const LIBRE: (Food & { size: "chica" | "mediana" | "grande" })[] = [
  { id: "libre-chica", n: "Comida libre chica", p: "Plato o antojo chico", k: 400, pr: 18, c: 45, f: 16, g: "rapida", size: "chica" },
  { id: "libre-mediana", n: "Comida libre mediana", p: "Plato normal o combo chico", k: 700, pr: 30, c: 80, f: 28, g: "rapida", size: "mediana" },
  { id: "libre-grande", n: "Comida libre grande", p: "Plato grande, combo o buffet", k: 1000, pr: 40, c: 110, f: 45, g: "rapida", size: "grande" },
];
