// Técnica por ejercicio (portado del prototipo). Generado; editar con cuidado.
export type Technique = { anim: string; mus: string; how: string[]; cues: string[]; err: string[]; mono: string };

export const TECH: Record<string, Technique> = {
 "squat": {
  "anim": "squat",
  "mus": "Cuádriceps, glúteos, aductores, core",
  "how": [
   "Barra sobre el trapecio, manos firmes, codos abajo.",
   "Pies al ancho de hombros, puntas ligeramente afuera.",
   "Toma aire al abdomen, bloquea el core.",
   "Baja 3 s abriendo rodillas en línea con los pies.",
   "Llega a paralelo o más abajo sin perder la espalda neutra.",
   "Sube fuerte empujando el suelo, sin que la cadera suba antes que el pecho."
  ],
  "cues": [
   "Rodillas siguen las puntas",
   "Pecho orgulloso",
   "Talón completo pegado al piso"
  ],
  "err": [
   "Rodillas que se cierran al subir",
   "Rebotar abajo sin control",
   "Levantar talones o inclinarte de más"
  ],
  "mono": "Coach Banana baja como si se sentara en una silla muy baja, <b>lento y controlado</b>. Sube como si empujara la Tierra lejos de él."
 },
 "frontsquat": {
  "anim": "frontsquat",
  "mus": "Cuádriceps, core, espalda alta",
  "how": [
   "Barra sobre los deltoides delanteros, codos altos.",
   "Pies al ancho de hombros.",
   "Baja 3 s con el torso más vertical que en la trasera.",
   "Sube manteniendo codos arriba."
  ],
  "cues": [
   "Codos al frente siempre",
   "Torso alto",
   "Respira antes de bajar"
  ],
  "err": [
   "Codos que caen y la barra rueda",
   "Redondear la espalda alta"
  ],
  "mono": "Coach Banana abraza la barra con los hombros y se mantiene <b>derechito como palmera</b>. Más pierna, menos espalda baja."
 },
 "goblet": {
  "anim": "frontsquat",
  "mus": "Cuádriceps, glúteos, core",
  "how": [
   "Mancuerna pegada al pecho, codos dentro.",
   "Baja 3 s entre tus piernas.",
   "Pausa 1 s abajo y sube fuerte."
  ],
  "cues": [
   "Mancuerna pegada",
   "Codos entre rodillas"
  ],
  "err": [
   "Separar la mancuerna del pecho"
  ],
  "mono": "Coach Banana sostiene la mancuerna como un coco valioso y baja <b>profundo y lento</b>."
 },
 "bench": {
  "anim": "bench",
  "mus": "Pectoral, tríceps, deltoide anterior",
  "how": [
   "Ojos bajo la barra, escápulas juntas y abajo.",
   "Arco natural, glúteos en el banco, pies firmes.",
   "Agarre un poco más ancho que hombros.",
   "Baja 3 s hasta tocar la parte baja del pecho.",
   "Codos a ~45°, no abiertos a 90°.",
   "Empuja fuerte y un poco hacia la cara."
  ],
  "cues": [
   "Rompe la barra hacia afuera",
   "Escápulas en el bolsillo",
   "Pies empujan el piso"
  ],
  "err": [
   "Rebotar en el pecho",
   "Codos abiertos a 90°",
   "Levantar glúteos"
  ],
  "mono": "Coach Banana no tira la barra al pecho como gorila. Coach Banana <b>la baja como si fuera de cristal</b> y la empuja como si quemara."
 },
 "closebench": {
  "anim": "bench",
  "mus": "Tríceps, pectoral",
  "how": [
   "Agarre al ancho de hombros.",
   "Codos pegados al torso.",
   "Baja 3 s al esternón bajo, empuja fuerte."
  ],
  "cues": [
   "Codos pegados"
  ],
  "err": [
   "Agarre demasiado cerrado (muñecas)"
  ],
  "mono": "Mismo press, manos más juntas: Coach Banana le da trabajo extra al <b>tríceps</b>."
 },
 "incline": {
  "anim": "incline",
  "mus": "Pectoral superior, deltoide anterior, tríceps",
  "how": [
   "Banco a 30°.",
   "Mancuernas a la altura del pecho alto, codos a 45°.",
   "Baja 3 s sintiendo estirar el pecho.",
   "Empuja juntando ligeramente las mancuernas arriba."
  ],
  "cues": [
   "Pecho alto",
   "Muñecas firmes"
  ],
  "err": [
   "Banco muy inclinado (se vuelve hombro)"
  ],
  "mono": "Coach Banana inclina el banco poquito para construir <b>pecho de arriba</b>, el que se ve en camiseta."
 },
 "ohp": {
  "anim": "ohp",
  "mus": "Deltoides, tríceps, core",
  "how": [
   "Barra en la clavícula, agarre al ancho de hombros.",
   "Glúteos y abdomen apretados.",
   "Empuja vertical, mete la cabeza al pasar la barra.",
   "Bloquea arriba con bíceps junto a las orejas.",
   "Baja 3 s a la clavícula."
  ],
  "cues": [
   "Glúteo duro",
   "Barra en línea recta",
   "Cabeza atraviesa la ventana"
  ],
  "err": [
   "Arquear la espalda baja",
   "Empujar la barra hacia adelante"
  ],
  "mono": "Coach Banana empuja el cielo. Si Coach Banana <b>arquea la espalda como banana</b>, el peso está muy pesado."
 },
 "dbpress": {
  "anim": "dbpress",
  "mus": "Deltoides, tríceps",
  "how": [
   "Sentado con respaldo vertical.",
   "Mancuernas a la altura de orejas.",
   "Empuja arriba sin chocarlas.",
   "Baja 3 s."
  ],
  "cues": [
   "Costillas abajo"
  ],
  "err": [
   "Bajar muy poco"
  ],
  "mono": "Coach Banana hace hombros redondos como <b>cocos</b>: rango completo y bajada lenta."
 },
 "dips": {
  "anim": "dips",
  "mus": "Pectoral inferior, tríceps",
  "how": [
   "Brazos estirados, hombros abajo.",
   "Inclina el torso un poco adelante.",
   "Baja 3 s hasta brazo paralelo.",
   "Empuja fuerte hasta bloquear."
  ],
  "cues": [
   "Hombros lejos de orejas"
  ],
  "err": [
   "Bajar demasiado con dolor de hombro"
  ],
  "mono": "Coach Banana baja hasta que el brazo queda paralelo. <b>Si duele el hombro, Coach Banana no baja más.</b>"
 },
 "dipsw": {
  "anim": "dips",
  "mus": "Pectoral inferior, tríceps",
  "how": [
   "Cinturón con disco o mancuerna entre pies.",
   "Misma técnica que fondos normales."
  ],
  "cues": [
   "Control total"
  ],
  "err": [
   "Balancear el peso"
  ],
  "mono": "Coach Banana ya domina su peso: ahora carga un <b>racimo extra</b>."
 },
 "deadlift": {
  "anim": "deadlift",
  "mus": "Glúteos, isquios, espalda baja, trapecio, agarre",
  "how": [
   "Barra sobre el medio del pie, pies a ancho de cadera.",
   "Agarra la barra justo fuera de las piernas.",
   "Baja la cadera hasta que las tibias toquen la barra.",
   "Pecho arriba, espalda neutra, \"rompe\" la barra para tensar dorsales.",
   "Empuja el suelo con las piernas y extiende la cadera.",
   "Bloquea con glúteos. Baja controlado por el mismo camino."
  ],
  "cues": [
   "Barra pegada a las piernas",
   "Empuja el piso, no jales con la espalda",
   "Axilas apretadas"
  ],
  "err": [
   "Espalda redondeada",
   "Barra lejos del cuerpo",
   "Hiperextender arriba"
  ],
  "mono": "Coach Banana no levanta la barra con la espalda. Coach Banana <b>empuja el planeta hacia abajo</b> con las piernas y la barra sube sola."
 },
 "rdl": {
  "anim": "rdl",
  "mus": "Isquiotibiales, glúteos, espalda baja",
  "how": [
   "De pie con la barra, rodillas un poco flexionadas.",
   "Lleva la cadera atrás 3 s, barra pegada a los muslos.",
   "Para cuando sientas estirar los isquios (bajo la rodilla).",
   "Regresa empujando la cadera adelante."
  ],
  "cues": [
   "Cadera atrás, no abajo",
   "Espalda plana"
  ],
  "err": [
   "Doblar mucho las rodillas",
   "Redondear la espalda"
  ],
  "mono": "Coach Banana cierra la puerta del carro con el <b>trasero</b>. Ese es el movimiento."
 },
 "pullup": {
  "anim": "pullup",
  "mus": "Dorsales, bíceps, espalda alta",
  "how": [
   "Agarre prono algo más ancho que hombros.",
   "Cuelga con hombros activos (no hundidos).",
   "Tira llevando los codos a los bolsillos.",
   "Barbilla sobre la barra.",
   "Baja 3 s hasta brazos casi estirados."
  ],
  "cues": [
   "Pecho a la barra",
   "Codos al bolsillo",
   "Sin balanceo"
  ],
  "err": [
   "Medias repeticiones",
   "Columpiarse"
  ],
  "mono": "¿Coach Banana no llega a 5? Usa banda elástica o haz <b>negativas de 5 s</b>. Las dominadas construyen la espalda en V de Coach Banana."
 },
 "chinup": {
  "anim": "pullup",
  "mus": "Dorsales, bíceps, braquial",
  "how": [
   "Palmas mirándose (o supinas).",
   "Misma técnica: codos abajo, baja 3 s."
  ],
  "cues": [
   "Pecho arriba"
  ],
  "err": [
   "Medio rango"
  ],
  "mono": "Agarre amigable para el hombro, mismo <b>dorsal gigante</b>."
 },
 "lat": {
  "anim": "pullup",
  "mus": "Dorsales, bíceps",
  "how": [
   "Muslos fijos.",
   "Tira la barra al pecho alto.",
   "Sube 3 s."
  ],
  "cues": [
   "Codos abajo y atrás"
  ],
  "err": [
   "Tirar detrás de la nuca"
  ],
  "mono": "Plan B de Coach Banana si no hay barra: <b>mismo patrón</b>."
 },
 "row": {
  "anim": "row",
  "mus": "Espalda media, dorsales, bíceps",
  "how": [
   "Bisagra de cadera a ~45° o más, espalda plana.",
   "Agarre algo más ancho que hombros.",
   "Lleva la barra al ombligo con los codos atrás.",
   "Aprieta escápulas 1 s.",
   "Baja 2-3 s."
  ],
  "cues": [
   "Torso quieto",
   "Codos atrás, no arriba"
  ],
  "err": [
   "Usar impulso de cadera",
   "Subir el torso en cada rep"
  ],
  "mono": "Coach Banana rema la canoa hacia su <b>ombligo</b>. El torso no se mueve; solo los brazos."
 },
 "dbrow": {
  "anim": "dbrow",
  "mus": "Dorsales, espalda media",
  "how": [
   "Mano y rodilla en el banco.",
   "Espalda plana.",
   "Lleva la mancuerna a la cadera.",
   "Baja 2-3 s estirando el dorsal."
  ],
  "cues": [
   "Codo al bolsillo"
  ],
  "err": [
   "Girar el torso"
  ],
  "mono": "Coach Banana arranca la cortadora de césped, pero <b>lento al bajar</b>."
 },
 "curl": {
  "anim": "curl",
  "mus": "Bíceps, braquial",
  "how": [
   "Codos pegados al torso.",
   "Sube sin balanceo.",
   "Aprieta 1 s.",
   "Baja 3 s."
  ],
  "cues": [
   "Codos quietos"
  ],
  "err": [
   "Columpiar la espalda"
  ],
  "mono": "Coach Banana no hace el gusano: <b>solo se mueven los antebrazos</b>."
 },
 "hammer": {
  "anim": "curl",
  "mus": "Braquial, antebrazo, bíceps",
  "how": [
   "Palmas mirándose.",
   "Sube y baja 3 s."
  ],
  "cues": [
   "Muñeca neutra"
  ],
  "err": [
   "Balanceo"
  ],
  "mono": "Brazos más gruesos para <b>llenar la manga</b>."
 },
 "curlp": {
  "anim": "curl",
  "mus": "Bíceps",
  "how": [
   "Pausa 2 s a mitad de recorrido al subir.",
   "Baja 3 s."
  ],
  "cues": [
   "Pausa real"
  ],
  "err": [
   "Pausa falsa"
  ],
  "mono": "Pausa a la mitad: el bíceps de Coach Banana <b>no tiene dónde esconderse</b>."
 },
 "lateral": {
  "anim": "lateral",
  "mus": "Deltoide lateral",
  "how": [
   "Leve flexión de codos.",
   "Sube hasta la altura de hombros guiando con el codo.",
   "Pausa 1 s, baja 3 s."
  ],
  "cues": [
   "Codo lidera",
   "Sin trapecio"
  ],
  "err": [
   "Subir con impulso",
   "Encoger hombros"
  ],
  "mono": "Hombros anchos hacen ver la <b>cintura más pequeña</b>. Truco del gordiflaco."
 },
 "lateralc": {
  "anim": "lateral",
  "mus": "Deltoide lateral",
  "how": [
   "Polea baja, cruzada por delante.",
   "Sube hasta el hombro, baja 3 s."
  ],
  "cues": [
   "Tensión constante"
  ],
  "err": [
   "Tirar con el torso"
  ],
  "mono": "La polea nunca descansa: <b>tensión todo el rango</b>."
 },
 "laterall": {
  "anim": "lateral",
  "mus": "Deltoide lateral",
  "how": [
   "Apóyate en un poste, inclínate 15°.",
   "Una mano a la vez."
  ],
  "cues": [
   "Rango completo"
  ],
  "err": [
   "Peso excesivo"
  ],
  "mono": "Coach Banana se inclina para <b>más estiramiento</b>."
 },
 "facepull": {
  "anim": "facepull",
  "mus": "Deltoide posterior, manguito rotador, trapecio medio",
  "how": [
   "Polea a la altura de la cara, cuerda.",
   "Tira separando las manos hacia las orejas.",
   "Rota los pulgares hacia atrás.",
   "Vuelve 2-3 s."
  ],
  "cues": [
   "Codos altos",
   "Pulgares atrás"
  ],
  "err": [
   "Tirar con la espalda baja"
  ],
  "mono": "El seguro de hombros de Coach Banana. <b>Postura recta, hombros sanos.</b>"
 },
 "reardelt": {
  "anim": "facepull",
  "mus": "Deltoide posterior",
  "how": [
   "Torso inclinado.",
   "Abre los brazos como alas.",
   "Baja 3 s."
  ],
  "cues": [
   "Brazos largos"
  ],
  "err": [
   "Usar trapecio"
  ],
  "mono": "Coach Banana vuela, pero <b>despacito</b>."
 },
 "pushup": {
  "anim": "pushup",
  "mus": "Pectoral, tríceps, core",
  "how": [
   "Manos un poco más anchas que los hombros.",
   "Cuerpo en tabla: glúteos y abdomen apretados.",
   "Baja 3 s hasta que el pecho casi toque el piso.",
   "Empuja fuerte sin que la cadera se caiga."
  ],
  "cues": [
   "Codos a 45°",
   "Cuello neutro"
  ],
  "err": [
   "Cadera caída",
   "Medio rango"
  ],
  "mono": "Coach Banana no necesita banco para hacer <b>pecho</b>: el piso siempre está ahí."
 },
 "pushupd": {
  "anim": "pushup",
  "mus": "Tríceps, pectoral",
  "how": [
   "Manos juntas formando un diamante bajo el pecho.",
   "Baja 3 s con codos pegados.",
   "Empuja fuerte."
  ],
  "cues": [
   "Codos atrás"
  ],
  "err": [
   "Abrir los codos"
  ],
  "mono": "Mismo piso, más <b>tríceps</b>."
 },
 "pushupe": {
  "anim": "pushup",
  "mus": "Pectoral superior, hombros",
  "how": [
   "Pies en un banco, manos en el piso.",
   "Baja 3 s, empuja fuerte."
  ],
  "cues": [
   "Tabla rígida"
  ],
  "err": [
   "Arquear la espalda"
  ],
  "mono": "Pies arriba = <b>pecho de arriba</b>."
 },
 "plank": {
  "anim": "plank",
  "mus": "Abdomen, core profundo, glúteos",
  "how": [
   "Antebrazos bajo los hombros.",
   "Cuerpo en línea recta de talón a cabeza.",
   "Aprieta glúteos y abdomen como si te fueran a golpear.",
   "Respira corto sin soltar la tensión."
  ],
  "cues": [
   "Glúteos duros",
   "Costillas abajo"
  ],
  "err": [
   "Cadera alta o caída",
   "Aguantar la respiración"
  ],
  "mono": "Coach Banana no aguanta por aguantar: <b>tensión máxima</b> o no cuenta."
 },
 "planktap": {
  "anim": "plank",
  "mus": "Core antirotación, hombros",
  "how": [
   "Plancha alta sobre las manos.",
   "Toca el hombro contrario alternando.",
   "La cadera no se mueve."
  ],
  "cues": [
   "Pies separados para estabilidad"
  ],
  "err": [
   "Balancear la cadera"
  ],
  "mono": "Si la cadera de Coach Banana se mueve, <b>va más lento</b>."
 },
 "plankrkc": {
  "anim": "plank",
  "mus": "Abdomen, glúteos",
  "how": [
   "Plancha de antebrazos.",
   "Jala codos hacia los pies y aprieta todo al máximo.",
   "Series cortas de tensión total."
  ],
  "cues": [
   "Máxima tensión"
  ],
  "err": [
   "Relajarse"
  ],
  "mono": "20 segundos que se sienten como 2 minutos. <b>Así se hace.</b>"
 },
 "kneeraise": {
  "anim": "kneeraise",
  "mus": "Abdomen inferior, flexores de cadera, agarre",
  "how": [
   "Cuélgate con hombros activos.",
   "Sube las rodillas al pecho redondeando la pelvis.",
   "Baja lento sin balancearte."
  ],
  "cues": [
   "Pelvis hacia arriba",
   "Sin columpio"
  ],
  "err": [
   "Usar impulso"
  ],
  "mono": "Coach Banana no se columpia como en la selva: <b>sube con el abdomen</b>."
 },
 "legraise": {
  "anim": "kneeraise",
  "mus": "Abdomen, flexores de cadera",
  "how": [
   "Piernas casi rectas.",
   "Sube hasta la horizontal o más.",
   "Baja 3 s."
  ],
  "cues": [
   "Control total"
  ],
  "err": [
   "Balanceo"
  ],
  "mono": "Versión difícil: <b>piernas largas</b>."
 },
 "twistraise": {
  "anim": "kneeraise",
  "mus": "Oblicuos, abdomen",
  "how": [
   "Sube las rodillas hacia un lado, luego al otro.",
   "Baja lento."
  ],
  "cues": [
   "Gira la pelvis"
  ],
  "err": [
   "Velocidad"
  ],
  "mono": "Oblicuos: la <b>cintura</b> de Coach Banana se marca aquí."
 },
 "carry": {
  "anim": "carry",
  "mus": "Agarre, trapecio, core, todo",
  "how": [
   "Mancuernas pesadas a los lados.",
   "Pecho alto, hombros abajo.",
   "Camina con pasos cortos y firmes."
  ],
  "cues": [
   "No te inclines",
   "Respira"
  ],
  "err": [
   "Encoger hombros",
   "Pasos largos"
  ],
  "mono": "Coach Banana carga los racimos de bananas a casa: <b>pesado y derecho</b>."
 },
 "suitcase": {
  "anim": "carry",
  "mus": "Oblicuos, agarre, core",
  "how": [
   "Una sola mancuerna.",
   "No te inclines hacia el peso.",
   "Cambia de mano a mitad."
  ],
  "cues": [
   "Torso vertical"
  ],
  "err": [
   "Inclinarse"
  ],
  "mono": "Una mano: el core de Coach Banana <b>pelea para no caerse</b>."
 },
 "carryp": {
  "anim": "carry",
  "mus": "Agarre, core",
  "how": [
   "Camina 10 m, pausa 5 s, repite."
  ],
  "cues": [
   "Postura de rey"
  ],
  "err": [
   "Soltar tensión en la pausa"
  ],
  "mono": "Pausas = <b>más tiempo bajo tensión</b>."
 },
 "facepullp": {
  "anim": "facepull",
  "mus": "Deltoide posterior",
  "how": [
   "Pausa 2 s atrás en cada rep."
  ],
  "cues": [
   "Pausa real"
  ],
  "err": [
   "Peso alto"
  ],
  "mono": "Pausa atrás: <b>calidad sobre ego</b>."
 }
};

// Variantes para entrenar en casa
Object.assign(TECH, {
  floorpress: { anim: "bench", mus: "Pecho, tríceps, hombro anterior", how: ["Acuéstate en el piso con rodillas dobladas y una mancuerna en cada mano.", "Codos a 45° del torso, tocan el piso suave en cada rep.", "Pausa 1 s abajo y empuja fuerte hacia arriba."], cues: ["Codos a 45°", "Escápulas pegadas al piso"], err: ["Rebotar los codos en el piso"], mono: "Coach Banana empuja el coco al techo <b>sin rebotar</b>." },
  dbrdl: { anim: "rdl", mus: "Femorales, glúteos, espalda baja", how: ["De pie, mancuernas frente a los muslos.", "Lleva la cadera atrás con rodillas apenas dobladas.", "Baja hasta sentir el estiramiento atrás del muslo y sube apretando glúteo."], cues: ["Cadera atrás", "Espalda neutra"], err: ["Redondear la espalda"], mono: "Coach Banana cierra la puerta del carro <b>con la cola</b>." },
  invrow: { anim: "row", mus: "Espalda, bíceps", how: ["Acuéstate bajo una mesa firme o barra baja y agárrala.", "Cuerpo en tabla, talones en el piso.", "Tira del pecho hacia la mesa y baja lento 3 s."], cues: ["Cuerpo en tabla", "Codos al bolsillo"], err: ["Dejar caer la cadera"], mono: "Coach Banana se sube al árbol <b>con la espalda</b>, no con los brazos." },
  bandpull: { anim: "pullup", mus: "Dorsales, bíceps", how: ["Ancla la banda arriba de una puerta.", "De rodillas, tira codos hacia las costillas.", "Vuelve lento sin soltar la tensión."], cues: ["Pecho alto", "Codos abajo y atrás"], err: ["Encoger los hombros"], mono: "Coach Banana jala la liana <b>con los codos</b>." },
  legraisef: { anim: "plank", mus: "Abdomen inferior", how: ["Boca arriba, manos bajo la cadera.", "Sube las piernas rectas hasta 90°.", "Baja lento sin que la espalda baja se despegue."], cues: ["Espalda baja pegada al piso"], err: ["Arquear la espalda"], mono: "Coach Banana baja las piernas <b>como en cámara lenta</b>." },
  bicycle: { anim: "plank", mus: "Oblicuos, abdomen", how: ["Boca arriba, manos detrás de la cabeza.", "Lleva codo hacia la rodilla contraria alternando.", "Ritmo controlado, sin jalar el cuello."], cues: ["Gira el torso, no el cuello"], err: ["Ir demasiado rápido"], mono: "Coach Banana pedalea <b>lento y con giro</b>." },
});

// Sin equipo y exprés
Object.assign(TECH, {
  bwsquat: { anim: "squat_bw", mus: "Cuádriceps, glúteos", how: ["Pies al ancho de hombros, brazos al frente.", "Baja 3 s como si te sentaras en una silla baja.", "Sube empujando el piso con todo el pie."], cues: ["Rodillas siguen las puntas", "Pecho orgulloso"], err: ["Talones se despegan"], mono: "Coach Banana se sienta en una silla <b>invisible</b>." },
  bulgarian: { anim: "squat_bw", mus: "Cuádriceps, glúteos", how: ["Pie de atrás apoyado en una silla o sofá.", "Baja recto hasta que la rodilla de atrás casi toque el piso.", "Sube con la pierna de adelante. Cambia de lado."], cues: ["Torso alto", "Peso en el pie de adelante"], err: ["Rodilla de adelante hacia adentro"], mono: "Coach Banana sube la escalera <b>una pierna a la vez</b>." },
  pikepush: { anim: "pushup", mus: "Hombros, tríceps", how: ["Manos al piso y cadera arriba en forma de V invertida.", "Baja la cabeza hacia el piso entre las manos.", "Empuja de vuelta arriba."], cues: ["Cadera alta", "Codos hacia atrás"], err: ["Cadera baja (se vuelve flexión normal)"], mono: "Coach Banana hace de <b>techo de casita</b>." },
  slrdl: { anim: "rdl_bw", mus: "Femorales, glúteos, equilibrio", how: ["De pie en una pierna, rodilla apenas doblada.", "Lleva la cadera atrás y la otra pierna estirada hacia atrás.", "Vuelve apretando glúteo. Cambia de lado."], cues: ["Cadera cuadrada al piso"], err: ["Girar la cadera"], mono: "Coach Banana es <b>un avión</b> que despega lento." },
  glutebridge: { anim: "plank", mus: "Glúteos, femorales", how: ["Boca arriba, rodillas dobladas, pies al ancho de cadera.", "Sube la cadera apretando glúteos 2 s arriba.", "Baja lento sin tocar del todo el piso."], cues: ["Aprieta glúteo arriba", "Costillas abajo"], err: ["Arquear la espalda baja"], mono: "Coach Banana hace <b>puente</b> para que pasen los carros." },
  towelcurl: { anim: "curl_bw", mus: "Bíceps", how: ["Pisa el centro de una toalla y agarra las puntas.", "Tira hacia arriba con todas tus fuerzas sin mover el pie.", "Aguanta el tiempo indicado y respira."], cues: ["Codos pegados al cuerpo"], err: ["Contener la respiración"], mono: "Coach Banana jala la cuerda del <b>tesoro escondido</b>." },
  ytw: { anim: "lateral", mus: "Hombro posterior, espalda alta", how: ["Boca abajo en el piso, frente en una toalla.", "Sube los brazos en Y, luego T, luego W.", "Pausa 1 s arriba en cada letra."], cues: ["Pulgares al techo", "Escápulas juntas"], err: ["Levantar el pecho del piso"], mono: "Coach Banana escribe <b>YTW</b> en el aire." },
  bearcrawl: { anim: "plank", mus: "Core, hombros", how: ["En cuatro apoyos con rodillas a 2 cm del piso.", "Avanza mano y pie contrario a la vez.", "Espalda plana como una mesa."], cues: ["Rodillas bajitas", "Espalda plana"], err: ["Cadera muy alta"], mono: "Coach Banana gatea <b>sin hacer ruido</b>." },
  jumpsquat: { anim: "jump_bw", mus: "Piernas, potencia", how: ["Baja a media sentadilla.", "Salta explosivo estirando todo el cuerpo.", "Aterriza suave y encadena."], cues: ["Aterriza suave"], err: ["Aterrizar con rodillas rectas"], mono: "Coach Banana salta a <b>la rama de arriba</b>." },
  burpee: { anim: "burpee", mus: "Cuerpo completo", how: ["Manos al piso, salta los pies atrás a plancha.", "Pecho al piso, empuja arriba.", "Pies a las manos y salta con brazos arriba."], cues: ["Ritmo constante"], err: ["Espalda caída en la plancha"], mono: "Coach Banana <b>cae y se levanta</b>, una y otra vez." },
  mountain: { anim: "mountain", mus: "Core, cardio", how: ["Posición de plancha alta.", "Lleva una rodilla al pecho y cambia rápido.", "Cadera baja todo el tiempo."], cues: ["Hombros sobre las manos"], err: ["Cadera rebotando"], mono: "Coach Banana <b>escala la montaña</b> sin moverse de lugar." },
  lunge: { anim: "squat_bw", mus: "Cuádriceps, glúteos", how: ["Da un paso largo al frente.", "Baja hasta que ambas rodillas formen 90°.", "Empuja de vuelta y alterna."], cues: ["Torso alto"], err: ["Rodilla pasa mucho la punta"], mono: "Coach Banana da <b>pasos de gigante</b>." },
  jacks: { anim: "lateral", mus: "Cardio", how: ["Salta abriendo piernas y brazos arriba.", "Vuelve a cerrar.", "Ritmo cómodo y constante."], cues: ["Respira por la nariz"], err: ["Aterrizar con talones"], mono: "Coach Banana hace <b>estrellitas</b>." },
});
