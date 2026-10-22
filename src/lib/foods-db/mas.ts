// Más variantes comunes (cortes, preparaciones y productos) que la gente registra a diario.
// Ingredientes por 100 g (USDA); platos y productos armados por porción (aproximados).
import { per100, perPortion, type Combo } from "./make";

export const MAS: ReturnType<typeof per100> = [
  ...per100("carnes", [
    ["cp-pechugahorno", "Pechuga de pollo al horno", "150 g", 150, 165, 31, 0, 3.6, 0, 0],
    ["cp-pechugafrita", "Pechuga de pollo frita sin empanizar", "150 g", 150, 187, 33.4, 0.4, 4.7, 0, 0],
    ["cp-pollomolido", "Pollo molido cocido", "100 g", 100, 189, 23.3, 0, 10.2, 0, 0],
    ["cp-higado", "Hígado de pollo", "100 g", 100, 167, 24.5, 0.9, 6.5, 0, 0],
    ["cp-mollejas", "Mollejas de pollo", "100 g", 100, 154, 30.4, 0, 2.7, 0, 0],
    ["cr-bistecmagro", "Bistec de res magro", "150 g", 150, 180, 30, 0, 6, 0, 0, { al: "pulpa bola peceto nalga cuete" }],
    ["cr-sirloin", "Sirloin o solomo", "200 g", 200, 206, 29.9, 0, 9, 0, 0, { al: "punta de solomo lomo alto" }],
    ["cr-tbone", "T-bone", "300 g", 300, 247, 24.5, 0, 16, 0, 0],
    ["cr-vacio", "Vacío o sobrebarriga", "200 g", 200, 270, 25, 0, 19, 0, 0, { cc: ["AR", "UY", "CO"] }],
    ["cr-osobuco", "Osobuco", "200 g", 200, 200, 32, 0, 7.5, 0, 0],
    ["cr-rabo", "Rabo de res", "200 g", 200, 262, 30.9, 0, 14.1, 0, 0, { al: "cola de res" }],
    ["cc-canadiense", "Lomo de cerdo ahumado (tocino canadiense)", "50 g", 50, 146, 24, 1.8, 4.9, 0, 1],
    ["cc-panceta", "Panceta de cerdo asada", "100 g", 100, 518, 9.3, 0, 53, 0, 0, { al: "pork belly tocineta" }],
  ]),
  ...per100("mar", [
    ["mp-tilapia", "Tilapia a la plancha", "150 g", 150, 128, 26, 0, 2.7, 0, 0],
    ["mp-corvina", "Corvina", "150 g", 150, 120, 24, 0, 2.5, 0, 0],
    ["mp-mero", "Mero", "150 g", 150, 118, 24.8, 0, 1.3, 0, 0, { al: "cherna" }],
    ["mp-salmonlata", "Salmón en lata", "100 g", 100, 136, 23, 0, 4.9, 0, 0],
    ["mp-camaronplancha", "Camarones a la plancha", "150 g", 150, 99, 24, 0.2, 0.3, 0, 0, { al: "gambas langostinos" }],
    ["mp-vieiras", "Vieiras o callo de hacha", "100 g", 100, 111, 20.5, 5.4, 0.8, 0, 0, { al: "conchas ostiones" }],
    ["mp-ostras", "Ostras", "6 unid. (84 g)", 84, 68, 7, 3.9, 2.5, 0, 0, { al: "ostiones" }],
  ]),
  ...per100("lacteos", [
    ["ly-griegolight", "Yogur griego light de sabor", "1 envase (150 g)", 150, 67, 10, 7, 0, 0, 4.7, { al: "yogurt oikos triple cero" }],
    ["lq-rallado", "Queso rallado mixto para pizza", "¼ taza (28 g)", 28, 350, 23, 3, 27, 0, 1],
    ["lq-tiras", "Queso en tiras (snack)", "1 unid. (28 g)", 28, 254, 24.3, 2.8, 15.9, 0, 1, { al: "string cheese" }],
    ["lq-cremadelechelight", "Crema de leche light", "2 cdas (30 g)", 30, 195, 2.7, 4.3, 19.3, 0, 4],
    ["ll-cabra", "Leche de cabra", "1 vaso (250 ml)", 250, 69, 3.6, 4.5, 4.1, 0, 4.5],
  ]),
  ...per100("verduras", [
    ["vd-ensaladamixta", "Ensalada de lechuga, tomate y pepino", "1 plato (200 g)", 200, 16, 0.9, 3.2, 0.2, 1.1, 1.8],
    ["vd-rucula", "Rúcula", "1 taza (20 g)", 20, 25, 2.6, 3.7, 0.7, 1.6, 2, { al: "arugula" }],
    ["vd-repollomorado", "Repollo morado", "1 taza (89 g)", 89, 31, 1.4, 7.4, 0.2, 2.1, 3.8],
    ["vd-jalapeno", "Chile jalapeño", "1 unid. (14 g)", 14, 29, 0.9, 6.5, 0.4, 2.8, 4.1, { al: "aji picante chile verde" }],
    ["vd-alcachofa", "Alcachofa cocida", "1 unid. (120 g)", 120, 51, 2.9, 11.4, 0.3, 8.6, 1],
    ["vd-pepinillos", "Pepinillos encurtidos", "1 unid. (35 g)", 35, 12, 0.3, 2.3, 0.2, 1, 1.1, { al: "encurtidos pickles" }],
    ["vd-aceitunas", "Aceitunas", "10 unid. (40 g)", 40, 145, 1, 3.8, 15.3, 3.3, 0, { al: "olivas" }],
    ["vd-curtido", "Curtido de repollo", "½ taza (70 g)", 70, 25, 1, 5, 0.1, 2, 2.5, { cc: ["SV"] }],
    ["vd-elotebaby", "Elotitos baby", "½ taza (60 g)", 60, 26, 1.6, 5, 0.3, 1.5, 2, { al: "choclitos mini" }],
    ["vd-cebollin", "Cebollín", "2 cdas (12 g)", 12, 32, 1.8, 7.3, 0.2, 2.6, 2.3, { al: "cebolla larga cebolla de verdeo cebolleta" }],
  ]),
  ...per100("frutas", [
    ["fr-granada", "Granada", "½ taza (87 g)", 87, 83, 1.7, 18.7, 1.2, 4, 13.7],
    ["fr-pinaalmibar", "Piña en almíbar", "½ taza (126 g)", 126, 60, 0.4, 15.7, 0.1, 0.8, 15, { al: "conserva" }],
    ["fr-duraznoalmibar", "Duraznos en almíbar", "½ taza (128 g)", 128, 74, 0.5, 20, 0.1, 1.3, 19, { al: "melocoton conserva" }],
    ["fr-manzanaverde", "Manzana verde", "1 unid. (182 g)", 182, 58, 0.4, 13.6, 0.2, 2.8, 9.6],
  ]),
  ...per100("bebidas", [
    ["bb-atole", "Atole", "1 taza (250 ml)", 250, 70, 2, 12, 1.5, 0.3, 8, { cc: ["MX", "GT", "SV", "HN"], al: "colada" }],
    ["bb-champurrado", "Champurrado", "1 taza (250 ml)", 250, 90, 2.5, 15, 2.5, 1, 9, { cc: ["MX"] }],
    ["bb-avenabebida", "Bebida de avena casera", "1 vaso (250 ml)", 250, 65, 2, 12, 1, 0.8, 7, { al: "avena colada fresco de avena quaker" }],
    ["bb-morir", "Morir soñando", "1 vaso (300 ml)", 300, 75, 2, 13, 1.8, 0.2, 12, { cc: ["DO"] }],
    ["bb-tomate", "Jugo de tomate", "1 vaso (250 ml)", 250, 17, 0.9, 3.5, 0.3, 0.4, 2.6],
    ["bb-tamarindo", "Agua de tamarindo", "1 vaso (250 ml)", 250, 45, 0, 11, 0, 0.2, 10, { cc: ["MX"], al: "agua fresca" }],
  ]),
  ...per100("dulces", [
    ["dl-chocolateblanco", "Chocolate blanco", "20 g", 20, 539, 5.9, 59.2, 32.1, 0.2, 59],
    ["dl-cono", "Cono de helado", "1 unid. (120 g)", 120, 220, 3.5, 28, 11, 0.7, 20, { al: "barquilla helado de cono" }],
    ["dl-donarellena", "Dona rellena", "1 unid. (85 g)", 85, 340, 5.9, 39, 18.7, 1, 18, { al: "dona de crema berlina" }],
    ["dl-galletasarroz", "Galletas de arroz inflado", "2 unid. (18 g)", 18, 387, 8.2, 81.5, 2.8, 4.2, 0.9, { al: "tortitas de arroz" }],
    ["dl-manichocolate", "Maní con chocolate", "30 g", 30, 519, 13, 49.7, 33.5, 4.7, 41],
  ]),
  ...per100("granos", [
    ["gr-fideoshuevo", "Fideos de huevo cocidos", "1 taza (160 g)", 160, 138, 4.5, 25, 2.1, 1.2, 0.4],
    ["gr-papashorno", "Papas fritas al horno", "100 g", 100, 160, 2.5, 26, 5, 2.5, 0.3, { al: "papas congeladas" }],
    ["gr-papasaire", "Papas en freidora de aire", "150 g", 150, 130, 2.5, 24, 3, 2.3, 0.8, { al: "air fryer" }],
    ["gr-amaranto", "Amaranto inflado", "¼ taza (15 g)", 15, 374, 13.6, 66, 7, 7, 1.7, { al: "alegria" }],
  ]),
  ...perPortion("platos", [
    ["pt-sopafideos", "Sopa de fideos", "1 plato", 350, 220, 7, 30, 7, 2, 4, { al: "sopa de pasta" }],
    ["pt-arrozcoco", "Arroz con coco", "1 taza", 200, 350, 5, 55, 12, 2, 8, { cc: ["CO", "PA", "HN"] }],
    ["pt-arrozhuevo", "Arroz con huevo frito", "1 plato", 250, 400, 12, 52, 15, 1, 0],
    ["pt-paella", "Paella", "1 plato", 400, 600, 30, 70, 20, 3, 3],
    ["pt-carneasadaplato", "Carne asada con frijoles y tortillas", "1 plato", 450, 750, 50, 55, 35, 10, 3, { cc: ["MX"] }],
    ["pt-tostonesqueso", "Tostones con queso frito", "1 plato", 250, 560, 18, 50, 32, 4, 3, { cc: ["DO", "PR"] }],
  ]),
  ...perPortion("rapida", [
    ["rp-pizzacuatroquesos", "Pizza cuatro quesos", "1 rebanada grande", 115, 330, 15, 33, 15, 2, 3],
    ["rp-burritoasada", "Burrito de carne asada", "1 unid.", 350, 750, 40, 75, 30, 9, 4],
    ["rp-california", "Sushi California roll", "8 piezas", 220, 260, 9, 38, 7, 3, 7, { al: "sushi roll" }],
    ["rp-tacoamericano", "Taco crujiente estilo americano", "1 unid.", 80, 170, 8, 13, 10, 3, 1],
    ["rp-alitassinsalsa", "Alitas fritas sin salsa", "6 unid.", 180, 520, 45, 0, 37, 0, 0],
  ]),
];

/** Más desayunos armados con ingredientes de la base. */
export const MAS_COMBOS: Combo[] = [
  ["ds-avenaproteina", "Avena con proteína y banana", "1 tazón", [["avena", 50], ["whey", 32], ["banano", 60]], { al: "avena proteica whey" }],
  ["ds-sandhuevo", "Sándwich de huevo y queso", "1 unid.", [["pn-molde", 50], ["hv-frito", 46], ["lq-americano", 21]]],
  ["ds-tostadacottage", "Tostada con queso cottage y tomate", "2 rebanadas", [["pan", 52], ["lq-cottagelight", 113], ["vd-tomate", 60]]],
  ["ds-wrapclaras", "Wrap de claras con espinaca", "1 unid.", [["pn-tortillaintegral", 45], ["hv-clara", 132], ["vd-espinaca", 30], ["lq-mozzalight", 20]]],
  ["ds-batidowhey", "Batido de proteína con leche descremada", "1 vaso", [["whey", 32], ["leche", 250]], { al: "shake whey" }],
  ["ds-bagelvegano", "Bagel con queso crema vegano y aguacate", "1 unid.", [["pn-bagelintegral", 105], ["vg-quesocrema", 30], ["aguacate", 40]], { al: "bagel vegetal palta" }],
  ["ds-tofurevuelto", "Tofu revuelto con vegetales", "1 plato", [["vg-tofufirme", 150], ["vd-pimiento", 30], ["vd-cebolla", 20], ["vd-espinaca", 30], ["sa-oliva", 5]], { al: "vegano huevo vegetal" }],
];
