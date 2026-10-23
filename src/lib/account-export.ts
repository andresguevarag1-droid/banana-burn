// Qué entra en "Descargar mis datos" (Ley 8968, derecho de acceso). Lista única: la usa /api/cuenta/exportar y la
// prueba account-export.test.ts compara contra las migraciones para que ninguna tabla nueva con user_id quede fuera.

/** Tablas con columna user_id que se exportan completas (todas con RLS "propio": la sesión solo ve lo suyo). */
export const EXPORT_BY_USER = [
  "goals", "weights", "measurements", "daily_logs", "meals", "workouts", "workout_sets", "coach_messages", "xp_events", "coach_usage",
  "subscriptions", "billing_customers", "payment_events", "comp_grants",
  "notification_prefs", "notification_log", "saved_foods", "user_recipes", "notifications", "progress_photos",
  "user_challenges", "challenge_checkins", "challenge_milestones", "challenge_purchases", "challenge_entitlements",
  "device_interest", "posts", "comments", "kudos", "referral_codes",
] as const;

/**
 * Tablas con user_id que se exportan aparte: push_subscriptions con columnas elegidas (sin llaves criptográficas del
 * navegador) y referral_signals descrita (es una firma HMAC del prefijo de red, no una IP; nadie la lee por la API).
 * Los referidos y recompensas propios van en "referidos" (my_referrals y referral_rewards).
 */
export const EXPORT_SPECIAL = ["push_subscriptions", "referral_signals"] as const;
