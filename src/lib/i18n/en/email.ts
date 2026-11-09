// en-US: email (#287). Correos de la prueba (#301): secuencia de los días 2, 4 y 6, recuperación de los días 8 y 10,
// segundo entreno, meta semanal y activación A0 a A2, más el pie de todos los correos. El copy completo está en
// docs/emails/en.md. Las frases con precios se arman igual que en src/lib/email/templates.ts (PLANS y ANNUAL_SEASON_NOTE):
// si cambia un precio, la clave cambia con él; email-en.test.ts avisa si una frase queda sin traducir.
import { ANNUAL_SEASON_NOTE, PLANS, annualSaving } from "@/lib/plans";
import { usd2 } from "@/lib/num";

const [ENTRENO, COMPLETO] = PLANS;
const seasonEs = ANNUAL_SEASON_NOTE.replace(/^Incluye 1 /, "incluye una ");
const SEASON = "includes one free sports season";
const TRAINING = "Training", FULL = "Training + Nutrition";

export const EMAIL: Record<string, string> = {
  // Pie de todos los correos
  "Abrir la app": "Open the app",
  "Mi progreso": "My progress",
  "Ayuda": "Help",
  "Dejar de recibir estos correos": "Stop getting these emails",
  "Ajustar avisos": "Notification settings",
  "Banana Burn, tu entrenador personal en el celular.": "Banana Burn, your personal trainer on your phone.",
  "Banana Burn, tu entrenador personal en el celular": "Banana Burn, your personal trainer on your phone",
  "Ayuda: {email}": "Help: {email}",
  "Dejar de recibir estos correos: {url}": "Stop getting these emails: {url}",

  // Secuencia de la prueba: días 2, 4 y 6
  "Tu prueba de 7 días": "Your 7-day trial",
  "Recibes este correo porque estás en tu prueba de 7 días y tienes activados los recordatorios de Banana Burn.":
    "You're getting this email because you're on your 7-day trial and have Banana Burn reminders turned on.",
  "Tu primer resultado empieza por registrar": "Your first result starts with logging",
  "Mira lo que ya guardaste y abre el entreno de hoy.": "See what you've saved and open today's workout.",
  "Tu primer resultado puede ser una sesión registrada, no un cambio en la báscula. Si ya entrenaste, revisa en Progreso lo que guardaste: ese es tu punto de partida para comparar más adelante.":
    "Your first result can be a logged session, not a change on the scale. If you already trained, check what you saved in Progress: that's your starting point to compare against later.",
  "Si todavía no empezaste, hoy puedes dar ese primer paso. Abre tu rutina, sigue la técnica de cada ejercicio y registra el peso y las repeticiones que hagas.":
    "If you haven't started yet, today you can take that first step. Open your routine, follow the form for each exercise and log the weight and reps you do.",
  "Consulta lo que te toca hoy y respeta los días de descanso de tu plan. No necesitas demostrar nada en dos días: necesitas un comienzo que puedas repetir.":
    "Check what's on for today and keep the rest days in your plan. You don't need to prove anything in two days. You need a start you can repeat.",
  "Ver mi entreno": "See my workout",
  "Más que completar el entreno de hoy": "More than finishing today's workout",
  "Progreso, comida y carrera: elige qué quieres sostener.": "Progress, food and running: choose what you want to keep up.",
  "Seguir te permite comparar tu fuerza, peso, medidas y fotos en Progreso. No todo el avance se ve en la báscula.":
    "Keeping going lets you compare your strength, weight, measurements and photos in Progress. Not all progress shows up on the scale.",
  [`Con ${COMPLETO.name} también puedes registrar tus comidas y consultar tus calorías y macros. La nutrición está incluida durante tu prueba; después depende del plan que elijas.`]:
    `With ${FULL} you can also log your meals and check your calories and macros. Nutrition is included during your trial. After that, it depends on the plan you choose.`,
  [`¿También corres? Banana Run registra tus carreras con GPS. Para un plan de carrera guiado, explora la Temporada Running. Las temporadas se adquieren aparte; cada año pagado de un plan anual ${seasonEs}.`]:
    `Do you run too? Banana Run tracks your runs with GPS. For a guided running plan, check out the Running Season. Seasons are bought separately, and each paid year of a yearly plan ${SEASON}.`,
  "Revisa qué quieres mantener en tu rutina y qué plan lo incluye.": "Look at what you want to keep in your routine and which plan includes it.",
  "Ver qué incluye mi plan": "See what my plan includes",
  "Elige cómo quieres seguir": "Choose how you want to keep going",
  "Compara el ahorro anual y las opciones mensuales en Mi plan.": "Compare the yearly savings and the monthly options in My plan.",
  "Revisa qué opción se adapta a ti.": "See which option fits you.",
  [`Anual: ${ENTRENO.name} cuesta ${usd2(ENTRENO.price.anual)} al año; ahorras ${usd2(annualSaving(ENTRENO))} frente a 12 mensualidades. ${COMPLETO.name} cuesta ${usd2(COMPLETO.price.anual)} al año; ahorras ${usd2(annualSaving(COMPLETO))}. Cada año pagado ${seasonEs}.`]:
    `Yearly: ${TRAINING} costs ${usd2(ENTRENO.price.anual)} a year, so you save ${usd2(annualSaving(ENTRENO))} compared with 12 monthly payments. ${FULL} costs ${usd2(COMPLETO.price.anual)} a year, so you save ${usd2(annualSaving(COMPLETO))}. Each paid year ${SEASON}.`,
  [`Mensual: ${ENTRENO.name} cuesta ${usd2(ENTRENO.price.mes)} al mes y ${COMPLETO.name}, ${usd2(COMPLETO.price.mes)} al mes. Nutrición está incluida solo en ${COMPLETO.name}.`]:
    `Monthly: ${TRAINING} costs ${usd2(ENTRENO.price.mes)} a month and ${FULL} costs ${usd2(COMPLETO.price.mes)} a month. Nutrition is only included in ${FULL}.`,
  "Estos son precios regulares en USD, con IVA incluido. El ahorro anual compara 12 meses a precio regular, sin promociones.":
    "These are regular prices in USD, tax included. The yearly savings compare 12 months at the regular price, without promotions.",
  "En Mi plan puedes revisar tu elección y las condiciones que aplican a tu cuenta antes de confirmar cualquier cambio.":
    "In My plan you can review your choice and the terms for your account before you confirm any change.",
  "Revisar mi plan": "Review my plan",

  // Recuperación: días 8 y 10
  "Tu prueba terminó": "Your trial ended",
  "Recibes este correo porque tu prueba de 7 días terminó sin elegir un plan y tienes activados los recordatorios de Banana Burn.":
    "You're getting this email because your 7-day trial ended without a plan and you have Banana Burn reminders turned on.",
  "{n} entreno": "{n} workout",
  "{n} entrenos": "{n} workouts",
  "{n} serie": "{n} set",
  "{n} series": "{n} sets",
  "{n} día": "{n} day",
  "{n} días": "{n} days",
  "{total} levantados": "{total} lifted",
  ", con {items}": ", with {items}",
  " y ": " and ",
  "En tu prueba guardaste {workouts}{extra}. Todo eso sigue en tu cuenta.": "During your trial you saved {workouts}{extra}. All of it is still in your account.",
  " de {days} por semana": " for {days} a week",
  "Tu plan{days} sigue listo en tu cuenta, con las rutinas armadas a partir de tus datos.":
    "Your plan{days} is still ready in your account, with routines built from your details.",
  "Tu progreso te espera": "Your progress is waiting",
  "Tu prueba terminó. Elige tu plan y sigue donde quedaste.": "Your trial ended. Choose your plan and pick up where you left off.",
  [`Para seguir, elige tu plan en Mi plan. El anual aparece primero: ${ENTRENO.name} cuesta ${usd2(ENTRENO.price.anual)} al año y ${COMPLETO.name}, ${usd2(COMPLETO.price.anual)} al año. Cada año pagado ${seasonEs}. Si prefieres mes a mes, ${ENTRENO.name} cuesta ${usd2(ENTRENO.price.mes)} y ${COMPLETO.name}, ${usd2(COMPLETO.price.mes)}.`]:
    `To keep going, choose your plan in My plan. Yearly comes first: ${TRAINING} costs ${usd2(ENTRENO.price.anual)} a year and ${FULL} costs ${usd2(COMPLETO.price.anual)} a year. Each paid year ${SEASON}. If you'd rather pay month to month, ${TRAINING} costs ${usd2(ENTRENO.price.mes)} and ${FULL} costs ${usd2(COMPLETO.price.mes)}.`,
  "Precios en USD, con IVA incluido. Revisa el plan y el total antes de confirmar el pago.":
    "Prices in USD, tax included. Check the plan and the total before you confirm the payment.",
  "Elegir mi plan": "Choose my plan",
  "Último correo sobre tu prueba": "Last email about your trial",
  "Tu cuenta sigue aquí cuando quieras volver.": "Your account is still here whenever you want to come back.",
  "Este es el último correo que te enviamos sobre tu prueba.": "This is the last email we'll send you about your trial.",
  "Tu cuenta sigue abierta, con lo que guardaste. Cuando quieras seguir, elige tu plan en Mi plan: el anual aparece primero y también puedes pagar mes a mes. Precios en USD, con IVA incluido.":
    "Your account is still open, with everything you saved. When you want to keep going, choose your plan in My plan. Yearly comes first, and you can also pay month to month. Prices in USD, tax included.",

  // Segundo entreno
  "Tu segundo entreno": "Your second workout",
  "Recibes este correo porque terminaste tu primer entreno en Banana Burn y tienes activados los recordatorios.":
    "You're getting this email because you finished your first workout on Banana Burn and have reminders turned on.",
  "Tu segundo entreno está listo": "Your second workout is ready",
  "Ya hiciste el primero. El segundo se hace igual, paso a paso.": "You did the first one. The second one works the same way, step by step.",
  "Hace unos días terminaste tu primer entreno. El segundo ya está en tu plan, ajustado con lo que anotaste esa vez.":
    "A few days ago you finished your first workout. The second one is already in your plan, adjusted to what you logged that time.",
  "Ábrelo cuando tengas un rato hoy. Coach Banana te dice cada ejercicio, cuántas veces y cuándo descansar.":
    "Open it when you have a few minutes today. Coach Banana tells you each exercise, how many reps and when to rest.",
  "Tu plan funciona entrenando varias veces por semana: el segundo entreno es el que lo pone en marcha.":
    "Your plan works when you train several times a week. The second workout is what gets it going.",
  "Empezar mi segundo entreno": "Start my second workout",

  // Meta semanal
  "Tu meta de la semana": "Your weekly goal",
  "Recibes este correo porque entrenas con Banana Burn y tienes activados los recordatorios.":
    "You're getting this email because you train with Banana Burn and have reminders turned on.",
  "Todavía llegas a tu meta de la semana": "You can still hit your weekly goal",
  "Llevas {count} de {goal} entrenos.": "You've done {count} of {goal} workouts.",
  " Hoy son {mins} minutos.": " Today's workout takes {mins} minutes.",
  "Esta semana llevas {count} de {goal} entrenos. Todavía te alcanzan los días para cumplir tu meta.":
    "This week you've done {count} of {goal} workouts. There are still enough days left to hit your goal.",
  "El de hoy son {mins} minutos. ": "Today's workout takes {mins} minutes. ",
  "Coach Banana te dice cada ejercicio, cuántas veces y cuándo descansar.": "Coach Banana tells you each exercise, how many reps and when to rest.",
  "Si hoy no puedes, no pasa nada: descansar también es parte del plan.": "If you can't today, that's fine. Rest is part of the plan too.",
  "Empezar mi entreno de hoy": "Start today's workout",

  // Activación: A0, A1 y A2
  "Tu primer entreno": "Your first workout",
  "Recibes este correo porque creaste tu cuenta en Banana Burn y tienes activados los recordatorios.":
    "You're getting this email because you created a Banana Burn account and have reminders turned on.",
  "Empezar mi entreno": "Start my workout",
  "Tu primer entreno: 12 minutos en casa": "Your first workout: 12 minutes at home",
  "Puedes hacerlo ahora, sin ir al gimnasio.": "You can do it now, without going to the gym.",
  "Tu primer entreno dura 12 minutos y lo puedes hacer en casa ahora.": "Your first workout takes 12 minutes and you can do it at home right now.",
  "Abre la sesión, sigue las indicaciones de cada ejercicio y avanza a tu ritmo. No tienes que resolver toda la semana hoy: empieza con este entreno.":
    "Open the session, follow the cues for each exercise and go at your own pace. You don't have to figure out the whole week today. Start with this workout.",
  "Al terminar, guarda la sesión para que tu primer paso quede registrado.": "When you finish, save the session so your first step is logged.",
  "Lo difícil es empezar": "Starting is the hard part",
  "Hoy empieza con un entreno de 12 minutos.": "Today, start with a 12-minute workout.",
  "A veces cuesta más empezar que encontrar tiempo.": "Sometimes starting is harder than finding the time.",
  "Hoy no necesitas ir al gimnasio ni reservar una hora. Tu primer entreno son 12 minutos en casa, con las indicaciones de cada ejercicio en el celular.":
    "Today you don't need to go to the gym or set aside an hour. Your first workout is 12 minutes at home, with the cues for each exercise on your phone.",
  "Empieza a tu ritmo. Al terminar, guarda tu sesión: ya tendrás un punto de partida.": "Go at your own pace. When you finish, save your session and you'll have a starting point.",
  "Hoy también puedes empezar": "You can still start today",
  "Tu primer entreno sigue siendo un paso pequeño: 12 minutos.": "Your first workout is still a small step: 12 minutes.",
  "Si todavía no encontraste el momento, hoy puedes empezar en casa con 12 minutos.": "If you haven't found the time yet, today you can start at home with 12 minutes.",
  "La sesión te muestra qué hacer en cada ejercicio. Sigue las indicaciones, avanza a tu ritmo y guarda el entreno al terminar.":
    "The session shows you what to do in each exercise. Follow the cues, go at your own pace and save the workout when you finish.",
  "No necesitas recuperar los días que pasaron. Empieza por hoy.": "You don't need to make up for the days that went by. Start with today.",
};
