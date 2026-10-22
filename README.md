# 🍌 Banana Burn

Entrenador personal con IA, en español, para LATAM. Next.js 15 (App Router) + Supabase + Tailwind v4, desplegado en Vercel.

## Qué hay

| Ruta | Qué es |
|---|---|
| `/` · `/precios` | Landing de ventas (tema claro, marca Banana) |
| `/entrar` | Login multiusuario: código por correo (OTP) + Google |
| `/bienvenida` | Onboarding de 6 pasos: meta, datos, peso y fecha con ritmo sano, días, equipo, consentimiento → plan calculado |
| `/app` | **Hoy**: racha 🔥, nivel/XP, rutina del día, pesaje rápido, anillos de proteína/kcal/agua/pasos/sueño |
| `/app/entreno` | Reproductor para el gym: animación de técnica, cargas sugeridas, descanso con alarma, récords, resumen |
| `/app/entrenar` · `/nutricion` · `/progreso` · `/coach` | Programa por bloques con selector de día, registro de comidas con base tica (70 alimentos), gráficas de peso y fuerza con ajuste semanal, Coach IA con Claude (streaming) |
| `/admin` · `/admin/usuarios` | Panel de staff con KPIs y usuarios (solo roles coach/support/admin/superadmin) |

- `src/lib/engine/` — motor portado del prototipo: calorías (Mifflin-St Jeor), doble progresión con reinicio −10 %, descargas, tendencia de peso, plan semanal anti-aburrimiento. Tests: `npm test`.
- `src/middleware.ts` — protege `/app` y `/admin`.
- `supabase/migrations/0001_init.sql` — esquema completo con RLS, roles y consentimiento de salud (Ley 8968).

**Sin variables de entorno la app corre en modo demo** (datos de Andrés, sin login) para que el deploy funcione desde el día 1.

## Activar cuentas reales (10 min)

1. Crea un proyecto en [Supabase](https://supabase.com) (región `us-east-1` recomendada).
2. SQL Editor → ejecuta en orden `supabase/migrations/0001_init.sql` y `0002_onboarding.sql`.
3. Authentication → Email: activa *Email OTP*. En **Email Templates → Magic Link** incluye `{{ .Token }}` para que llegue el código de 6 dígitos.
4. Authentication → URL Configuration: Site URL = tu dominio de Vercel; Redirect URLs = `https://TU-DOMINIO/auth/callback` y `http://localhost:3000/auth/callback`.
5. (Opcional) Authentication → Providers → Google con tu Client ID/Secret.
6. (Coach IA) agrega `ANTHROPIC_API_KEY` en Vercel.
7. Copia `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` a Vercel → Settings → Environment Variables y redepliega.
8. Regístrate en `/entrar` y hazte superadmin en el SQL Editor:
   ```sql
   update public.profiles set role = 'superadmin'
   where id = (select id from auth.users where email = 'TU_CORREO');
   ```

## Desarrollo

```bash
cp .env.example .env.local   # opcional
npm install
npm run dev     # http://localhost:3000
npm test        # motor de entrenamiento
npm run build
```

## Roadmap
Fase 1 (2–22 nov): reproductor de entreno + registro de series, onboarding, coach IA (Claude), PWA.
Fase 2 (23 nov–6 dic): pagos ONVO (tarjeta, SINPE Móvil, Apple Pay), admin v1 completo.
Fase 3 (7–20 dic): beta cerrada CR. Fase 4 (ene 2027): lanzamiento LATAM.
