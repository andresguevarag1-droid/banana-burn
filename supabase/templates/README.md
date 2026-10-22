# Plantillas de correo de Supabase Auth

Pégalas en **Supabase → Authentication → Emails → Templates**:

| Plantilla en Supabase | Archivo | Asunto sugerido |
| --- | --- | --- |
| Magic Link | `magic-link.html` | Tu código para entrar a Banana Burn |
| Confirm signup | `confirm-signup.html` | Tu código para crear tu cuenta en Banana Burn |

Ambas incluyen el código (`{{ .Token }}`), que es lo que pide la pantalla de entrar, y un enlace con
`token_hash` que funciona aunque se abra en otro dispositivo (lo procesa `/auth/callback`).

Requisitos en **Authentication → URL Configuration**:
- Site URL: el dominio de producción (por ejemplo `https://bananaburn.app`).
- Redirect URLs: `https://<dominio>/auth/callback` y, para previews, `https://*-visia-latam.vercel.app/auth/callback`.

Para producción, configura SMTP propio (el de Supabase es solo para pruebas, manda muy pocos correos
por hora y suele caer en spam): **Authentication → Emails → SMTP Settings** con Resend:
host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = tu API key de Resend,
remitente `hola@<tu dominio verificado en Resend>`, nombre `Banana Burn`.
