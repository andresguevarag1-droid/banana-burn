// en-US (#300): el Recap, las ofertas del cierre y la hoja de tarjeta tras la primera serie.
import { TESTIMONIAL_PUBLISH_LABEL, TESTIMONIAL_QUESTION } from "@/lib/testimonials";

/** Niveles de gamify.ts (LEVELS), con su versión femenina. Si se agrega uno sin su nombre aquí, recap.test.tsx avisa. */
export const LEVEL_NAMES: Record<string, string> = {
  "Banana verde": "Green Banana", "Banana pintona": "Ripening Banana", "Banana madura": "Ripe Banana", "Plátano macho": "Plantain",
  "Banana dorada": "Golden Banana", "Mono fuerte": "Strong Monkey", "Mona fuerte": "Strong Monkey", Gorila: "Gorilla",
  "Rey de la selva": "King of the Jungle", "Reina de la selva": "Queen of the Jungle", "King Kong": "King Kong",
};

export const RECAP: Record<string, string> = {
  ...LEVEL_NAMES,
  // Cierre: título, estadísticas y nivel
  "Sesión parcial": "Partial session", "Entreno guardado": "Workout saved", "Resumen del entreno": "Workout summary",
  "Sesión parcial: {done} de {total} {unit}. Cuenta igual para tu racha.": "Partial session: {done} of {total} {unit}. It still counts toward your streak.",
  tiempo: "time", "XP ganados": "XP earned", "día de racha": "day streak", "días de racha": "day streak",
  "Bananas del día": "Today's bananas", "{got} de {total}": "{got} of {total}", "{got} de {total} ejercicios completos": "{got} of {total} exercises complete",
  "Sumando todas tus repeticiones, levantaste": "Adding up all your reps, you lifted", Moviste: "You moved", "Volumen total ({u} × reps):": "Total volume ({u} × reps):",
  " en total.": " in total.",
  "Desde la vez pasada": "Since last time", "La vez pasada: {a}. Hoy: {b}.": "Last time: {a}. Today: {b}.",
  "Lo que cambia la próxima vez": "What changes next time", "Con lo que anotaste hoy, tu plan ya se ajustó:": "Based on what you logged today, your plan already adjusted:",
  "Sube a {w} y vuelve a {lo} repeticiones.": "Go up to {w} and drop back to {lo} reps.", "Busca {n} repeticiones.": "Aim for {n} reps.",
  "Mismo peso, una repetición más por serie.": "Same weight, one more rep per set.", "Mismo peso y repeticiones, con técnica más limpia.": "Same weight and reps, with cleaner form.",
  "Baja a {w} para retomar con buena técnica.": "Drop to {w} to get back on track with good form.",
  "Nivel nuevo desbloqueado": "New level unlocked", "(nivel {idx})": "(level {idx})", "{n} (nivel {idx})": "{n} (level {idx})",
  "Subiendo a {n}": "Leveling up to {n}", "{xp} XP para {n}": "{xp} XP to {n}", "Nivel máximo": "Max level", "Progreso del nivel {idx}": "Level {idx} progress",
  "Con entrenos completos como este, llegas a {level} en tu próximo entreno.": "With full workouts like this one, you reach {level} on your next workout.",
  "Con entrenos completos como este, llegas a {level} en unos {n} entrenos.": "With full workouts like this one, you reach {level} in about {n} workouts.",
  "Ya habías hecho este entreno hoy: queda en tu historial, pero no suma XP.": "You already did this workout today: it goes in your history, but it doesn't add XP.",
  "Registraste las series muy rápido. El día cuenta para tu racha, pero los XP y los récords se ganan cuando cada serie lleva su tiempo real.":
    "You logged your sets very fast. The day counts toward your streak, but XP and records are earned when each set takes its real time.",
  "{n} récords personales": "{n} personal records", "Analizando tu entreno": "Analyzing your workout",
  // Compartir la historia
  "Creando…": "Creating…", Compartir: "Share", Descargar: "Download", "Tu historia": "Your story", "Lista para Instagram o WhatsApp.": "Ready for Instagram or WhatsApp.",
  "No pudimos crear la imagen en este teléfono.": "We couldn't create the image on this phone.",
  "Imagen descargada. Súbela a tu historia.": "Image downloaded. Post it to your story.", "Listo, compartido.": "Done, shared.",
  "Tarjeta del entreno {title}, {status}: {time}, {sets}, racha de {streak}": "Workout card for {title}, {status}: {time}, {sets}, {streak}-day streak",
  "{done} de {total} {unit}": "{done} of {total} {unit}",
  "1 día de racha": "1-day streak", "{n} días de racha": "{n}-day streak", "{got} de {total} ejercicios": "{got} of {total} exercises",
  "Récord personal en {name}": "Personal record on {name}", "Entreno guiado por Banana Burn": "Workout guided by Banana Burn",
  "{title} en Banana Burn": "{title} on Banana Burn",
  // Plan de la semana y avisos
  "Cumpliste tu meta de la semana: {count} de {goal}": "You hit your weekly goal: {count} of {goal}",
  "Esta semana: {count} de {goal} entrenos": "This week: {count} of {goal} workouts",
  "{n} de {goal} entrenos de tu meta semanal": "{n} of {goal} workouts toward your weekly goal",
  "Tu próximo entreno": "Your next workout", "Tus próximos entrenos": "Your next workouts", "La próxima semana": "Next week",
  "Recuérdame ese día": "Remind me that day", "Recuérdame esos días": "Remind me those days",
  "Listo. Te recordamos tu entreno {days} {when}. Lo cambias cuando quieras en tu perfil.": "Done. We'll remind you to train on {days} {when}. Change it anytime in your profile.",
  "No pudimos guardar el recordatorio. Intenta de nuevo.": "We couldn't save the reminder. Try again.",
  "No pudimos guardar tus avisos. Intenta de nuevo.": "We couldn't save your notifications. Try again.",
  "Que no se te pase el próximo": "Don't miss the next one",
  "Pon Banana Burn en tu pantalla de inicio y te avisamos el día que toca.": "Add Banana Burn to your home screen and we'll remind you on workout days.",
  // Oferta del primer entreno y oferta de salida
  "Terminaste tu primer entreno": "You finished your first workout", "Sigue con tu plan": "Keep going with your plan",
  "{plan}. Precios en USD, IVA incluido.": "{plan}. Prices in USD, tax included.", "Elige cómo pagar": "Choose how to pay",
  Anual: "Yearly", Mensual: "Monthly", "{price}/año": "{price}/yr", "{price}/mes": "{price}/mo",
  "Ahorras {amount} al año": "Save {amount} a year", "Primer mes a {price} dejando tu tarjeta": "First month at {price} when you add your card",
  "Activar mi plan": "Start my plan", "Cancela cuando quieras en 2 toques.": "Cancel anytime in 2 taps.", "Ahora no": "Not now",
  "Antes de irte: {pct} % en tu primer mes si dejas tu tarjeta hoy": "Before you go: {pct}% off your first month if you add your card today",
  "{plan}: tu primer mes a": "{plan}: your first month at", ", después": ", then",
  ". Hoy no te cobramos: se cobra al terminar tu prueba. Precios en USD, IVA incluido.": ". We don't charge you today: the charge happens when your trial ends. Prices in USD, tax included.",
  "Dejar mi tarjeta": "Add my card", "No, gracias": "No, thanks",
  // Regalo del condominio
  "Regalo de {name}": "A gift from {name}", "¿Te gustó? Sigue gratis hasta el {day}.": "Liked it? Keep going free until {day}.",
  "Deja tu tarjeta y entrenas con todo incluido sin pagar nada este año. Desde enero sigues solo si quieres, y cancelas cuando quieras.":
    "Add your card and train with everything included, free for the rest of this year. From January, you only continue if you want to, and you can cancel anytime.",
  "Seguir gratis": "Keep going free",
  // Aviso de fin de descanso (app nativa)
  "¿Te avisamos al terminar el descanso?": "Want an alert when your rest is over?",
  "Suena aunque bloquees la pantalla o cambies de app.": "It goes off even if you lock your screen or switch apps.", "Sí, avísame": "Yes, alert me",
  // Opinión del tercer entreno
  [TESTIMONIAL_QUESTION]: "How's it going with Banana Burn?",
  [TESTIMONIAL_PUBLISH_LABEL]: "You can publish my review with my first name and country",
  "Toca de 1 a 5 estrellas.": "Tap 1 to 5 stars.", "1 estrella": "1 star", "{n} estrellas": "{n} stars",
  "Cuéntanos más": "Tell us more", "(opcional)": "(optional)", "Enviando…": "Sending…", "Enviar opinión": "Send review",
  "Gracias por contarnos. Tu opinión nos ayuda a mejorar Banana Burn.": "Thanks for telling us. Your feedback helps us make Banana Burn better.",
  "No pudimos guardar tu opinión. Intenta de nuevo.": "We couldn't save your review. Try again.",
  "Elige de 1 a 5 estrellas (el texto llega hasta 200 caracteres).": "Pick 1 to 5 stars (text can be up to 200 characters).",
  // Tarjeta tras la primera serie
  "Tu primer mes a": "Your first month at", "si dejas tu tarjeta hoy. Hoy no se cobra nada.": "if you add your card today. Nothing is charged today.",
  Cerrar: "Close", "Listo, tu tarjeta quedó guardada": "Done, your card is saved",
  "Hoy no se cobra nada. Al terminar tu prueba se cobra tu primer mes de {plan}:": "Nothing is charged today. When your trial ends, we charge your first month of {plan}:",
  ", salvo que canceles antes desde Mi plan. Te avisamos 2 días antes.": ", unless you cancel before from My plan. We'll remind you 2 days before.",
  "Tu primer mes a {price} si dejas tu tarjeta hoy": "Your first month at {price} if you add your card today",
  "{plan} mensual:": "{plan} monthly:", "el primer mes, después": "for the first month, then", "al mes. Precios en USD, IVA incluido.": "a month. Prices in USD, tax included.",
  "Se cobra al terminar tu prueba, salvo que canceles antes desde Mi plan. Te avisamos 2 días antes.": "We charge it when your trial ends, unless you cancel before from My plan. We'll remind you 2 days before.",
};
