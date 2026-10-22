// Comida rápida genérica (no de una cadena), cocina internacional y de cafetería. Macros por porción, aproximados.
import { perPortion } from "./make";

export const RAPIDA = perPortion("rapida", [
  // Hamburguesas y hot dogs
  ["rp-hamburguesadoble", "Hamburguesa doble con queso", "1 unid.", 300, 850, 48, 42, 52, 2, 9],
  ["rp-hamburguesatocino", "Hamburguesa con tocino y queso", "1 unid.", 280, 750, 40, 42, 45, 2, 9],
  ["rp-hamburguesapollo", "Hamburguesa de pollo empanizado", "1 unid.", 220, 520, 26, 48, 24, 2, 7, { al: "sandwich de pollo crispy" }],
  ["rp-hamburguesavegana", "Hamburguesa vegana de restaurante", "1 unid.", 250, 550, 22, 50, 28, 5, 9, { al: "hamburguesa vegetal plant based" }],
  ["rp-perrotodo", "Perro caliente con todo", "1 unid.", 200, 480, 14, 45, 27, 2, 10, { al: "hot dog salsas papitas perro" }],
  ["rp-corndog", "Banderilla (corn dog)", "1 unid.", 175, 460, 17, 55, 19, 2, 10, { al: "salchicha empanizada" }],
  ["rp-combo", "Combo de hamburguesa, papas y gaseosa", "1 combo", 750, 1150, 32, 145, 50, 6, 55],
  // Pizza
  ["rp-pizzapepperoni", "Pizza de pepperoni", "1 rebanada grande", 110, 320, 13, 36, 14, 2, 4],
  ["rp-pizzahawaiana", "Pizza hawaiana", "1 rebanada grande", 115, 290, 13, 36, 10, 2, 6, { al: "pizza de piña y jamon" }],
  ["rp-pizzavegetariana", "Pizza vegetariana", "1 rebanada grande", 115, 260, 11, 35, 9, 3, 4],
  ["rp-pizzasuprema", "Pizza suprema", "1 rebanada grande", 130, 340, 14, 36, 16, 3, 4, { al: "pizza mixta" }],
  ["rp-pizzaqueso", "Pizza de queso", "1 rebanada grande", 105, 285, 12, 36, 10, 2, 4, { al: "pizza margarita" }],
  ["rp-pizzadelgada", "Pizza de masa delgada", "1 rebanada grande", 80, 230, 10, 22, 11, 1, 3],
  ["rp-calzone", "Calzone", "1 unid.", 300, 780, 36, 80, 34, 4, 6],
  // Sándwiches y wraps
  ["rp-sandpollo", "Sándwich de pollo a la plancha", "1 unid.", 250, 420, 32, 40, 14, 3, 6, { al: "sanduche emparedado sanguche" }],
  ["rp-sandatun", "Sándwich de atún", "1 unid.", 220, 450, 25, 35, 23, 3, 5, { al: "sanduche emparedado sanguche" }],
  ["rp-sandclub", "Sándwich club", "1 unid.", 300, 650, 38, 50, 32, 3, 6, { al: "clubhouse sanduche" }],
  ["rp-sandpavo", "Sándwich de pavo", "1 unid.", 230, 380, 26, 40, 12, 3, 6, { al: "sanduche emparedado sanguche" }],
  ["rp-panini", "Panini caprese", "1 unid.", 230, 520, 22, 50, 25, 3, 4],
  ["rp-subalbondigas", "Sub de albóndigas (15 cm)", "1 unid.", 280, 560, 26, 58, 24, 4, 10],
  ["rp-croissantpavo", "Croissant de pavo y queso", "1 unid.", 180, 450, 22, 33, 26, 2, 6],
  ["rp-wrappollo", "Wrap de pollo", "1 unid.", 250, 480, 32, 45, 18, 4, 4, { al: "burrito wrap" }],
  ["rp-wrapveg", "Wrap vegetariano", "1 unid.", 230, 400, 12, 52, 16, 7, 5],
  ["rp-shawarma", "Shawarma de pollo", "1 unid.", 300, 600, 35, 55, 26, 4, 5, { al: "doner kebab gyro" }],
  // Tex-Mex
  ["rp-quesadillapollo", "Quesadilla de pollo", "1 unid.", 200, 500, 32, 35, 25, 2, 2],
  ["rp-nachoscarne", "Nachos con carne y queso", "1 plato", 350, 850, 30, 70, 50, 8, 4, { al: "nachos supremos" }],
  ["rp-burritobowl", "Burrito bowl", "1 bowl", 500, 700, 40, 80, 24, 14, 5, { al: "bowl mexicano" }],
  ["rp-chimichanga", "Chimichanga", "1 unid.", 250, 600, 25, 55, 30, 5, 3],
  ["rp-tostadapollo", "Tostada de pollo", "1 unid.", 120, 250, 15, 20, 12, 4, 2],
  // Pollo y acompañantes
  ["rp-tiraspollo", "Tiras de pollo empanizado", "4 unid.", 180, 480, 35, 25, 26, 1, 0, { al: "chicken tenders deditos" }],
  ["rp-alitasbbq", "Alitas BBQ", "10 unid.", 300, 900, 70, 20, 60, 0, 16],
  ["rp-alitasbuffalo", "Alitas buffalo", "10 unid.", 300, 860, 72, 3, 62, 0, 1, { al: "alitas picantes" }],
  ["rp-pechugafrita", "Pechuga de pollo frito", "1 pieza", 180, 450, 40, 15, 25, 1, 0],
  ["rp-papasqueso", "Papas fritas con queso y tocino", "1 porción", 300, 750, 20, 60, 47, 5, 2],
  ["rp-gajos", "Papas en gajos", "1 porción", 150, 330, 4, 42, 16, 4, 0, { al: "papas rusticas cascos" }],
  ["rp-aros", "Aros de cebolla", "1 porción", 120, 410, 5, 45, 23, 3, 6],
  ["rp-palitosqueso", "Palitos de queso mozzarella", "6 unid.", 150, 480, 22, 40, 26, 2, 3, { al: "dedos de queso" }],
  ["rp-ensaladacrujiente", "Ensalada con pollo crujiente", "1 plato", 400, 650, 35, 35, 42, 5, 8],
  // Asiática
  ["rp-nigiri", "Nigiri de salmón", "2 piezas", 70, 120, 6, 18, 2.5, 0, 1, { al: "sushi" }],
  ["rp-sashimi", "Sashimi de salmón", "6 piezas", 90, 190, 18, 0, 12.4, 0, 0, { al: "sushi" }],
  ["rp-padthai", "Pad thai", "1 plato", 400, 650, 25, 80, 25, 4, 15],
  ["rp-ramenrest", "Ramen de restaurante", "1 tazón", 600, 600, 30, 70, 22, 4, 5],
  ["rp-lomein", "Lo mein de pollo", "1 plato", 400, 550, 28, 65, 18, 4, 8, { al: "tallarines chinos chow mein" }],
  ["rp-rollitos", "Rollitos primavera", "2 unid.", 130, 320, 7, 35, 17, 3, 4, { al: "egg rolls lumpias" }],
  ["rp-gyozas", "Gyozas o dumplings", "6 unid.", 150, 320, 14, 35, 13, 2, 3, { al: "empanaditas chinas" }],
  ["rp-kungpao", "Pollo kung pao", "1 plato", 300, 480, 32, 20, 30, 3, 8],
  ["rp-wantan", "Wantán frito", "6 unid.", 90, 320, 9, 30, 18, 1, 1, { al: "wonton" }],
  // Italiana
  ["rp-fettuccine", "Fettuccine Alfredo", "1 plato", 400, 750, 22, 75, 40, 3, 4],
  ["rp-ravioles", "Ravioles con salsa de tomate", "1 plato", 300, 450, 18, 55, 17, 4, 7],
  ["rp-risotto", "Risotto", "1 plato", 300, 450, 12, 60, 17, 2, 2],
  ["rp-bruschetta", "Bruschetta", "3 unid.", 120, 280, 7, 35, 12, 2, 3],
  // Cafetería
  ["rp-empanadajamon", "Empanada de jamón y queso", "1 unid.", 110, 330, 12, 30, 18, 1, 2],
  ["rp-pastelcarne", "Pastelito de hojaldre de carne o pollo", "1 unid.", 130, 450, 12, 35, 29, 1, 3, { al: "pastel de carne hojaldre" }],
  ["rp-crepasalada", "Crepa salada de jamón y queso", "1 unid.", 200, 420, 20, 35, 22, 1, 4],
  ["rp-pretzelgrande", "Pretzel grande", "1 unid.", 140, 480, 12, 99, 4.5, 3, 3],
]);
