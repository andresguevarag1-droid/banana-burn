// Desayunos. Los armados se calculan con los ingredientes de la base (gramos de cada uno), así cuadran
// con lo que verías si los registras por separado. Los demás van por porción (aproximados).
import { per100, perPortion, type Combo } from "./make";

/** Bases de desayuno por 100 g (USDA, preparados en casa). */
export const DESAYUNO_BASES = per100("desayunos", [
  ["ds-pancakes", "Pancakes solos", "3 unid. (114 g)", 114, 227, 6.4, 28.3, 9.7, 0.9, 5, { al: "hotcakes panqueques panquecas tortitas" }],
  ["ds-waffles", "Waffles", "2 unid. (150 g)", 150, 291, 7.9, 32.9, 14.1, 1, 6, { al: "wafles gofres" }],
  ["ds-tostadasfrancesas", "Tostadas francesas", "2 rebanadas (130 g)", 130, 229, 7.7, 25, 10.8, 1, 5, { al: "pan frances french toast torrejas" }],
]);

export const DESAYUNO_PORCION = perPortion("desayunos", [
  ["ds-cachito", "Cachito de jamón", "1 unid.", 90, 310, 11, 35, 14, 1, 5, { cc: ["VE"] }],
  ["ds-acai", "Bowl de açaí", "1 bowl", 350, 470, 7, 75, 16, 10, 45, { al: "acai" }],
  ["ds-benedictinos", "Huevos benedictinos", "2 unid.", 300, 640, 31, 30, 44, 2, 3],
  ["ds-crepadesayuno", "Crepa de huevo y queso", "1 unid.", 180, 380, 20, 25, 22, 1, 3],
]);

/** Desayunos armados: [id, nombre, porción, [[ingrediente, gramos]...], extras]. */
export const DESAYUNO_COMBOS: Combo[] = [
  ["ds-bagelhuevocremavegana", "Bagel de huevo con queso crema y salchicha vegana", "1 unid.", [["pn-bagelhuevo", 105], ["lq-crema", 30], ["vg-salchicha", 75]], { al: "bagel huevo queso crema salchicha vegetal" }],
  ["ds-bagelcrema", "Bagel con queso crema", "1 unid.", [["pn-bagel", 105], ["lq-crema", 30]], { al: "philadelphia" }],
  ["ds-bagelhuevocrema", "Bagel con huevo y queso crema", "1 unid.", [["pn-bagel", 105], ["hv-revueltomedio", 60], ["lq-crema", 30]], { al: "philadelphia" }],
  ["ds-bageltocino", "Bagel con huevo, tocino y queso", "1 unid.", [["pn-bagel", 105], ["hv-frito", 46], ["ce-tocino", 16], ["lq-americano", 21]]],
  ["ds-bagelsalmon", "Bagel con salmón ahumado y queso crema", "1 unid.", [["pn-bagel", 105], ["mp-salmonahumado", 50], ["lq-crema", 30]]],
  ["ds-sandjamon", "Sándwich de desayuno de huevo, jamón y queso", "1 unid.", [["pn-englishmuffin", 57], ["hv-frito", 46], ["ce-jamoncerdo", 28], ["lq-americano", 21]], { al: "mcmuffin" }],
  ["ds-sandsalchicha", "Sándwich de desayuno de huevo, salchicha y queso", "1 unid.", [["pn-englishmuffin", 57], ["hv-frito", 46], ["ce-salchicha", 45], ["lq-americano", 21]]],
  ["ds-sandvegano", "Sándwich de desayuno vegano", "1 unid.", [["pn-englishmuffin", 57], ["vg-salchicha", 75], ["vg-quesovegano", 20], ["vd-tomate", 30]]],
  ["ds-croissantjamon", "Croissant con jamón y queso", "1 unid.", [["pn-croissant", 57], ["ce-jamoncerdo", 30], ["lq-suizo", 21]]],
  ["ds-sandjamonqueso", "Sándwich de jamón y queso", "1 unid.", [["pn-molde", 50], ["ce-jamoncerdo", 45], ["lq-americano", 21]], { al: "sanduche mixto" }],
  ["ds-tostadaaguacate", "Tostada de aguacate", "2 rebanadas", [["pn-multigrano", 52], ["aguacate", 75]], { al: "avocado toast palta" }],
  ["ds-tostadaaguacatehuevo", "Tostada de aguacate con huevo", "2 rebanadas", [["pn-multigrano", 52], ["aguacate", 75], ["hv-pochado", 50]], { al: "avocado toast palta" }],
  ["ds-marraquetapalta", "Marraqueta con palta", "1 unid.", [["pn-marraqueta", 100], ["aguacate", 75]], { cc: ["CL"] }],
  ["ds-pancakesmiel", "Pancakes con jarabe", "3 unid.", [["ds-pancakes", 114], ["sa-jarabe", 40]], { al: "hotcakes maple" }],
  ["ds-pancakesavena", "Pancakes de avena y banana", "2 unid.", [["avena", 40], ["banano", 60], ["hv-entero", 50], ["hv-clara", 33]], { al: "hotcakes fit" }],
  ["ds-wafflesfresas", "Waffles con fresas y crema", "2 unid.", [["ds-waffles", 150], ["fresas", 75], ["sa-cremabatida", 8]]],
  ["ds-avenaleche", "Avena con leche y banana", "1 tazón", [["avena", 50], ["leche", 250], ["banano", 118]], { al: "avena cocida" }],
  ["ds-overnight", "Avena nocturna con yogur griego", "1 frasco", [["avena", 40], ["yogur", 150], ["nz-chia", 10], ["fr-arandanos", 50]], { al: "overnight oats" }],
  ["ds-parfait", "Yogur con granola y fruta", "1 vaso", [["ly-griego", 170], ["gr-granola", 30], ["fresas", 75]], { al: "parfait" }],
  ["ds-cereal", "Cereal con leche", "1 tazón", [["gr-cornflakes", 30], ["leche", 240]]],
  ["ds-licuadoavena", "Licuado de avena, banana y leche", "1 vaso", [["avena", 30], ["banano", 118], ["leche", 250]], { al: "batido" }],
  ["ds-panmani", "Pan con mantequilla de maní y banana", "2 rebanadas", [["pan", 52], ["nz-mantequillamani", 32], ["banano", 60]]],
  ["ds-tostadasmermelada", "Tostadas con queso crema y mermelada", "2 unid.", [["pn-tostado", 20], ["lq-crema", 30], ["sa-mermelada", 20]]],
  ["ds-revueltosjamon", "Huevos revueltos con jamón", "1 plato", [["hv-revuelto", 120], ["jamon", 28]]],
  ["ds-omeletteclaras", "Omelette de claras con espinaca y queso", "1 unid.", [["hv-clara", 165], ["vd-espinaca", 30], ["lq-mozzalight", 20], ["sa-spray", 1]]],
  ["ds-omelettequeso", "Omelette de 2 huevos con queso y vegetales", "1 unid.", [["hv-entero", 100], ["lq-cheddar", 20], ["vd-pimiento", 30], ["vd-cebolla", 20], ["sa-oliva", 5]]],
  ["ds-pericos", "Huevos pericos", "2 huevos", [["hv-entero", 100], ["vd-tomate", 40], ["vd-cebolla", 20], ["sa-oliva", 5]], { cc: ["CO", "VE"], al: "perico" }],
  ["ds-arepapericos", "Arepa con huevos pericos", "1 plato", [["pn-arepa", 90], ["hv-entero", 100], ["vd-tomate", 40], ["vd-cebolla", 20], ["sa-oliva", 5]], { cc: ["CO", "VE"] }],
  ["ds-mexicana", "Huevos a la mexicana", "2 huevos", [["hv-entero", 100], ["vd-tomate", 40], ["vd-cebolla", 20], ["vd-pimiento", 10], ["sa-oliva", 5]], { cc: ["MX"] }],
  ["ds-molletes", "Molletes", "2 mitades", [["pn-bolillo", 70], ["lg-refritos", 60], ["lq-mozzarella", 30], ["sa-pico", 30]], { cc: ["MX"] }],
  ["ds-americano", "Desayuno americano (huevos, tocino y pan)", "1 plato", [["hv-frito", 92], ["ce-tocino", 16], ["pn-molde", 50], ["sa-mantequilla", 7]]],
  ["ds-tipicoca", "Desayuno típico de huevos, frijoles, plátano y crema", "1 plato", [["hv-revuelto", 120], ["lg-refritos", 120], ["gr-maduro", 90], ["natilla", 30], ["tortilla", 52]], { cc: ["GT", "SV", "HN", "NI"], al: "desayuno chapin catracho" }],
  ["ds-calentado", "Calentado con huevo frito y arepa", "1 plato", [["gr-arrozpreparado", 120], ["lg-rojos", 120], ["hv-frito", 46], ["pn-arepa", 90]], { cc: ["CO"] }],
  ["ds-criollove", "Desayuno criollo venezolano", "1 plato", [["pn-arepa", 90], ["lg-caraotas", 100], ["lq-llanero", 40], ["hv-entero", 100], ["vd-tomate", 30], ["sa-oliva", 5]], { cc: ["VE"] }],
  ["ds-tresgolpes", "Los tres golpes (mangú, salami, queso frito y huevo)", "1 plato", [["gr-platanoverde", 180], ["sa-mantequilla", 10], ["ce-salami", 60], ["lq-freir", 60], ["hv-frito", 46]], { cc: ["DO"], al: "mangu" }],
  ["ds-burrito", "Burrito de desayuno", "1 unid.", [["pn-tortillagrande", 70], ["hv-revuelto", 120], ["gr-papacocida", 80], ["lq-cheddar", 28], ["sa-roja", 30]]],
  ["ds-fresasyogur", "Yogur griego 0 % con fruta y miel", "1 tazón", [["yogur", 200], ["fr-arandanos", 50], ["sa-miel", 10]]],
  ["ds-tostadasfrancesasmiel", "Tostadas francesas con jarabe", "2 rebanadas", [["ds-tostadasfrancesas", 130], ["sa-jarabe", 30]]],
];
