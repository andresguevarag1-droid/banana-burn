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
| `/app/perfil` | Plan de entreno (días, gym/casa, ritmo), suscripción, descargar datos y borrar cuenta (Ley 8968) |
| `/admin/*` | Panel de staff: resumen, usuarios, pagos, contenido, comunidad y auditoría (ver sección **Admin**) |

- `src/lib/engine/` — motor portado del prototipo: calorías (Mifflin-St Jeor), doble progresión con reinicio −10 %, descargas, tendencia de peso, plan semanal anti-aburrimiento. Tests: `npm test`.
- `src/middleware.ts` — protege `/app` y `/admin`.
- `supabase/migrations/0001_init.sql` — esquema completo con RLS, roles y consentimiento de salud (Ley 8968).

**Sin variables de entorno la app corre en modo demo** (datos de Andrés, sin login) para que el deploy funcione desde el día 1.

## Activar cuentas reales (10 min)

1. Crea un proyecto en [Supabase](https://supabase.com) (región `us-east-1` recomendada).
2. SQL Editor → ejecuta en orden todas las migraciones de `supabase/migrations/` (`0001_init.sql`, `0002_onboarding.sql`, … `0005_admin.sql`).
3. Authentication → Email: activa *Email OTP*. En **Email Templates → Magic Link** incluye `{{ .Token }}` para que llegue el código de 6 dígitos.
4. Authentication → URL Configuration: Site URL = tu dominio de Vercel; Redirect URLs = `https://TU-DOMINIO/auth/callback` y `http://localhost:3000/auth/callback`.
5. (Opcional) Authentication → Providers → Google con tu Client ID/Secret.
6. (Coach IA) agrega `ANTHROPIC_API_KEY` en Vercel. Para que "Borrar mi cuenta" funcione agrega también `SUPABASE_SERVICE_ROLE_KEY` (solo servidor).
7. Copia `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` a Vercel → Settings → Environment Variables y redepliega.
8. Regístrate en `/entrar` y hazte superadmin en el SQL Editor:
   ```sql
   update public.profiles set role = 'superadmin'
   where id = (select id from auth.users where email = 'TU_CORREO');
   ```

## Admin

Panel en `/admin` (en español, pensado para escritorio y usable en móvil). Sin Supabase muestra datos de demo y permite **simular rol** desde la barra lateral para revisar permisos.

| Ruta | Qué hace |
|---|---|
| `/admin` | KPIs: usuarios, nuevos 7/30 d, activos hoy/7 d, entrenos/día, conversión, MRR, churn 30 d, cohortes D1/D7/D30 |
| `/admin/usuarios` · `/[id]` | Búsqueda (nombre, correo, ID) con filtros y paginación · ficha con cambio de rol, cortesías y reinicio de bienvenida |
| `/admin/pagos` | Suscripciones, MRR por plan, renovaciones y pagos fallidos (tolera columnas faltantes en `subscriptions`) |
| `/admin/contenido` | Overrides de ejercicios, alimentos (CRUD + verificado), retos y anuncios |
| `/admin/comunidad` | Cola de moderación sobre `reports` (resolver, ocultar, descartar) |
| `/admin/auditoria` | Visor de `audit_log` con filtros |

**Permisos** (`src/lib/admin-perms.ts`, repetidos en RLS y en funciones SECURITY DEFINER de `0005_admin.sql`):

| | coach | support | admin | superadmin |
|---|:-:|:-:|:-:|:-:|
| Resumen (sin ingresos) · usuarios (cuenta) · moderación | ✅ | ✅ | ✅ | ✅ |
| Peso, meta, actividad del usuario | ✅ | — | ✅ | ✅ |
| Facturación, pagos, cortesías, reiniciar bienvenida | — | ✅ | ✅ | ✅ |
| Ejercicios, alimentos, retos | ✅ | — | ✅ | ✅ |
| Ingresos (MRR/churn), anuncios, auditoría, cambiar roles | — | — | ✅ | ✅ |
| Otorgar/quitar admin o superadmin | — | — | — | ✅ |

Toda mutación es una server action que valida rol y entrada en el servidor y escribe `public.audit_log`. Cortesías vencidas: programa `select public.expire_comp_grants();` a diario (pg_cron o un cron con service_role).

**Para la app:** `src/lib/admin-content.ts` → `getLiveAnnouncements()`, `getChallengeCatalog()`, `getExerciseOverrides()`; componente `<AnnouncementBanner />` en `src/components/admin/announcement-banner.tsx`. Comunidad: insertar en `reports` y filtrar con `public.is_hidden(tipo, id)`.

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
