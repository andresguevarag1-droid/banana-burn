# Correo "Invita a 3 amigos y gana 1 mes gratis" (Resend)

Correo de marketing (no transaccional): lleva enlace de baja. Un solo CTA, hacia la pantalla **Invita y gana** de la app, donde está el enlace para compartir.

**Qué métrica mueve:** % de cuentas activas que comparten su enlace y, detrás, registros por referido. Cada referido que paga baja el **costo por cliente que paga** porque no tiene costo de anuncio. Meta de partida: 10 % de quienes lo abren tocan el CTA; se recalcula con los datos del 15 de noviembre.

## Disparador y hora de envío

| Envío | Evento que lo dispara | Quién lo recibe | Hora (Costa Rica) |
| --- | --- | --- | --- |
| Lanzamiento (una vez) | Envío manual aprobado por Andrés, martes 10 de noviembre | Cuentas con la bienvenida terminada y al menos 1 entreno terminado (no descanso) en los últimos 14 días | 10:00 a. m. |
| Ciclo de vida (una vez por cuenta) | `entreno_terminado` número 2 de la cuenta (no descanso) | Cuentas creadas desde el 10 de noviembre que todavía no recibieron este correo | 10:00 a. m. del día siguiente |

No se envía a quien se dio de baja de los correos de marketing ni a quien ya ganó 12 recompensas en los últimos 365 días. Si el mismo día toca otro correo de la prueba (días 1 a 7, oferta del 50 %, aviso antes del cobro), ese va primero y este se corre al día siguiente: nunca dos correos de marketing el mismo día.

Por qué el segundo entreno: es alguien que ya volvió a la app y puede recomendarla con algo que vivió. Pedirlo antes es pedir una recomendación de algo que no ha probado.

## Asunto y preheader

- **Asunto:** Invita a 3 amigos y gana 1 mes gratis
- **Preheader:** Y si uno de ellos elige el plan anual, ese mes se convierte en un trimestre.

## Enlace del CTA

`https://bananaburn.app/app/referidos?utm_source=referido&utm_medium=email&utm_campaign=invita-y-gana&utm_content=lanzamiento`

En el envío de ciclo de vida, `utm_content=segundo-entreno`. Si la persona no tiene sesión abierta, la app le pide entrar y la devuelve a la pantalla.

## Cuerpo en texto plano

```text
Hola, {nombre}:

Entrenar con alguien rinde más. Ahora, además, te regala meses.

Invita a 3 amigos y gana 1 mes gratis. Si uno de esos 3 compra el plan anual, ese mes se convierte en un trimestre: 3 meses gratis.

Cómo funciona:
1. Comparte tu enlace desde Invita y gana.
2. Tu amigo crea su cuenta con ese enlace y tiene 7 días gratis, sin tarjeta.
3. Cuenta cuando se activa: termina su bienvenida y, en sus primeros 7 días, completa un entreno o registra su agua, pasos o sueño.
4. Cada 3 amigos activos te dan 1 mes gratis. Se suma al final de tu acceso actual, así que no pierdes ni un día.

Comparte tu enlace:
https://bananaburn.app/app/referidos?utm_source=referido&utm_medium=email&utm_campaign=invita-y-gana&utm_content=lanzamiento

Cada persona cuenta una sola vez y solo con una cuenta nueva. La compra anual cuenta cuando se confirma el pago. Máximo 12 recompensas por año.

Coach Banana
Banana Burn

Recibes este correo porque tienes una cuenta en Banana Burn. Si no quieres más correos como este: {enlace_baja}
Dudas: hola@bananaburn.app
```

## Cuerpo en HTML

Mismos estilos en línea que `src/lib/email/templates.ts` (encabezado blanco, héroe banana con texto ink, botón ink con texto blanco, tarjetas card con borde line). `{nombre}` y `{enlace_baja}` los llena el envío.

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invita a 3 amigos y gana 1 mes gratis</title>
</head>
<body style="margin:0;padding:0;background:#FFF8E3;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Y si uno de ellos elige el plan anual, ese mes se convierte en un trimestre.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8E3;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <tr><td style="background:#FFFFFF;border:1px solid #EDE3C6;border-bottom:0;border-radius:24px 24px 0 0;padding:16px 24px;">
    <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#1B1505;">Banana <span style="color:#8A5300;">Burn</span></span>
  </td></tr>

  <tr><td style="background:#FFD60A;padding:32px 24px;">
    <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#1B1505;">Invita y gana</p>
    <h1 style="margin:0 0 12px;font-size:30px;line-height:36px;font-weight:800;letter-spacing:-0.02em;color:#1B1505;">Invita a 3 amigos y gana 1 mes gratis</h1>
    <p style="margin:0;font-size:16px;line-height:24px;color:#2E2818;">Si uno de esos 3 compra el plan anual, ese mes se convierte en un trimestre: 3 meses gratis.</p>
  </td></tr>

  <tr><td style="background:#FFFFFF;border:1px solid #EDE3C6;border-top:0;padding:24px;">
    <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#2E2818;">Hola, {nombre}. Entrenar con alguien rinde más. Ahora, además, te regala meses.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBF0;border:1px solid #EDE3C6;border-radius:16px;">
      <tr><td style="padding:16px;font-size:15px;line-height:22px;color:#2E2818;">
        <p style="margin:0 0 8px;"><b style="color:#1B1505;">1. Comparte tu enlace</b> desde Invita y gana.</p>
        <p style="margin:0 0 8px;"><b style="color:#1B1505;">2. Tu amigo crea su cuenta</b> con ese enlace y tiene 7 días gratis, sin tarjeta.</p>
        <p style="margin:0 0 8px;"><b style="color:#1B1505;">3. Cuenta cuando se activa:</b> termina su bienvenida y, en sus primeros 7 días, completa un entreno o registra su agua, pasos o sueño.</p>
        <p style="margin:0;"><b style="color:#1B1505;">4. Cada 3 amigos activos: 1 mes gratis.</b> Se suma al final de tu acceso actual, así que no pierdes ni un día.</p>
      </td></tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td style="background:#1B1505;border-radius:999px;">
        <a href="https://bananaburn.app/app/referidos?utm_source=referido&amp;utm_medium=email&amp;utm_campaign=invita-y-gana&amp;utm_content=lanzamiento" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Compartir mi enlace</a>
      </td></tr>
    </table>

    <p style="margin:0 0 16px;font-size:13px;line-height:20px;color:#6A604B;">Cada persona cuenta una sola vez y solo con una cuenta nueva. La compra anual cuenta cuando se confirma el pago. Máximo 12 recompensas por año.</p>
    <p style="margin:0;font-size:15px;line-height:22px;color:#2E2818;"><b style="color:#1B1505;">Coach Banana</b><br>Banana Burn</p>
  </td></tr>

  <tr><td style="padding:16px 24px;font-size:12px;line-height:18px;color:#6A604B;text-align:center;">
    Recibes este correo porque tienes una cuenta en Banana Burn. <a href="{enlace_baja}" style="color:#6A604B;">Darte de baja de estos correos</a>.<br>
    Dudas: hola@bananaburn.app
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>
```

## Revisión antes de enviar

- [ ] Andrés aprueba el texto y la fecha del envío de lanzamiento.
- [ ] El CTA abre `/app/referidos` con sesión y sin sesión.
- [ ] `{enlace_baja}` lo genera el sistema de correos (no es un enlace de marketing, no lleva UTM).
- [ ] Sin IA, sin testimonios, sin escasez, sin números de WhatsApp.
