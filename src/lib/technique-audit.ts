// Revisión de técnica: qué animación muestra cada ejercicio que alguien puede ver (rutinas del motor, ranuras,
// exprés, sustitutos de casa/sin equipo/principiante, alternativas y todas las sesiones de los programas).
//
// Es una lista CERRADA y revisada a mano (24/10, hoja por hoja en el navegador). technique-audit.test.ts falla si:
//   - un ejercicio visible no está aquí (alguien lo agregó a una rutina o programa sin revisar su animación);
//   - la animación que resuelve el código (TECH[id].anim o animFor de la biblioteca) no es la de esta lista;
//   - una animación de la lista no tiene hoja.
// `null` = sin animación a propósito: no existe una hoja de ESE movimiento y la interfaz muestra el respaldo quieto.
// Antes de cambiar una línea: mira la hoja y confirma que es el mismo ejercicio, mismo implemento y rango completo.

/**
 * Ejercicios que comparten la hoja de otro porque son el mismo movimiento (solo cambia el tempo, la pausa, el agarre
 * o la carga). Cualquier otro par ejercicio → hoja ajena es un error.
 */
export const SHARED_SHEET: Readonly<Record<string, string>> = {
  closebench: "bench", // press banca, agarre algo más cerrado
  chinup: "pullup", // dominada, agarre neutro
  dipsw: "dips", // fondos con lastre
  curlp: "curl", // curl con barra con pausa
  facepullp: "facepull", // face pull con pausa
  plankrkc: "plank", // plancha más apretada
  carryp: "carry", // paseo del granjero con pausas
  bwsquat: "squat_bw", // sentadilla sin peso
  jumpsquat: "jump_bw", // sentadilla con salto
  hammer: "curl_bw", // la hoja curl_bw es un curl con mancuernas en agarre neutro (martillo)
};

export const VETTED_ANIM: Readonly<Record<string, string | null>> = {
  // ── Motor: rutinas, ranuras, exprés y sustitutos ──
  squat: "squat", frontsquat: "frontsquat", goblet: "goblet", bench: "bench", closebench: "bench", incline: "incline",
  ohp: "ohp", dbpress: "dbpress", dips: "dips", dipsw: "dips", deadlift: "deadlift", rdl: "rdl",
  pullup: "pullup", chinup: "pullup", row: "row", lat: "lat", dbrow: "dbrow",
  curl: "curl", hammer: "curl_bw", curlp: "curl", lateral: "lateral", lateralc: "lateralc", laterall: "laterall",
  facepull: "facepull", facepullp: "facepull", reardelt: "reardelt",
  pushup: "pushup", pushupd: "pushupd", pushupe: "pushupe",
  plank: "plank", planktap: "planktap", plankrkc: "plank",
  kneeraise: "kneeraise", legraise: "legraise", twistraise: "twistraise",
  carry: "carry", suitcase: "suitcase", carryp: "carry",
  floorpress: "floorpress", dbrdl: "dbrdl", invrow: "invrow", bandpull: "bandpull", legraisef: "legraisef",
  bicycle: "bicycle", bwsquat: "squat_bw", bulgarian: "bulgarian", pikepush: "pikepush", slrdl: "slrdl",
  glutebridge: "glutebridge", towelcurl: "towelcurl", ytw: "ytw", bearcrawl: "bearcrawl", jumpsquat: "jump_bw",
  burpee: "burpee", mountain: "mountain", lunge: "lunge", jacks: "jacks",
  // ── Biblioteca usada en programas ("ds:XXXX") ──
  "ds:0586": "legcurl", // lever lying leg curl
  "ds:0652": "pullup", // pull-up
  "ds:0739": "legpress", // sled 45° leg press
  "ds:0861": "cablerow", // cable seated row
  "ds:1409": "hipthrust", // barbell glute bridge
  "ds:2292": "reardelt", // dumbbell rear delt raise (inclinado)
  "ds:0175": "cablecrunch", // cable kneeling crunch
  "ds:0194": "cableohext", // cable overhead triceps extension
  "ds:0201": "pushdown", // cable pushdown
  "ds:0228": "cablehipext", // cable standing hip extension (también Platanita)
  "ds:0274": "crunch", // crunch floor
  "ds:0276": "deadbug", // dead bug (Platanita)
  "ds:0318": "inclinecurl", // dumbbell incline curl (banco inclinado)
  "ds:0333": "kickback", // dumbbell kickback (Platanita)
  "ds:0372": "preacher", // dumbbell preacher curl
  "ds:0381": "dbrearlunge", // dumbbell rear lunge (también Platanita)
  "ds:0430": "ohext", // dumbbell standing triceps extension
  "ds:0431": "stepup", // dumbbell step-up (Platanita)
  "ds:0459": "flutter", // flutter kicks (también Platanita)
  "ds:0597": "abductor", // lever seated hip abduction (Platanita)
  "ds:0628": "monsterwalk", // monster walk (Platanita)
  "ds:0687": "russiantwist", // russian twist
  "ds:0688": "scappull", // scapular pull-up (solo escápulas, codos rectos)
  "ds:0705": "sideplank", // side bridge (Platanita)
  "ds:0710": "sideabd", // side hip abduction (Platanita)
  "ds:0872": "revcrunch", // reverse crunch (Platanita)
  "ds:0970": "bandpullup", // band assisted pull-up
  "ds:0979": null, // band pallof press (la hoja generada no muestra el empuje: rechazada; Platanita sí tiene)
  "ds:1014": null, // band v-up (Platanita)
  "ds:1358": null, // side lying floor stretch (Platanita)
  "ds:1363": null, // spine stretch (Platanita)
  "ds:1422": null, // pelvic tilt into bridge (Platanita)
  "ds:1757": "dbslrdl", // dumbbell single leg deadlift (con mancuernas; slrdl es sin pesas)
  "ds:1774": "sideplankabd", // side bridge hip abduction (2.º intento; el 1.º salió con la cadera en el piso)
  "ds:2329": null, // spine twist (Platanita)
  "ds:3006": null, // band seated hip abduction (Platanita)
  "ds:3147": null, // pelvic tilt (Platanita)
  "ds:3433": null, // swimmer kicks (Platanita)
  "ds:3561": "bridgemarch", // glute bridge march (también Platanita)
  "ds:3645": null, // single leg bridge (Platanita)
  "ds:3667": null, // side lying hip adduction (Platanita)
};
