# Plantillas de correo de Supabase Auth

Se **generan** desde `src/lib/email/templates.ts` (mismo diseño que el resto de los correos: encabezado tinta
con el logo, franja banana, botón banana y firma de Coach Banana). No las edites a mano:

```bash
npm run emails:auth
```

Pégalas en **Supabase → Authentication → Emails → Templates** (asunto + cuerpo):

| Plantilla en Supabase | Archivo | Asunto |
| --- | --- | --- |
| Magic Link | `magic-link.html` | Tu código para entrar a Banana Burn |
| Confirm signup | `confirm-signup.html` | Tu código para crear tu cuenta en Banana Burn |
| Reset Password | `reset-password.html` | Crea tu nueva contraseña de Banana Burn |
| Change Email Address | `change-email.html` | Confirma tu nuevo correo en Banana Burn |
| Reauthentication | `reauthentication.html` | Tu código de seguridad de Banana Burn |

Incluyen el código (`{{ .Token }}`), que es lo que pide la pantalla de entrar, y un enlace con
`token_hash` que funciona aunque se abra en otro dispositivo (lo procesa `/auth/callback`).
Las imágenes (`/icons/icon-192.png`, `/email/coach.png`, `/email/mascota.png`) se cargan desde `{{ .SiteURL }}`,
así que el Site URL debe ser el dominio público.

Requisitos en **Authentication → URL Configuration**:
- Site URL: el dominio de producción (`https://bananaburn.app`).
- Redirect URLs: `https://<dominio>/auth/callback` y, para previews, `https://*-visia-latam.vercel.app/auth/callback`.

Para producción, configura SMTP propio (el de Supabase es solo para pruebas, manda muy pocos correos
por hora y suele caer en spam): **Authentication → Emails → SMTP Settings** con Resend:
host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = tu API key de Resend,
remitente `hola@bananaburn.app`, nombre `Banana Burn`.
